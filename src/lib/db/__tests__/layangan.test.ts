import { beforeEach, describe, expect, it, vi } from "vitest";

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

import {
	getRoundResults,
	hasResult,
	removeLayanganScore,
	resetDemoLayanganScores,
	submitLayanganResult,
} from "$lib/db/layangan";
import { demoCompetitions, demoParticipants } from "$lib/demo/generator";
import { setDemoMode } from "$lib/demo/store";

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
