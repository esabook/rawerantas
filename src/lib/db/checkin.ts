import { get } from "svelte/store";
import { demoParticipants } from "$lib/demo/generator";
import { demoMode } from "$lib/demo/store";
import { isOfflineError } from "$lib/offline/networkStore";
import { enqueue } from "$lib/offline/queue";
import { localClear, localGetAll, localPut, localStores } from "./localStore";
import { submitCashPayment } from "./payment";
import type { Participant, ParticipantPayment } from "./queries";
import {
	getCompetitions,
	getParticipantById,
	getParticipants,
	getPayments,
	getSupabase,
	normalizeParticipantRow,
} from "./queries";
import { registerParticipant } from "./register";
import { formatStaffActor } from "./staff";

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
	pendingAmount: number;
	pendingCount: number;
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
	const pendingPayments = payments.filter(
		(p) => !p.isVerified && !p.rejectReason?.trim(),
	);
	const pendingAmount = pendingPayments.reduce(
		(sum, p) => sum + Number(p.amount),
		0,
	);
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
		pendingAmount,
		pendingCount: pendingPayments.length,
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
): Promise<{
	eligibility: CheckinEligibility;
	summary: CheckinSummary;
	queued?: boolean;
}> {
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
		// B1-5: check-in via RPC — eligibility + audit di server (A21/A22).
		const { data, error } = await supabase.rpc("check_in", {
			p_participant_id: participantId,
			p_recorded_by: recordedBy,
		});
		if (error) {
			throw error;
		}
		const result = data as
			| { ok?: boolean; already?: boolean; reason?: string }
			| undefined;
		if (!result?.ok) {
			throw new Error(checkinRpcMessage(result?.reason));
		}
		return {
			eligibility: result.already ? "already" : "ok",
			summary: await getCheckinSummary(participantId),
		};
	} catch (e) {
		if (!isOfflineError(e)) {
			throw e;
		}
		// B1-5/F7: saat offline, catat optimistik lokal (UI konsisten) lalu
		// enqueue; drain memakai RPC sehingga eligibility tetap dicek server.
		await localPut(STORE, {
			participantId,
			checkedInAt: new Date(),
			recordedBy,
		});
		await enqueue(`checkin:${participantId}`, "/rest/participants/checkin", {
			participantId,
			recordedBy,
		});
		return {
			eligibility: "ok",
			summary: await getCheckinSummary(participantId),
			queued: true,
		};
	}
}

/** Pesan ramah utk reason penolakan RPC `check_in`. */
function checkinRpcMessage(reason: string | undefined): string {
	switch (reason) {
		case "participant_not_found":
			return "Peserta tidak ditemukan.";
		case "disqualified":
			return "Peserta didiskualifikasi.";
		case "payment_rejected":
			return "Pembayaran peserta ditolak admin.";
		case "not_eligible":
			return "Belum memenuhi syarat masuk (minimal DP dibayar).";
		case "locked":
			return "Data terkunci setelah acara selesai. Check-in ditutup.";
		default:
			return "Check-in ditolak server. Coba lagi.";
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

export interface WalkinCheckinInput {
	competitionId: string;
	name: string;
	phone: string;
	staffId?: string;
	staffName?: string;
}

/**
 * Daftar peserta on-site (loket), lunasi tunai, lalu check-in langsung —
 * satu aksi panitia. Reuse registerParticipant/submitCashPayment/
 * checkInParticipant apa adanya, jadi guard kuota/DP/disqualified tetap satu
 * sumber kebenaran. Offline: registerParticipant tidak punya id lokal untuk
 * langsung dibayar/check-in, jadi loket harus online.
 */
export async function registerWalkinCheckin(
	input: WalkinCheckinInput,
): Promise<{
	participantId: string;
	eligibility: CheckinEligibility;
	queued: boolean;
}> {
	const staff =
		input.staffId && input.staffName
			? { id: input.staffId, name: input.staffName }
			: null;
	const registration = await registerParticipant({
		competitionId: input.competitionId,
		name: input.name,
		phone: input.phone,
		source: "panitia",
		registeredByStaffId: staff?.id,
		registeredByStaffName: staff?.name,
	});
	if (!registration.participantId) {
		throw new Error(
			"Sedang offline — pendaftaran on-site butuh koneksi utk langsung bayar & check-in.",
		);
	}
	// Peserta sudah tercatat (kuota terpakai) begitu registerParticipant sukses.
	// Bila bayar/check-in di bawah gagal, lampirkan participantId ke error agar
	// caller bisa membuka ParticipantDetailCard alih-alih menampilkan dead-end.
	try {
		const summary = await getCheckinSummary(registration.participantId);
		let paymentQueued = false;
		if (summary.remaining > 0) {
			const paymentResult = await submitCashPayment(
				{
					participantId: registration.participantId,
					competitionId: input.competitionId,
				},
				{ fee: summary.fee },
			);
			paymentQueued = Boolean(paymentResult.queued);
		}
		const { eligibility, queued: checkinQueued } = await checkInParticipant(
			registration.participantId,
			staff ? formatStaffActor(staff) : null,
		);
		return {
			participantId: registration.participantId,
			eligibility,
			queued: paymentQueued || Boolean(checkinQueued),
		};
	} catch (e) {
		throw Object.assign(e instanceof Error ? e : new Error(String(e)), {
			participantId: registration.participantId,
		});
	}
}

export async function resetDemoCheckins(): Promise<void> {
	await localClear(STORE);
}
