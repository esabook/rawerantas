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

import { rejectPayment } from "$lib/db/admin";
import {
	CheckinError,
	checkInParticipant,
	findParticipantByTicket,
	getCheckinStats,
	getCheckinSummary,
	resetDemoCheckins,
} from "$lib/db/checkin";
import { resetDemoPayments, submitPayment } from "$lib/db/payment";
import { registerParticipant, resetDemoRegistrations } from "$lib/db/register";
import { demoCompetitions, demoParticipants } from "$lib/demo/generator";
import { setDemoMode } from "$lib/demo/store";

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
		await resetDemoPayments();
		await resetDemoRegistrations();
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

	it("statistik menghitung peserta terdaftar dan sisa belum check-in", async () => {
		const before = await getCheckinStats();
		await checkInParticipant(dpPaid.id);
		const after = await getCheckinStats();

		expect(after.registered).toBe(before.registered);
		expect(after.checkedIn).toBe(before.checkedIn + 1);
		expect(after.remaining).toBe(before.remaining - 1);
	});

	it("statistik dan pencarian dapat difilter berdasarkan lomba", async () => {
		const competition = demoCompetitions()[0];
		const participantInCompetition = demoParticipants().find(
			(p) => p.competitionId === competition.id,
		);
		const participantInOtherCompetition = demoParticipants().find(
			(p) => p.competitionId !== competition.id,
		);
		if (!participantInCompetition || !participantInOtherCompetition) {
			throw new Error("peserta untuk test filter tidak ditemukan");
		}

		const stats = await getCheckinStats(competition.id);
		expect(stats.registered).toBe(
			demoParticipants().filter((p) => p.competitionId === competition.id)
				.length,
		);
		expect(
			await findParticipantByTicket(
				participantInCompetition.ticketNumber,
				competition.id,
			),
		).not.toBeNull();
		expect(
			await findParticipantByTicket(
				participantInOtherCompetition.ticketNumber,
				competition.id,
			),
		).toBeNull();
	});

	it("pembayaran tertolak tidak dihitung dan tidak bisa masuk dari pencarian", async () => {
		const competition = demoCompetitions()[0];
		const registration = await registerParticipant({
			competitionId: competition.id,
			name: "Peserta Tertolak",
			phone: "081234567899",
		});
		await submitPayment(
			{
				participantId: registration.participantId,
				competitionId: competition.id,
				method: "qris",
				amount: 25_000,
				proofBlob: null,
				isCash: false,
			},
			"dp",
			competition,
		);
		const { getPayments } = await import("$lib/db/queries");
		const payment = (await getPayments(registration.participantId))[0];
		if (!payment) {
			throw new Error("pembayaran test tidak ditemukan");
		}
		await rejectPayment(payment.id, "panitia-test", "Bukti tidak valid");

		const stats = await getCheckinStats();
		const summary = await getCheckinSummary(registration.participantId);
		expect(summary.paid).toBe(0);
		expect(summary.paymentRejected).toBe(true);
		expect(stats.registered).toBe(50);
		await expect(
			findParticipantByTicket(summary.participant.ticketNumber),
		).rejects.toThrow("ditolak admin");
		await expect(
			checkInParticipant(registration.participantId),
		).rejects.toThrow("ditolak admin");
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
