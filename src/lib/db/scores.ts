import { get } from "svelte/store";
import { demoMancingScores } from "$lib/demo/generator";
import { demoMode } from "$lib/demo/store";
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
				idempotency_key: crypto.randomUUID(),
			})
			.select("id")
			.single();
		if (error) {
			throw error;
		}
		return { queued: false, id: (data as { id: string }).id };
	} catch {
		const key = `score-mancing:${input.competitionId}:${input.participantId}:${Date.now()}`;
		await enqueue(key, "/rest/scores/mancing", {
			competitionId: input.competitionId,
			participantId: input.participantId,
			fishWeightGram: gram,
			isJackpot: input.isJackpot,
			recordedBy: input.recordedBy,
		});
		return { queued: true, id: key };
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
