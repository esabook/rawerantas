import { beforeEach, describe, expect, it, vi } from "vitest";

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
		setDemoMode(true);
	});

	it("demo ON: helper mengembalikan data lokal tanpa panggilan Supabase", async () => {
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
		setDemoMode(false);
		await expect(getCompetitions()).rejects.toThrow();
	});
});

describe("demo — store & realtime teardown", () => {
	it("toggle flip + teardown channel saat berubah", () => {
		setDemoMode(true);
		vi.mocked(supabase.removeAllChannels).mockClear();
		toggleDemoMode();
		expect(get(demoMode)).toBe(false);
		expect(supabase.removeAllChannels).toHaveBeenCalledTimes(1);
		toggleDemoMode();
		expect(get(demoMode)).toBe(true);
		expect(supabase.removeAllChannels).toHaveBeenCalledTimes(2);
	});

	it("set nilai sama → tanpa teardown", () => {
		setDemoMode(true);
		vi.mocked(supabase.removeAllChannels).mockClear();
		setDemoMode(true);
		expect(supabase.removeAllChannels).not.toHaveBeenCalled();
	});

	it("teardownRealtime memanggil removeAllChannels", () => {
		vi.mocked(supabase.removeAllChannels).mockClear();
		teardownRealtime();
		expect(supabase.removeAllChannels).toHaveBeenCalledTimes(1);
	});
});
