import "fake-indexeddb/auto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { localGetAll, localStores } from "$lib/db/localStore";
import { getParticipants } from "$lib/db/queries";
import {
	hasJackpot,
	InvalidWeightError,
	type MancingScoreRecord,
	removeScore,
	resetDemoMancingScores,
	submitMancingScore,
	validateWeight,
} from "$lib/db/scores";
import { demoCompetitions } from "$lib/demo/generator";
import { setDemoMode } from "$lib/demo/store";
import { clearQueue, markSynced, peekBatch } from "$lib/offline/queue";

/** Supabase tiruan: mode offline melempar TypeError (jalur antrean), mode ok
 * mengembalikan id baris. `removeAllChannels` ada karena setDemoMode(false)
 * memicu teardownRealtime(). */
const sb = vi.hoisted(() => ({
	mode: "offline" as "offline" | "ok",
	inserts: [] as Array<{ table: string; row: Record<string, unknown> }>,
	nextId: "db-uuid-1",
}));

vi.mock("$lib/db/supabaseClient", () => ({
	supabase: {
		removeAllChannels: () => {},
		from: (table: string) => ({
			insert: (row: Record<string, unknown>) => {
				sb.inserts.push({ table, row });
				if (sb.mode === "offline") {
					throw new TypeError("Failed to fetch");
				}
				return {
					select: () => ({
						single: async () => ({ data: { id: sb.nextId }, error: null }),
					}),
				};
			},
		}),
	},
}));

const competitionId = demoCompetitions()[0].id;

const getParticipant = async () => {
	const rows = await getParticipants(competitionId);
	return rows.find((p) => p.lapakNumber === "7") ?? rows[0];
};

const readLocal = (): Promise<MancingScoreRecord[]> =>
	localGetAll<MancingScoreRecord>(localStores.scoresMancing);

describe("validateWeight", () => {
	it("menolak timbangan ≤ 0", () => {
		expect(() => validateWeight(0)).toThrow(InvalidWeightError);
		expect(() => validateWeight(-5)).toThrow(InvalidWeightError);
		expect(() => validateWeight(Number.NaN)).toThrow(InvalidWeightError);
	});

	it("menerima timbangan positif", () => {
		expect(validateWeight(12_500)).toBe(12_500);
		expect(validateWeight(250)).toBe(250);
	});
});

describe("submitMancingScore (demo)", () => {
	beforeEach(async () => {
		await setDemoMode(true);
		await resetDemoMancingScores();
	});
	it("menyimpan skor baru sekali (submit ganda → 1 row)", async () => {
		const p = await getParticipant();
		const input = {
			competitionId,
			participantId: p.id,
			fishWeightGram: 10_000,
			isJackpot: false,
			recordedBy: "hash-juri",
		};
		await submitMancingScore(input);
		await submitMancingScore(input);
		const rows = await readLocal();
		expect(rows.filter((r) => r.participantId === p.id)).toHaveLength(2);
		const all = await readLocal();
		expect(all.length).toBe(2);
	});
	it("mendeteksi jackpot duplikat (seed maupun lokal)", async () => {
		const p = await getParticipant();
		const hasSeed = await hasJackpot(competitionId, p.id);
		expect(typeof hasSeed).toBe("boolean");
		await submitMancingScore({
			competitionId,
			participantId: p.id,
			fishWeightGram: 8_000,
			isJackpot: true,
			recordedBy: "hash-juri",
		});
		expect(await hasJackpot(competitionId, p.id)).toBe(true);
	});
	it("removeScore menghapus skor lokal (undo)", async () => {
		const p = await getParticipant();
		const res = await submitMancingScore({
			competitionId,
			participantId: p.id,
			fishWeightGram: 5_000,
			isJackpot: false,
			recordedBy: "hash-juri",
		});
		expect((await readLocal()).length).toBe(1);
		await removeScore(res.id, res.queued);
		expect((await readLocal()).length).toBe(0);
	});
});

describe("submitMancingScore live + undo antrean (QW-2/A25)", () => {
	const INPUT = {
		competitionId,
		participantId: "peserta-1",
		fishWeightGram: 2_500,
		isJackpot: false,
		recordedBy: "hash-juri",
	};

	beforeEach(async () => {
		sb.mode = "offline";
		sb.inserts.length = 0;
		await clearQueue();
		await setDemoMode(false);
	});

	afterAll(async () => {
		await clearQueue();
		await setDemoMode(true);
	});

	it("submit offline → queued, id = UUID idempotensi (kunci antrean == payload.idempotencyKey)", async () => {
		const res = await submitMancingScore(INPUT);
		expect(res.queued).toBe(true);
		expect(sb.inserts).toHaveLength(1);
		const entries = await peekBatch(10);
		expect(entries).toHaveLength(1);
		expect(entries[0]?.idempotencyKey).toBe(res.id);
		expect(entries[0]?.payload).toMatchObject({ idempotencyKey: res.id });
	});

	it("undo saat masih pending → entri antrean terhapus, tanpa tombstone", async () => {
		const res = await submitMancingScore(INPUT);
		await removeScore(res.id, res.queued);
		expect(await peekBatch(10)).toHaveLength(0);
	});

	it("undo setelah entri ter-drain → tombstone delete via idempotency_key", async () => {
		const res = await submitMancingScore(INPUT);
		await markSynced(res.id); // simulasi: drain selesai sebelum undo
		await removeScore(res.id, res.queued);
		const entries = await peekBatch(10);
		expect(entries).toHaveLength(1);
		expect(entries[0]).toMatchObject({
			endpoint: "/rest/scores/mancing/delete",
			payload: { idempotencyKey: res.id },
		});
	});

	it("undo skor live (insert sukses) → tombstone tetap via scoreId", async () => {
		sb.mode = "ok";
		const res = await submitMancingScore(INPUT);
		expect(res.queued).toBe(false);
		expect(res.id).toBe("db-uuid-1");
		await removeScore(res.id, res.queued);
		const entries = await peekBatch(10);
		expect(entries).toHaveLength(1);
		expect(entries[0]).toMatchObject({
			endpoint: "/rest/scores/mancing/delete",
			payload: { scoreId: "db-uuid-1" },
		});
	});
});
