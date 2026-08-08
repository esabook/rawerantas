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

import { resetDemoHiasScores, submitHiasScore } from "$lib/db/hias";
import {
	resetDemoLayanganScores,
	submitLayanganResult,
} from "$lib/db/layangan";
import { getLeaderboardRows } from "$lib/db/leaderboard";
import { resetDemoMancingScores, submitMancingScore } from "$lib/db/scores";
import { demoCompetitions, demoParticipants } from "$lib/demo/generator";
import { setDemoMode } from "$lib/demo/store";

const mancing = demoCompetitions()[0];
const aduan = demoCompetitions()[1];
const hias = demoCompetitions()[2];

const participantOf = (competitionId: string, from: number) =>
	demoParticipants().find(
		(p) =>
			p.competitionId === competitionId && p.id.includes(String(100 + from)),
	) ?? demoParticipants().find((p) => p.competitionId === competitionId);

const mustParticipant = (competitionId: string, from: number) => {
	const p = participantOf(competitionId, from);
	if (!p) {
		throw new Error("peserta demo tidak ditemukan");
	}
	return p;
};

describe("getLeaderboardRows (demo)", () => {
	beforeEach(async () => {
		await setDemoMode(true);
		await resetDemoMancingScores();
		await resetDemoLayanganScores();
		await resetDemoHiasScores();
	});

	it("skor mancing lokal muncul bersama seed", async () => {
		const p = mustParticipant(mancing.id, 3);
		const before = (await getLeaderboardRows(mancing.id, "terberat")).length;
		await submitMancingScore({
			competitionId: mancing.id,
			participantId: p.id,
			fishWeightGram: 9000,
			isJackpot: false,
			recordedBy: "hash-juri",
		});
		const rows = await getLeaderboardRows(mancing.id, "terberat");
		expect(rows.length).toBe(before + 1);
		expect(
			rows.some((r) => r.participantId === p.id && r.weight === 9000),
		).toBe(true);
	});

	it("skor layangan lokal + hias lokal muncul", async () => {
		const pA = mustParticipant(aduan.id, 4);
		const pB = mustParticipant(hias.id, 5);
		await submitLayanganResult({
			competitionId: aduan.id,
			participantId: pA.id,
			round: 5,
			status: "menang",
			flightDurationMs: null,
			recordedBy: "hash-juri",
		});
		await submitHiasScore({
			competitionId: hias.id,
			participantId: pB.id,
			aesthetic: 90,
			stability: 90,
			creativity: 90,
			recordedBy: "hash-juri",
		});
		const aduanRows = await getLeaderboardRows(aduan.id, "layangan_aduan");
		expect(
			aduanRows.some((r) => r.participantId === pA.id && r.status === "menang"),
		).toBe(true);
		const hiasRows = await getLeaderboardRows(hias.id, "layangan_hias");
		const mine = hiasRows.find((r) => r.participantId === pB.id);
		expect(mine?.total_weighted).toBe(90);
	});
});
