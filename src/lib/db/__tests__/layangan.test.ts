import "fake-indexeddb/auto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("$env/static/public", () => ({
	PUBLIC_BASE_URL: "https://rawe.test",
	PUBLIC_APP_NAME: "Rawera 2026",
	PUBLIC_APP_YEAR: "2026",
	PUBLIC_EVENT_DATE: "2026-08-17T08:00:00Z",
	PUBLIC_ENABLE_DEMO_MODE: "true",
	PUBLIC_SUPABASE_URL: "",
	PUBLIC_SUPABASE_ANON_KEY: "",
	PUBLIC_ADMIN_PIN: "123456",
	PUBLIC_PANITIA_PIN: "123456",
	PUBLIC_JURI_PIN: "123456",
}));

/** Supabase tiruan untuk jalur live (QW-2/A25) — lihat catatan scores.test.ts. */
const sb = vi.hoisted(() => ({
	mode: "offline" as "offline" | "ok",
	nextId: "db-uuid-layang-1",
}));

vi.mock("$lib/db/supabaseClient", () => ({
	supabase: {
		removeAllChannels: () => {},
		from: () => ({
			insert: () => {
				if (sb.mode === "offline") {
					throw new TypeError("Failed to fetch");
				}
				return {
					select: () => ({
						single: async () => ({ data: { id: sb.nextId }, error: null }),
					}),
				};
			},
			select: () => ({
				eq: () => ({
					eq: () => ({
						order: async () => ({ data: [], error: null }),
					}),
				}),
			}),
		}),
	},
}));

import {
	getRoundResults,
	hasResult,
	removeLayanganScore,
	resetDemoLayanganScores,
	submitLayanganResult,
} from "$lib/db/layangan";
import { demoCompetitions, demoParticipants } from "$lib/demo/generator";
import { setDemoMode } from "$lib/demo/store";
import { clearQueue, markSynced, peekBatch } from "$lib/offline/queue";

const competitionId = demoCompetitions()[1].id;
const [pesertaAduan] = demoParticipants().filter(
	(p) => p.competitionId === competitionId,
);

describe("layangan score domain", () => {
	beforeEach(async () => {
		await setDemoMode(true);
		await resetDemoLayanganScores();
	});

	it("submit hasil demo → tercatat 1 row dengan status", async () => {
		const { id } = await submitLayanganResult({
			competitionId,
			participantId: pesertaAduan.id,
			round: 3,
			status: "menang",
			flightDurationMs: null,
			recordedBy: "hash-juri",
		});
		expect(id).toBeTruthy();
		const rows = await getRoundResults(competitionId, 3);
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			status: "menang",
			flightDurationMs: null,
			recordedBy: "hash-juri",
		});
	});

	it("hasResult false sebelum submit, true setelah (round beda tidak tercampur)", async () => {
		expect(await hasResult(competitionId, pesertaAduan.id, 2)).toBe(false);
		await submitLayanganResult({
			competitionId,
			participantId: pesertaAduan.id,
			round: 2,
			status: "putus",
			flightDurationMs: null,
			recordedBy: "hash-juri",
		});
		expect(await hasResult(competitionId, pesertaAduan.id, 2)).toBe(true);
		expect(await hasResult(competitionId, pesertaAduan.id, 3)).toBe(false);
	});

	it("undo hapus record demo", async () => {
		const { id } = await submitLayanganResult({
			competitionId,
			participantId: pesertaAduan.id,
			round: 3,
			status: "menang",
			flightDurationMs: null,
			recordedBy: "hash-juri",
		});
		await removeLayanganScore(id, false);
		expect(await getRoundResults(competitionId, 3)).toHaveLength(0);
	});

	it("reset membersihkan semua hasil demo", async () => {
		await submitLayanganResult({
			competitionId,
			participantId: pesertaAduan.id,
			round: 3,
			status: "menang",
			flightDurationMs: null,
			recordedBy: "hash-juri",
		});
		await resetDemoLayanganScores();
		expect(await getRoundResults(competitionId, 3)).toHaveLength(0);
	});
});

describe("submitLayanganResult live + undo antrean (QW-2/A25)", () => {
	const INPUT = {
		competitionId,
		participantId: pesertaAduan.id,
		round: 1,
		status: "menang" as const,
		flightDurationMs: 61_000,
		recordedBy: "hash-juri",
	};

	beforeEach(async () => {
		sb.mode = "offline";
		await clearQueue();
		await setDemoMode(false);
	});

	afterAll(async () => {
		await clearQueue();
		await setDemoMode(true);
	});

	it("submit offline → queued, id = UUID idempotensi (kunci antrean == payload.idempotencyKey)", async () => {
		const res = await submitLayanganResult(INPUT);
		expect(res.queued).toBe(true);
		const entries = await peekBatch(10);
		expect(entries).toHaveLength(1);
		expect(entries[0]?.idempotencyKey).toBe(res.id);
		expect(entries[0]?.payload).toMatchObject({ idempotencyKey: res.id });
	});

	it("undo saat masih pending → entri antrean terhapus, tanpa tombstone", async () => {
		const res = await submitLayanganResult(INPUT);
		await removeLayanganScore(res.id, res.queued);
		expect(await peekBatch(10)).toHaveLength(0);
	});

	it("undo setelah entri ter-drain → tombstone delete via idempotency_key", async () => {
		const res = await submitLayanganResult(INPUT);
		await markSynced(res.id); // simulasi: drain selesai sebelum undo
		await removeLayanganScore(res.id, res.queued);
		const entries = await peekBatch(10);
		expect(entries).toHaveLength(1);
		expect(entries[0]).toMatchObject({
			endpoint: "/rest/scores/layangan/delete",
			payload: { idempotencyKey: res.id },
		});
	});

	it("undo skor live (insert sukses) → tombstone tetap via scoreId", async () => {
		sb.mode = "ok";
		const res = await submitLayanganResult(INPUT);
		expect(res.queued).toBe(false);
		expect(res.id).toBe("db-uuid-layang-1");
		await removeLayanganScore(res.id, res.queued);
		const entries = await peekBatch(10);
		expect(entries).toHaveLength(1);
		expect(entries[0]).toMatchObject({
			endpoint: "/rest/scores/layangan/delete",
			payload: { scoreId: "db-uuid-layang-1" },
		});
	});
});
