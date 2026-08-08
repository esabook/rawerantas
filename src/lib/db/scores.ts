import { get } from "svelte/store";
import { demoMancingScores } from "$lib/demo/generator";
import { demoMode } from "$lib/demo/store";
import { isOfflineError } from "$lib/offline/networkStore";
import { enqueue } from "$lib/offline/queue";
import {
	localClear,
	localDelete,
	localGetAll,
	localPut,
	localStores,
} from "./localStore";
import type { Participant } from "./queries";

const STORE = localStores.scoresMancing;

export interface MancingScoreRecord {
	id: string;
	competitionId: string;
	participantId: string;
	fishWeightGram: number;
	isJackpot: boolean;
	receivedAt: Date;
	idempotencyKey: string;
	recordedBy: string;
}

export class InvalidWeightError extends Error {
	constructor() {
		super("Timbangan harus lebih dari 0 gram.");
		this.name = "InvalidWeightError";
	}
}

export interface MancingScoreInput {
	competitionId: string;
	participantId: string;
	fishWeightGram: number;
	isJackpot: boolean;
	recordedBy: string;
}

export interface MancingScoreResult {
	queued: boolean;
	/** id record (demo/live) atau idempotencyKey antrean bila queued */
	id: string;
}

export function validateWeight(gram: number): number {
	if (!Number.isFinite(gram) || gram <= 0) {
		throw new InvalidWeightError();
	}
	return Math.round(gram);
}

export async function resetDemoMancingScores(): Promise<void> {
	await localClear(STORE);
}

async function localScores(): Promise<MancingScoreRecord[]> {
	return localGetAll<MancingScoreRecord>(STORE);
}

/**
 * Semua skor mancing untuk kompetisi — gabungan seed + skor lokal perangkat.
 */
export async function getAllScores(
	competitionId: string,
): Promise<MancingScoreRecord[]> {
	if (!get(demoMode)) {
		const { getSupabase, normalizeMancingScoreRow } = await import("./queries");
		const { supabase } = await getSupabase();
		const { data, error } = await supabase
			.from("scores_mancing")
			.select("*")
			.eq("competition_id", competitionId)
			.order("received_at", { ascending: true });
		if (error) {
			throw new Error(`getAllScores: ${error.message}`);
		}
		return (data ?? []).map((row) =>
			normalizeMancingScoreRow(row as Record<string, unknown>),
		) as MancingScoreRecord[];
	}
	const seeded = demoMancingScores().filter(
		(s) => s.competitionId === competitionId,
	);
	const local = await localScores();
	return [...local, ...seeded].filter((s) => s.competitionId === competitionId);
}

/**
 * true bila peserta sudah punya skor jackpot (seed maupun lokal) —
 * panel wajib konfirmasi sebelum jackpot kedua.
 */
export async function hasJackpot(
	competitionId: string,
	participantId: string,
): Promise<boolean> {
	if (!get(demoMode)) {
		const { getSupabase } = await import("./queries");
		const { supabase } = await getSupabase();
		const { data, error } = await supabase
			.from("scores_mancing")
			.select("id")
			.eq("competition_id", competitionId)
			.eq("participant_id", participantId)
			.eq("is_jackpot", true)
			.limit(1);
		if (error) {
			throw new Error(`hasJackpot: ${error.message}`);
		}
		return (data ?? []).length > 0;
	}
	const rows = await getAllScores(competitionId);
	return rows.some((r) => r.participantId === participantId && r.isJackpot);
}

async function saveLocal(record: MancingScoreRecord): Promise<void> {
	await localPut(STORE, record);
}

/**
 * Hapus skor (undo 5 detik):
 * - demo → hapus record idb
 * - live masih antre (pending) → hapus item queue
 * - live sudah terkirim → enqueue tombstone delete
 */
export async function removeScore(
	id: string,
	wasQueued: boolean,
): Promise<void> {
	if (get(demoMode)) {
		await localDelete(STORE, id);
		return;
	}
	if (wasQueued) {
		const { removePending } = await import("$lib/offline/queue");
		const removed = await removePending(id);
		if (removed) {
			return;
		}
		// Entri antrean sudah ter-drain: `id` adalah idempotency_key DB
		// (kunci antrean == UUID idempotensi sejak QW-2/A25) — hapus lewat
		// kolom itu; `.eq("id", kunci)` lama tak pernah cocok (ghost score).
		await enqueue(`score-delete:${id}`, "/rest/scores/mancing/delete", {
			idempotencyKey: id,
		});
		return;
	}
	await enqueue(`score-delete:${id}`, "/rest/scores/mancing/delete", {
		scoreId: id,
	});
}

export async function submitMancingScore(
	input: MancingScoreInput,
): Promise<MancingScoreResult> {
	const gram = validateWeight(input.fishWeightGram);
	if (get(demoMode)) {
		const record: MancingScoreRecord = {
			id: crypto.randomUUID(),
			competitionId: input.competitionId,
			participantId: input.participantId,
			fishWeightGram: gram,
			isJackpot: input.isJackpot,
			receivedAt: new Date(),
			idempotencyKey: crypto.randomUUID(),
			recordedBy: input.recordedBy,
		};
		await saveLocal(record);
		return { queued: false, id: record.id };
	}
	const idempotencyKey = crypto.randomUUID();
	try {
		const { supabase } = await import("./supabaseClient");
		const { data, error } = await supabase
			.from("scores_mancing")
			.insert({
				competition_id: input.competitionId,
				participant_id: input.participantId,
				fish_weight_gram: gram,
				is_jackpot: input.isJackpot,
				recorded_by: input.recordedBy,
				idempotency_key: idempotencyKey,
			})
			.select("id")
			.single();
		if (error) {
			throw error;
		}
		return { queued: false, id: (data as { id: string }).id };
	} catch (e) {
		if (!isOfflineError(e)) {
			throw e;
		}
		// Kunci antrean = UUID idempotensi DB (QW-2/A25): bila entri ter-drain
		// sebelum undo, removePending(id) gagal dan tombstone tetap bisa
		// menghapus baris via kolom idempotency_key.
		await enqueue(idempotencyKey, "/rest/scores/mancing", {
			competitionId: input.competitionId,
			participantId: input.participantId,
			fishWeightGram: gram,
			isJackpot: input.isJackpot,
			recordedBy: input.recordedBy,
			idempotencyKey,
		});
		return { queued: true, id: idempotencyKey };
	}
}

export function findParticipantByLapak(
	participants: Participant[],
	competitionId: string,
	lapakNumber: number,
): Participant | undefined {
	return participants.find(
		(p) =>
			p.competitionId === competitionId &&
			p.lapakNumber === String(lapakNumber),
	);
}
