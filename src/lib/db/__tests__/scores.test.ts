import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
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
import { demoMode, setDemoMode } from "$lib/demo/store";

const competitionId = demoCompetitions()[0].id;

const getParticipant = async () => {
	const rows = await getParticipants(competitionId);
	return rows.find((p) => p.lapakNumber === "7") ?? rows[0];
};

const readLocal = async (): Promise<MancingScoreRecord[]> => {
	const db = await new Promise<IDBDatabase>((resolve, reject) => {
		const req = indexedDB.open("rawerantas", 8);
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
	return new Promise((resolve, reject) => {
		const req = db
			.transaction("demo_scores_mancing")
			.objectStore("demo_scores_mancing")
			.getAll();
		req.onsuccess = () => resolve(req.result as MancingScoreRecord[]);
		req.onerror = () => reject(req.error);
	});
};

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
