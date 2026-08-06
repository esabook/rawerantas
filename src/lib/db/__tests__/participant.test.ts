import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { getParticipantById } from "$lib/db/queries";
import { registerParticipant, resetDemoRegistrations } from "$lib/db/register";
import { demoCompetitions } from "$lib/demo/generator";
import { demoMode, setDemoMode } from "$lib/demo/store";

describe("getParticipantById (demo)", () => {
	beforeEach(async () => {
		await setDemoMode(true);
		await resetDemoRegistrations();
	});
	it("menemukan peserta seed", async () => {
		const seeded = demoCompetitions();
		expect(seeded.length).toBeGreaterThan(0);
		const { getParticipants } = await import("$lib/db/queries");
		const all = await getParticipants();
		expect(all.length).toBeGreaterThan(0);
		const p = await getParticipantById(all[0].id);
		expect(p?.id).toBe(all[0].id);
	});

	it("menemukan peserta yang baru didaftarkan", async () => {
		const res = await registerParticipant({
			competitionId: demoCompetitions()[0].id,
			name: "Cicak",
			phone: "081234567890",
		});
		const p = await getParticipantById(res.participantId);
		expect(p?.name).toBe("Cicak");
		expect(p?.ticketNumber).toBe(res.ticketNumber);
	});

	it("mengembalikan null untuk id tak dikenal", async () => {
		expect(await getParticipantById("tidak-ada")).toBeNull();
	});
});
