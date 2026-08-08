import { get } from "svelte/store";
import { demoLayanganScores } from "$lib/demo/generator";
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

const STORE = localStores.scoresLayangan;

export type LayanganStatus = "menang" | "putus";

export interface LayanganScoreRecord {
	id: string;
	competitionId: string;
	participantId: string;
	round: number;
	status: LayanganStatus;
	flightDurationMs: number | null;
	receivedAt: Date;
	idempotencyKey: string;
	recordedBy: string;
}

export interface LayanganScoreInput {
	competitionId: string;
	participantId: string;
	round: number;
	status: LayanganStatus;
	flightDurationMs: number | null;
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
	if (!get(demoMode)) {
		const { getSupabase, normalizeLayanganScoreRow } = await import(
			"./queries"
		);
		const { supabase } = await getSupabase();
		const { data, error } = await supabase
			.from("scores_layangan")
			.select("*")
			.eq("competition_id", competitionId)
			.order("received_at", { ascending: true });
		if (error) {
			throw new Error(`getAllLayanganScores: ${error.message}`);
		}
		return (data ?? []).map((row) =>
			normalizeLayanganScoreRow(row as Record<string, unknown>),
		) as LayanganScoreRecord[];
	}
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
	if (!get(demoMode)) {
		const { getSupabase, normalizeLayanganScoreRow } = await import(
			"./queries"
		);
		const { supabase } = await getSupabase();
		const { data, error } = await supabase
			.from("scores_layangan")
			.select("*")
			.eq("competition_id", competitionId)
			.eq("round", round)
			.order("received_at", { ascending: true });
		if (error) {
			throw new Error(`getRoundResults: ${error.message}`);
		}
		return (data ?? []).map((row) =>
			normalizeLayanganScoreRow(row as Record<string, unknown>),
		) as LayanganScoreRecord[];
	}
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
	actorHash?: string,
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
		// kolom itu via RPC delete_score (B1-7).
		await enqueue(
			`score-layangan-delete:${id}`,
			"/rest/scores/layangan/delete",
			{
				idempotencyKey: id,
				actorHash,
			},
		);
		return;
	}
	await enqueue(`score-layangan-delete:${id}`, "/rest/scores/layangan/delete", {
		scoreId: id,
		actorHash,
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
			flightDurationMs: input.flightDurationMs,
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
			.from("scores_layangan")
			.insert({
				competition_id: input.competitionId,
				participant_id: input.participantId,
				round: input.round,
				status: input.status,
				flight_duration_ms: input.flightDurationMs,
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
		await enqueue(idempotencyKey, "/rest/scores/layangan", {
			competitionId: input.competitionId,
			participantId: input.participantId,
			round: input.round,
			status: input.status,
			flightDurationMs: input.flightDurationMs,
			recordedBy: input.recordedBy,
			idempotencyKey,
		});
		return { queued: true, id: idempotencyKey };
	}
}
