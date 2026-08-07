import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("$env/static/public", () => ({
	PUBLIC_BASE_URL: "https://rawe.test",
	PUBLIC_APP_NAME: "Rawera 2026",
	PUBLIC_APP_YEAR: "2026",
	PUBLIC_EVENT_DATE: "2026-08-17T08:00:00Z",
	PUBLIC_ENABLE_DEMO_MODE: "true",
	PUBLIC_SUPABASE_URL: "",
	PUBLIC_SUPABASE_ANON_KEY: "",
	PUBLIC_ADMIN_PIN: "1234",
	PUBLIC_JURI_PIN: "1234",
}));

import {
	computeHiasTotal,
	getHiasScore,
	resetDemoHiasScores,
	submitHiasScore,
	validateCriteria,
} from "$lib/db/hias";
import { demoCompetitions, demoParticipants } from "$lib/demo/generator";
import { setDemoMode } from "$lib/demo/store";

const competitionId = demoCompetitions()[2].id;
const hiasParticipants = demoParticipants().filter(
	(p) => p.competitionId === competitionId,
);

describe("hias score domain", () => {
	beforeEach(async () => {
		await setDemoMode(true);
		await resetDemoHiasScores();
	});

	it("bobot total_weighted = a*0.4 + s*0.4 + k*0.2", () => {
		expect(computeHiasTotal(80, 80, 100)).toBe(84);
		expect(computeHiasTotal(100, 100, 100)).toBe(100);
		expect(computeHiasTotal(0, 50, 100)).toBe(40);
	});

	it("kriteria di luar 0–100 ditolak", () => {
		expect(() => validateCriteria(101)).toThrow();
		expect(() => validateCriteria(-1)).toThrow();
		expect(() => validateCriteria(50.5)).toThrow();
		expect(validateCriteria(0)).toBe(0);
	});

	it("submit ganda → 1 row (upsert per peserta)", async () => {
		const p = hiasParticipants[8];
		await submitHiasScore({
			competitionId,
			participantId: p.id,
			aesthetic: 70,
			stability: 80,
			creativity: 90,
			recordedBy: "hash-juri",
		});
		await submitHiasScore({
			competitionId,
			participantId: p.id,
			aesthetic: 75,
			stability: 85,
			creativity: 95,
			recordedBy: "hash-juri",
		});
		const score = await getHiasScore(competitionId, p.id);
		expect(score).not.toBeNull();
		expect(score?.aesthetic).toBe(75);
		expect(score?.stability).toBe(85);
		expect(score?.totalWeighted).toBe(83);
		expect(score?.editedAt).not.toBeNull();
	});

	it("edit window 5 menit: rescore luar window ditolak, dalam window diizinkan", async () => {
		const p = hiasParticipants[8];
		await submitHiasScore({
			competitionId,
			participantId: p.id,
			aesthetic: 70,
			stability: 80,
			creativity: 90,
			recordedBy: "hash-juri",
		});
		const score = await getHiasScore(competitionId, p.id);
		expect(score).not.toBeNull();
		if (!score) {
			throw new Error("skor tidak ditemukan");
		}
		score.receivedAt = new Date(Date.now() - 6 * 60 * 1000);
		score.editedAt = new Date(Date.now() - 6 * 60 * 1000);
		const { saveLocal } = await import("$lib/db/hias");
		await saveLocal(score);
		await expect(
			submitHiasScore({
				competitionId,
				participantId: p.id,
				aesthetic: 99,
				stability: 99,
				creativity: 99,
				recordedBy: "hash-juri",
			}),
		).rejects.toThrow("Jendela edit 5 menit telah berlalu");
		score.receivedAt = new Date();
		score.editedAt = null;
		await saveLocal(score);
		await expect(
			submitHiasScore({
				competitionId,
				participantId: p.id,
				aesthetic: 99,
				stability: 99,
				creativity: 99,
				recordedBy: "hash-juri",
			}),
		).resolves.toMatchObject({ queued: false });
	});
});
