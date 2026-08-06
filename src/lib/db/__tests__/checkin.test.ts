import "fake-indexeddb/auto";
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

const DISQ_ID = "disq-0000-0000-0000-000000000000";

vi.mock("$lib/db/queries", async (importOriginal) => {
	const actual = await importOriginal<typeof import("$lib/db/queries")>();
	return {
		...actual,
		getParticipantById: async (id: string) => {
			if (id === DISQ_ID) {
				return {
					id: DISQ_ID,
					competitionId: "c1",
					ticketNumber: "RA-2026-DISQ",
					lapakNumber: "0",
					name: "Peserta Diskualifikasi",
					phone: "6281000000000",
					status: "disqualified",
					createdAt: new Date(),
				};
			}
			return actual.getParticipantById(id);
		},
	};
});

import {
	CheckinError,
	checkInParticipant,
	findParticipantByTicket,
	getCheckinSummary,
	resetDemoCheckins,
} from "$lib/db/checkin";
import { demoParticipants } from "$lib/demo/generator";
import { demoMode, setDemoMode } from "$lib/demo/store";

const dpPaid = demoParticipants().find((p) => p.status === "dp_paid");
const registered = demoParticipants().find((p) => p.status === "registered");
if (!dpPaid || !registered) {
	throw new Error("peserta demo tidak ditemukan");
}
const fullyPaid = demoParticipants().find((p) => p.status === "fully_paid");
if (!fullyPaid) {
	throw new Error("peserta fully_paid demo tidak ditemukan");
}

describe("checkin domain", () => {
	beforeEach(async () => {
		await setDemoMode(true);
		await resetDemoCheckins();
	});

	it("ringkasan: status seed + sisa bayar", async () => {
		const summary = await getCheckinSummary(fullyPaid.id);
		expect(summary.status).toBe("fully_paid");
		expect(summary.remaining).toBeGreaterThanOrEqual(0);
		expect(summary.participant.ticketNumber).toMatch(/^RA-2026-/);
		expect(summary.competitionName).toBeTruthy();
	});

	it("check-in peserta dp_paid → ok + status berubah + persist", async () => {
		const { eligibility } = await checkInParticipant(dpPaid.id);
		expect(eligibility).toBe("ok");
		const after = await getCheckinSummary(dpPaid.id);
		expect(after.status).toBe("checked_in");
		expect(after.checkedInAt).not.toBeNull();
	});

	it("check-in ulang → idempotent (already, bukan error)", async () => {
		await checkInParticipant(dpPaid.id);
		const { eligibility } = await checkInParticipant(dpPaid.id);
		expect(eligibility).toBe("already");
	});

	it("peserta registered (tanpa DP) → ditolak", async () => {
		await expect(checkInParticipant(registered.id)).rejects.toThrow(
			CheckinError,
		);
		await expect(checkInParticipant(registered.id)).rejects.toThrow(
			"minimal DP",
		);
	});

	it("peserta disqualified → diblokir", async () => {
		await expect(checkInParticipant(DISQ_ID)).rejects.toThrow(CheckinError);
		await expect(checkInParticipant(DISQ_ID)).rejects.toThrow(
			"didiskualifikasi",
		);
	});

	it("cari peserta via nomor tiket (manual entry)", async () => {
		const found = await findParticipantByTicket(fullyPaid.ticketNumber);
		expect(found?.id).toBe(fullyPaid.id);
		const missing = await findParticipantByTicket("RA-2026-999");
		expect(missing).toBeNull();
	});
});
