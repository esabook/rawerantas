import { get } from "svelte/store";
import { demoMode } from "$lib/demo/store";
import { DB_VERSION, ensureAllStores } from "$lib/offline/idbSchema";
import { enqueue } from "$lib/offline/queue";
import type { Participant } from "./queries";
import {
	getCompetitions,
	getParticipantById,
	getPayments,
	getSupabase,
} from "./queries";

const DB_NAME = "rawerantas";
const STORE = "demo_checkins";

let dbPromise: Promise<IDBDatabase> | null = null;

const getDb = (): Promise<IDBDatabase> => {
	dbPromise ??= new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, DB_VERSION);
		req.onupgradeneeded = () => {
			ensureAllStores(req.result);
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
	return dbPromise;
};

export interface CheckinRecord {
	participantId: string;
	checkedInAt: Date;
	recordedBy: string | null;
}

export type CheckinEligibility =
	| "ok"
	| "already"
	| "disqualified"
	| "not_eligible";

export interface CheckinSummary {
	participant: Participant;
	competitionName: string | null;
	fee: number;
	paid: number;
	remaining: number;
	status: Participant["status"];
	checkedInAt: Date | null;
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
	const db = await getDb();
	return new Promise((resolve, reject) => {
		const req = db.transaction(STORE).objectStore(STORE).getAll();
		req.onsuccess = () => resolve((req.result as CheckinRecord[]) ?? []);
		req.onerror = () => reject(req.error);
	});
}

async function getCheckin(
	participantId: string,
): Promise<CheckinRecord | null> {
	const all = await localCheckins();
	return all.find((c) => c.participantId === participantId) ?? null;
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
	const paid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
	const fee = competition?.fee ?? 0;
	return {
		participant,
		competitionName: competition?.name ?? null,
		fee,
		paid,
		remaining: Math.max(0, fee - paid),
		status: checkin ? "checked_in" : participant.status,
		checkedInAt: checkin?.checkedInAt ?? null,
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
	const { participant } = summary;
	if (participant.status === "disqualified") {
		throw new CheckinError("disqualified", "Peserta didiskualifikasi.");
	}
	if (
		participant.status !== "dp_paid" &&
		participant.status !== "fully_paid" &&
		participant.status !== "checked_in"
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
		const db = await getDb();
		const record: CheckinRecord = {
			participantId,
			checkedInAt: new Date(),
			recordedBy,
		};
		await new Promise<void>((resolve, reject) => {
			const tx = db.transaction(STORE, "readwrite");
			tx.objectStore(STORE).put(record);
			tx.oncomplete = () => resolve();
			tx.onerror = () => reject(tx.error);
		});
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
	} catch {
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
): Promise<Participant | null> {
	const normalized = ticketNumber.trim().toUpperCase();
	if (get(demoMode)) {
		const { demoParticipants } = await import("$lib/demo/generator");
		const { demoLocalParticipants } = await import("./register");
		const [seed, local] = await Promise.all([
			Promise.resolve(demoParticipants()),
			demoLocalParticipants(),
		]);
		return (
			[...local, ...seed].find((p) => p.ticketNumber === normalized) ?? null
		);
	}
	const { supabase } = await getSupabase();
	const { data } = await supabase
		.from("participants")
		.select("*")
		.eq("ticket_number", normalized)
		.maybeSingle();
	return (data ?? null) as Participant | null;
}

export async function resetDemoCheckins(): Promise<void> {
	const db = await getDb();
	await new Promise<void>((resolve, reject) => {
		const tx = db.transaction(STORE, "readwrite");
		tx.objectStore(STORE).clear();
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
}
