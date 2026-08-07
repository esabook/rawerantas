import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("$env/static/public", () => ({
	PUBLIC_SUPABASE_URL: "https://mock.supabase.co",
	PUBLIC_SUPABASE_ANON_KEY: "anon-key",
	PUBLIC_APP_NAME: "Lomba",
	PUBLIC_APP_YEAR: "2026",
	PUBLIC_BASE_URL: "",
	PUBLIC_EVENT_DATE: "",
	PUBLIC_JURI_PIN: "",
	PUBLIC_ADMIN_PIN: "",
	PUBLIC_ENABLE_DEMO_MODE: "true",
}));

vi.mock("../supabaseClient", () => ({
	supabase: { from: vi.fn(), removeAllChannels: vi.fn() },
}));

import { get } from "svelte/store";
import {
	demoCompetitions,
	demoMancingScores,
	demoParticipants,
	SEED,
} from "$lib/demo/generator";
import {
	demoMode,
	setDemoMode,
	teardownRealtime,
	toggleDemoMode,
} from "$lib/demo/store";
import {
	getCompetitions,
	getLeaderboard,
	getParticipants,
	getPayments,
} from "../queries";
import { supabase } from "../supabaseClient";

describe("demo — determinisme", () => {
	it("generator seeded: dua pemanggilan sama", () => {
		expect(SEED).toBe(17082026);
		expect(demoCompetitions()).toEqual(demoCompetitions());
		expect(demoParticipants()).toEqual(demoParticipants());
		expect(demoMancingScores()).toEqual(demoMancingScores());
	});

	it("50 peserta, lapak unik, tiket unik", () => {
		const participants = demoParticipants();
		expect(participants).toHaveLength(50);
		const lapaks = new Set(participants.map((p) => p.lapakNumber));
		const tickets = new Set(participants.map((p) => p.ticketNumber));
		expect(lapaks.size).toBe(50);
		expect(tickets.size).toBe(50);
	});
});

describe("demo — query intercept", () => {
	beforeEach(() => {
		vi.mocked(supabase.from).mockClear();
		vi.mocked(supabase.removeAllChannels).mockClear();
		demoMode.set(false);
	});

	it("demo ON: helper mengembalikan data lokal tanpa panggilan Supabase", async () => {
		await setDemoMode(true);
		const competitions = await getCompetitions();
		const participants = await getParticipants();
		const payments = await getPayments();
		const leaderboard = await getLeaderboard(
			competitions[0].id,
			"scores_mancing",
		);
		expect(competitions).toHaveLength(3);
		expect(participants).toHaveLength(50);
		expect(payments.length).toBeGreaterThan(0);
		expect(leaderboard.length).toBeGreaterThan(0);
		expect(supabase.from).not.toHaveBeenCalled();
	});

	it("demo OFF: toggle mengembalikan mode live (bukan intercept)", async () => {
		await setDemoMode(false);
		await expect(getCompetitions()).rejects.toThrow();
	});
});

describe("demo — store & realtime teardown", () => {
	beforeEach(() => {
		demoMode.set(false);
		vi.mocked(supabase.removeAllChannels).mockClear();
	});

	it("toggle flip + teardown channel saat berubah", async () => {
		await setDemoMode(true);
		vi.mocked(supabase.removeAllChannels).mockClear();
		await toggleDemoMode();
		expect(get(demoMode)).toBe(false);
		expect(supabase.removeAllChannels).toHaveBeenCalledTimes(1);
		await toggleDemoMode();
		expect(get(demoMode)).toBe(true);
		expect(supabase.removeAllChannels).toHaveBeenCalledTimes(2);
	});

	it("set nilai sama → tanpa teardown", async () => {
		await setDemoMode(true);
		vi.mocked(supabase.removeAllChannels).mockClear();
		await setDemoMode(true);
		expect(supabase.removeAllChannels).not.toHaveBeenCalled();
	});

	it("teardownRealtime memanggil removeAllChannels", async () => {
		await teardownRealtime();
		expect(supabase.removeAllChannels).toHaveBeenCalledTimes(1);
	});
});
