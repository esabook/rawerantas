import { get } from "svelte/store";
import { demoParticipants } from "$lib/demo/generator";
import { demoMode } from "$lib/demo/store";
import { isOfflineError } from "$lib/offline/networkStore";
import { enqueue } from "$lib/offline/queue";
import { localClear, localGetAll, localPut, localStores } from "./localStore";
import type { Participant, ParticipantPayment } from "./queries";
import {
	getCompetitions,
	getParticipantById,
	getParticipants,
	getPayments,
	getSupabase,
	normalizeParticipantRow,
} from "./queries";

const STORE = localStores.checkins;

const isRejectedPayment = (
	payment: Pick<ParticipantPayment, "isVerified" | "rejectReason">,
): boolean => !payment.isVerified && Boolean(payment.rejectReason?.trim());

export interface CheckinRecord {
	participantId: string;
	checkedInAt: Date;
	recordedBy: string | null;
}

export type CheckinEligibility =
	| "ok"
	| "already"
	| "disqualified"
	| "payment_rejected"
	| "not_eligible";

export interface CheckinSummary {
	participant: Participant;
	competitionName: string | null;
	fee: number;
	paid: number;
	remaining: number;
	status: Participant["status"];
	checkedInAt: Date | null;
	paymentRejected: boolean;
	rejectionReason: string | null;
}

export interface CheckinStats {
	registered: number;
	checkedIn: number;
	remaining: number;
}

export class CheckinError extends Error {
	eligibility: Exclude<CheckinEligibility, "ok" | "already">;
	constructor(
		eligibility: Exclude<CheckinEligibility, "ok" | "already">,
		message: string,
	) {
		super(message);
		this.name = "CheckinError";
		this.eligibility = eligibility;
	}
}

async function localCheckins(): Promise<CheckinRecord[]> {
	const rows = await localGetAll<CheckinRecord>(STORE);
	return rows.map((r) => ({
		...r,
		checkedInAt: new Date(r.checkedInAt as unknown as string),
	}));
}

async function getCheckin(
	participantId: string,
): Promise<CheckinRecord | null> {
	const all = await localCheckins();
	return all.find((c) => c.participantId === participantId) ?? null;
}

export async function getCheckinStats(
	competitionId?: string,
): Promise<CheckinStats> {
	const isDemo = get(demoMode);
	let participants: Participant[];
	if (isDemo) {
		const { demoLocalParticipants } = await import("./register");
		participants = [...demoParticipants(), ...(await demoLocalParticipants())];
		if (competitionId) {
			participants = participants.filter(
				(participant) => participant.competitionId === competitionId,
			);
		}
	} else {
		participants = await getParticipants(competitionId);
	}
	const uniqueParticipants = [
		...new Map(
			participants.map((participant) => [participant.id, participant]),
		).values(),
	];
	const rejectedParticipantIds = new Set(
		(await getPayments()).filter(isRejectedPayment).map((p) => p.participantId),
	);
	const eligibleParticipants = uniqueParticipants.filter(
		(participant) =>
			participant.status !== "disqualified" &&
			!rejectedParticipantIds.has(participant.id),
	);
	const localCheckinIds = isDemo
		? new Set((await localCheckins()).map((checkin) => checkin.participantId))
		: new Set<string>();
	const checkedIn = eligibleParticipants.filter(
		(participant) =>
			participant.status === "checked_in" ||
			localCheckinIds.has(participant.id),
	).length;

	return {
		registered: eligibleParticipants.length,
		checkedIn,
		remaining: Math.max(0, eligibleParticipants.length - checkedIn),
	};
}

/**
 * Ringkasan check-in peserta: data peserta, lomba, status pembayaran,
 * sisa bayar. Mode demo: status efektif = seed/lokal ATAU checked_in lokal.
 */
export async function getCheckinSummary(
	participantId: string,
): Promise<CheckinSummary> {
	const participant = await getParticipantById(participantId);
	if (!participant) {
		throw new Error("Peserta tidak ditemukan.");
	}
	const payments = await getPayments(participantId);
	const competitions = await getCompetitions(false);
	const competition = competitions.find(
		(c) => c.id === participant.competitionId,
	);
	const checkin = await getCheckin(participantId);
	const rejectedPayment = payments.find(isRejectedPayment);
	const paid = payments
		.filter((p) => p.isVerified && !p.rejectReason?.trim())
		.reduce((sum, p) => sum + Number(p.amount), 0);
	const fee = competition?.fee ?? 0;
	let status: Participant["status"] = checkin
		? "checked_in"
		: participant.status;
	if (!checkin && status !== "disqualified") {
		if (fee > 0 && paid >= fee) {
			status = "fully_paid";
		} else if (
			status === "registered" &&
			(competition?.minDp ?? 0) > 0 &&
			paid >= (competition?.minDp ?? 0)
		) {
			status = "dp_paid";
		}
	}
	return {
		participant,
		competitionName: competition?.name ?? null,
		fee,
		paid,
		remaining: Math.max(0, fee - paid),
		status,
		checkedInAt: checkin?.checkedInAt ?? null,
		paymentRejected: Boolean(rejectedPayment),
		rejectionReason: rejectedPayment?.rejectReason?.trim() ?? null,
	};
}

/**
 * Check-in peserta. Syarat masuk: minimal DP (dp_paid/fully_paid).
 * Sudah check-in → idempotent (bukan error). Disqualified → blokir.
 */
export async function checkInParticipant(
	participantId: string,
	recordedBy: string | null = null,
): Promise<{ eligibility: CheckinEligibility; summary: CheckinSummary }> {
	const summary = await getCheckinSummary(participantId);
	if (summary.status === "disqualified") {
		throw new CheckinError("disqualified", "Peserta didiskualifikasi.");
	}
	if (summary.paymentRejected) {
		throw new CheckinError(
			"payment_rejected",
			`Pembayaran peserta ditolak admin${summary.rejectionReason ? `: ${summary.rejectionReason}` : "."}`,
		);
	}
	if (
		summary.status !== "dp_paid" &&
		summary.status !== "fully_paid" &&
		summary.status !== "checked_in"
	) {
		throw new CheckinError(
			"not_eligible",
			"Belum memenuhi syarat masuk (minimal DP dibayar).",
		);
	}
	if (summary.checkedInAt) {
		return { eligibility: "already", summary };
	}
	if (get(demoMode)) {
		const record: CheckinRecord = {
			participantId,
			checkedInAt: new Date(),
			recordedBy,
		};
		await localPut(STORE, record);
		return {
			eligibility: "ok",
			summary: await getCheckinSummary(participantId),
		};
	}
	try {
		const { supabase } = await import("./supabaseClient");
		const { error } = await supabase
			.from("participants")
			.update({ status: "checked_in", checked_in_at: new Date().toISOString() })
			.eq("id", participantId);
		if (error) {
			throw error;
		}
		return {
			eligibility: "ok",
			summary: await getCheckinSummary(participantId),
		};
	} catch (e) {
		if (!isOfflineError(e)) {
			throw e;
		}
		await enqueue(`checkin:${participantId}`, "/rest/participants/checkin", {
			participantId,
		});
		return {
			eligibility: "ok",
			summary: await getCheckinSummary(participantId),
		};
	}
}

/**
 * Cari peserta berdasarkan nomor tiket (manual entry tanpa kamera).
 */
export async function findParticipantByTicket(
	ticketNumber: string,
	competitionId?: string,
): Promise<Participant | null> {
	const normalized = ticketNumber.trim().toUpperCase();
	let participant: Participant | null = null;
	if (get(demoMode)) {
		const { demoParticipants } = await import("$lib/demo/generator");
		const { demoLocalParticipants } = await import("./register");
		const [seed, local] = await Promise.all([
			Promise.resolve(demoParticipants()),
			demoLocalParticipants(),
		]);
		participant =
			[...local, ...seed].find((p) => p.ticketNumber === normalized) ?? null;
		if (
			participant &&
			competitionId &&
			participant.competitionId !== competitionId
		) {
			participant = null;
		}
	} else {
		const { supabase } = await getSupabase();
		let query = supabase
			.from("participants")
			.select("*")
			.eq("ticket_number", normalized);
		if (competitionId) {
			query = query.eq("competition_id", competitionId);
		}
		const { data } = await query.maybeSingle();
		participant = data
			? normalizeParticipantRow(data as Record<string, unknown>)
			: null;
	}
	if (!participant) {
		return null;
	}

	const summary = await getCheckinSummary(participant.id);
	if (summary.status === "disqualified") {
		throw new CheckinError("disqualified", "Peserta didiskualifikasi.");
	}
	if (summary.paymentRejected) {
		throw new CheckinError(
			"payment_rejected",
			`Pembayaran peserta ditolak admin${summary.rejectionReason ? `: ${summary.rejectionReason}` : "."}`,
		);
	}
	return { ...summary.participant, status: summary.status };
}

export async function resetDemoCheckins(): Promise<void> {
	await localClear(STORE);
}
