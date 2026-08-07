import { get } from "svelte/store";
import { demoLayanganScores } from "$lib/demo/generator";
import { demoMode } from "$lib/demo/store";
import { enqueue } from "$lib/offline/queue";
import {
	localClear,
	localDelete,
	localGetAll,
	localPut,
	localStores,
} from "./localStore";

const STORE = localStores.scoresLayangan;

export type LayanganStatus = "menang" | "putus";

export interface LayanganScoreRecord {
	id: string;
	competitionId: string;
	participantId: string;
	round: number;
	status: LayanganStatus;
	receivedAt: Date;
	idempotencyKey: string;
	recordedBy: string;
}

export interface LayanganScoreInput {
	competitionId: string;
	participantId: string;
	round: number;
	status: LayanganStatus;
	recordedBy: string;
}

export interface LayanganScoreResult {
	queued: boolean;
	/** id record (demo/live) atau idempotencyKey antrean bila queued */
	id: string;
}

export async function resetDemoLayanganScores(): Promise<void> {
	await localClear(STORE);
}

async function localScores(): Promise<LayanganScoreRecord[]> {
	return localGetAll<LayanganScoreRecord>(STORE);
}

/**
 * Semua hasil layangan (semua babak) — seed + lokal — untuk leaderboard.
 */
export async function getAllLayanganScores(
	competitionId: string,
): Promise<LayanganScoreRecord[]> {
	const seeded = demoLayanganScores().filter(
		(s) => s.competitionId === competitionId,
	) as LayanganScoreRecord[];
	const local = await localScores();
	return [...local, ...seeded].filter((s) => s.competitionId === competitionId);
}

/**
 * Semua hasil layangan untuk kompetisi pada babak tertentu — seed + lokal.
 * Tanpa filter round: seluruh babak (dipakai cek peserta sudah main di babak lama).
 */
export async function getRoundResults(
	competitionId: string,
	round: number,
): Promise<LayanganScoreRecord[]> {
	const seeded = demoLayanganScores().filter(
		(s) => s.competitionId === competitionId && s.round === round,
	) as LayanganScoreRecord[];
	const local = await localScores();
	return [...local, ...seeded].filter(
		(s) => s.competitionId === competitionId && s.round === round,
	);
}

/**
 * true bila peserta sudah tercatat hasil (menang/kalah) pada babak ini —
 * state machine aktif → mudun|putus hanya sekali per babak.
 */
export async function hasResult(
	competitionId: string,
	participantId: string,
	round: number,
): Promise<boolean> {
	const rows = await getRoundResults(competitionId, round);
	return rows.some((r) => r.participantId === participantId);
}

async function saveLocal(record: LayanganScoreRecord): Promise<void> {
	await localPut(STORE, record);
}

/**
 * Hapus hasil (undo 5 detik) — dua jalur seperti mancing:
 * - demo → hapus record idb
 * - live masih antre (pending) → hapus item queue
 * - live sudah terkirim → enqueue tombstone delete
 */
export async function removeLayanganScore(
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
	await enqueue(`score-layangan-delete:${id}`, "/rest/scores/layangan/delete", {
		scoreId: id,
	});
}

export async function submitLayanganResult(
	input: LayanganScoreInput,
): Promise<LayanganScoreResult> {
	if (get(demoMode)) {
		const record: LayanganScoreRecord = {
			id: crypto.randomUUID(),
			competitionId: input.competitionId,
			participantId: input.participantId,
			round: input.round,
			status: input.status,
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
			.from("scores_layangan")
			.insert({
				competition_id: input.competitionId,
				participant_id: input.participantId,
				round: input.round,
				status: input.status,
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
		const key = `score-layangan:${input.competitionId}:${input.participantId}:${Date.now()}`;
		await enqueue(key, "/rest/scores/layangan", {
			competitionId: input.competitionId,
			participantId: input.participantId,
			round: input.round,
			status: input.status,
			recordedBy: input.recordedBy,
		});
		return { queued: true, id: key };
	}
}
