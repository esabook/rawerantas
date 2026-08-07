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
	advanceRound,
	resetDemoAdminState,
	saveCompetition,
	savePaymentConfig,
} from "$lib/db/admin";
import { getCompetitions, getPaymentConfigs } from "$lib/db/queries";
import { demoCompetitions, demoPaymentConfigs } from "$lib/demo/generator";
import { setDemoMode } from "$lib/demo/store";

const mancing = demoCompetitions()[0];
const aduan = demoCompetitions()[1];
const qris = demoPaymentConfigs().find((c) => c.method === "qris");
if (!qris) {
	throw new Error("seed qris tidak ada");
}

describe("admin domain", () => {
	beforeEach(async () => {
		await setDemoMode(true);
		await resetDemoAdminState();
	});

	it("saveCompetition → getCompetitions merge override", async () => {
		await saveCompetition({ ...mancing, fee: 75000 });
		const comps = await getCompetitions(false);
		expect(comps.find((c) => c.id === mancing.id)?.fee).toBe(75000);
	});

	it("savePaymentConfig toggle non-aktif → tidak muncul di getPaymentConfigs(true)", async () => {
		await savePaymentConfig({ ...qris, isActive: false });
		const all = await getPaymentConfigs(false);
		expect(all.find((c) => c.id === qris.id)?.isActive).toBe(false);
		const active = await getPaymentConfigs(true);
		expect(active.some((c) => c.id === qris.id)).toBe(false);
	});

	it("advance round hanya mode aduan layangan", async () => {
		await expect(advanceRound(mancing.id)).rejects.toThrow(
			"hanya untuk mode aduan",
		);
	});

	it("advance round aduan → current_round +1 dan terlihat via getCompetitions", async () => {
		const before = aduan.currentRound;
		const { round } = await advanceRound(aduan.id);
		expect(round).toBe(before + 1);
		const comps = await getCompetitions(false);
		expect(comps.find((c) => c.id === aduan.id)?.currentRound).toBe(before + 1);
	});

	it("reset membersihkan override", async () => {
		await saveCompetition({ ...mancing, fee: 90000 });
		await resetDemoAdminState();
		const comps = await getCompetitions(false);
		expect(comps.find((c) => c.id === mancing.id)?.fee).toBe(mancing.fee);
	});
});
