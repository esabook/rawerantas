import { get } from "svelte/store";
import { demoHiasScores } from "$lib/demo/generator";
import { demoMode } from "$lib/demo/store";
import { DB_VERSION, ensureAllStores } from "$lib/offline/idbSchema";
import { enqueue } from "$lib/offline/queue";

const DB_NAME = "rawerantas";
const STORE = "demo_scores_hias";

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

export const HIAS_EDIT_WINDOW_MS = 5 * 60 * 1000;

export interface HiasScoreRecord {
	participantId: string;
	competitionId: string;
	aesthetic: number;
	stability: number;
	creativity: number;
	totalWeighted: number;
	recordedBy: string;
	idempotencyKey: string;
	receivedAt: Date;
	editedAt: Date | null;
}

export interface HiasScoreInput {
	competitionId: string;
	participantId: string;
	aesthetic: number;
	stability: number;
	creativity: number;
	recordedBy: string;
}

export interface HiasScoreResult {
	queued: boolean;
	participantId: string;
}

export function validateCriteria(n: number): number {
	if (!Number.isInteger(n) || n < 0 || n > 100) {
		throw new Error("Nilai kriteria harus 0–100.");
	}
	return n;
}

export function computeHiasTotal(
	aesthetic: number,
	stability: number,
	creativity: number,
): number {
	return Math.round(aesthetic * 0.4 + stability * 0.4 + creativity * 0.2);
}

/** true bila record masih bisa diedit dalam jendela 5 menit (dari edited_at / received_at). */
export function isWithinEditWindow(record: HiasScoreRecord): boolean {
	const base = record.editedAt ?? record.receivedAt;
	return Date.now() - base.getTime() < HIAS_EDIT_WINDOW_MS;
}

export async function resetDemoHiasScores(): Promise<void> {
	const db = await getDb();
	await new Promise<void>((resolve, reject) => {
		const tx = db.transaction(STORE, "readwrite");
		tx.objectStore(STORE).clear();
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
}

async function localScores(): Promise<HiasScoreRecord[]> {
	const db = await getDb();
	return new Promise((resolve, reject) => {
		const req = db.transaction(STORE).objectStore(STORE).getAll();
		req.onsuccess = () => resolve((req.result as HiasScoreRecord[]) ?? []);
		req.onerror = () => reject(req.error);
	});
}

/**
 * Semua skor hias (lokal menang atas seed per peserta) — untuk leaderboard.
 */
export async function getAllHiasScores(
	competitionId: string,
): Promise<HiasScoreRecord[]> {
	const local = await localScores();
	const localByParticipant = new Map(local.map((s) => [s.participantId, s]));
	const merged = demoHiasScores()
		.filter((s) => s.competitionId === competitionId)
		.map((s) => {
			const override = localByParticipant.get(s.participantId);
			return override ?? (s as unknown as HiasScoreRecord);
		});
	const localOnly = local.filter(
		(s) =>
			s.competitionId === competitionId &&
			!demoHiasScores().some((seed) => seed.participantId === s.participantId),
	);
	return [...localOnly, ...merged];
}

/**
 * Skor hias peserta (lokal menang atas seed — hias 1 skor final per peserta,
 * submit lokal = versi terbaru).
 */
export async function getHiasScore(
	competitionId: string,
	participantId: string,
): Promise<HiasScoreRecord | null> {
	const local = await localScores();
	const fromLocal = local.find(
		(s) =>
			s.competitionId === competitionId && s.participantId === participantId,
	);
	if (fromLocal) {
		return fromLocal;
	}
	const seeded = demoHiasScores().find(
		(s) =>
			s.competitionId === competitionId && s.participantId === participantId,
	);
	return seeded ? (seeded as unknown as HiasScoreRecord) : null;
}

export async function saveLocal(record: HiasScoreRecord): Promise<void> {
	const db = await getDb();
	await new Promise<void>((resolve, reject) => {
		const tx = db.transaction(STORE, "readwrite");
		tx.objectStore(STORE).put(record);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
}

/**
 * Simpan/rescore skor hias. Submit ganda → 1 row (upsert per peserta).
 * Edit luar jendela 5 menit → tolak + catat audit (console.warn).
 */
export async function submitHiasScore(
	input: HiasScoreInput,
): Promise<HiasScoreResult> {
	const aesthetic = validateCriteria(input.aesthetic);
	const stability = validateCriteria(input.stability);
	const creativity = validateCriteria(input.creativity);
	const existing = await getHiasScore(input.competitionId, input.participantId);
	if (existing && !isWithinEditWindow(existing)) {
		console.warn(
			`hias-audit: rescore ditolak di luar jendela edit — participant=${input.participantId} at=${new Date().toISOString()}`,
		);
		throw new Error("Jendela edit 5 menit telah berlalu. Rescore ditolak.");
	}
	const totalWeighted = computeHiasTotal(aesthetic, stability, creativity);
	if (get(demoMode)) {
		const record: HiasScoreRecord = {
			participantId: input.participantId,
			competitionId: input.competitionId,
			aesthetic,
			stability,
			creativity,
			totalWeighted,
			recordedBy: input.recordedBy,
			idempotencyKey: existing?.idempotencyKey ?? crypto.randomUUID(),
			receivedAt: existing?.receivedAt ?? new Date(),
			editedAt: existing ? new Date() : null,
		};
		await saveLocal(record);
		return { queued: false, participantId: record.participantId };
	}
	try {
		const { supabase } = await import("./supabaseClient");
		if (existing) {
			const { error } = await supabase
				.from("scores_layangan_hias")
				.update({
					aesthetic,
					stability,
					creativity,
					total_weighted: totalWeighted,
					edited_at: new Date().toISOString(),
					recorded_by: input.recordedBy,
				})
				.eq("participant_id", input.participantId)
				.eq("competition_id", input.competitionId);
			if (error) {
				throw error;
			}
			return { queued: false, participantId: input.participantId };
		}
		const { data, error } = await supabase
			.from("scores_layangan_hias")
			.insert({
				competition_id: input.competitionId,
				participant_id: input.participantId,
				aesthetic,
				stability,
				creativity,
				recorded_by: input.recordedBy,
				idempotency_key: crypto.randomUUID(),
			})
			.select("id")
			.single();
		if (error) {
			throw error;
		}
		return { queued: false, participantId: input.participantId };
	} catch {
		await enqueue(
			`score-hias:${input.competitionId}:${input.participantId}`,
			"/rest/scores/layangan-hias",
			{
				competitionId: input.competitionId,
				participantId: input.participantId,
				aesthetic,
				stability,
				creativity,
				recordedBy: input.recordedBy,
			},
		);
		return { queued: true, participantId: input.participantId };
	}
}
