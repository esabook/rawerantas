import "fake-indexeddb/auto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

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
	PUBLIC_TERMS_URL: "",
}));

const DISQ_ID = "disq-0000-0000-0000-000000000000";
const LIVE_OK_ID = "live-0000-0000-0000-000000000001";

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
			if (id === LIVE_OK_ID) {
				return {
					id: LIVE_OK_ID,
					competitionId: "c1",
					ticketNumber: "RA-2026-LIVE",
					lapakNumber: "1",
					name: "Peserta Live",
					phone: "6281000000001",
					status: "fully_paid",
					createdAt: new Date(),
				};
			}
			return actual.getParticipantById(id);
		},
		// B1-5 live check-in: hindari jalur supabase di getCheckinSummary
		// (hanya ketika tidak demo; mode demo tetap memakai data seed).
		getPayments: async (participantId?: string) => {
			const { get } = await import("svelte/store");
			const { demoMode } = await import("$lib/demo/store");
			return get(demoMode) ? await actual.getPayments(participantId) : [];
		},
		getCompetitions: async () => {
			const { get } = await import("svelte/store");
			const { demoMode } = await import("$lib/demo/store");
			return get(demoMode)
				? await actual.getCompetitions(false)
				: ([] as Awaited<ReturnType<typeof actual.getCompetitions>>);
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
	registerWalkinCheckin,
	resetDemoCheckins,
} from "$lib/db/checkin";
import { resetDemoPayments, submitPayment } from "$lib/db/payment";
import { registerParticipant, resetDemoRegistrations } from "$lib/db/register";
import { demoCompetitions, demoParticipants } from "$lib/demo/generator";
import { setDemoMode } from "$lib/demo/store";
import { clearQueue, peekBatch } from "$lib/offline/queue";

/** Supabase tiruan utk jalur live check-in (B1-5). */
const sb = vi.hoisted(() => ({
	rpcResult: { ok: true } as Record<string, unknown>,
	rpcError: null as Error | null,
	rpcs: [] as Array<{ fn: string; args: Record<string, unknown> }>,
}));

vi.mock("$lib/db/supabaseClient", () => ({
	supabase: {
		removeAllChannels: () => {},
		rpc: (fn: string, args: Record<string, unknown>) => {
			sb.rpcs.push({ fn, args });
			if (sb.rpcError) throw sb.rpcError;
			return { data: sb.rpcResult, error: null };
		},
	},
}));

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
		expect(summary.participant.ticketNumber).toMatch(/^T-/);
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

	it("daftar on-site (tunai) → lunas + check-in langsung dalam satu aksi", async () => {
		const competition = demoCompetitions()[0];
		const result = await registerWalkinCheckin({
			competitionId: competition.id,
			name: "Peserta Onsite",
			phone: "081234500001",
		});
		expect(result.eligibility).toBe("ok");
		expect(result.queued).toBe(false);
		const summary = await getCheckinSummary(result.participantId);
		expect(summary.status).toBe("checked_in");
		expect(summary.remaining).toBe(0);
		expect(summary.checkedInAt).not.toBeNull();
		const { getPayments } = await import("$lib/db/queries");
		const payments = await getPayments(result.participantId);
		expect(payments).toHaveLength(1);
		expect(payments[0]?.paymentMethod).toBe("cash");
		expect(payments[0]?.isVerified).toBe(true);
	});

	it("daftar on-site tercatat sbg sumber panitia + identitas panitia yang login", async () => {
		const competition = demoCompetitions()[0];
		const result = await registerWalkinCheckin({
			competitionId: competition.id,
			name: "Peserta Onsite Dua",
			phone: "081234500002",
			staffId: "staff-abc",
			staffName: "Budi Panitia",
		});
		const summary = await getCheckinSummary(result.participantId);
		expect(summary.participant.registrationSource).toBe("panitia");
		expect(summary.participant.registeredByStaffId).toBe("staff-abc");
		expect(summary.participant.registeredByStaffName).toBe("Budi Panitia");
	});
});

describe("checkInParticipant live via RPC (B1-5)", () => {
	beforeEach(async () => {
		sb.rpcResult = { ok: true };
		sb.rpcError = null;
		sb.rpcs.length = 0;
		await clearQueue();
		await resetDemoCheckins();
		await setDemoMode(false);
	});

	afterAll(async () => {
		await clearQueue();
		await setDemoMode(true);
	});

	it("RPC check_in dipanggil dgn participant_id + recorded_by", async () => {
		const { eligibility } = await checkInParticipant(
			LIVE_OK_ID,
			"hash-panitia",
		);
		expect(eligibility).toBe("ok");
		expect(sb.rpcs.at(-1)?.fn).toBe("check_in");
		expect(sb.rpcs.at(-1)?.args).toEqual({
			p_participant_id: LIVE_OK_ID,
			p_recorded_by: "hash-panitia",
		});
	});

	it("RPC already → eligibility already", async () => {
		sb.rpcResult = { ok: true, already: true };
		const { eligibility } = await checkInParticipant(LIVE_OK_ID, null);
		expect(eligibility).toBe("already");
	});

	it("RPC menolak not_eligible → error alasan", async () => {
		sb.rpcResult = { ok: false, reason: "not_eligible" };
		await expect(checkInParticipant(LIVE_OK_ID, null)).rejects.toThrow(
			"minimal DP",
		);
	});

	it("offline → catat optimistik lokal + antrean, kembalikan queued:true (F7, B2-4)", async () => {
		sb.rpcError = new TypeError("Failed to fetch");
		const { eligibility, queued } = await checkInParticipant(
			LIVE_OK_ID,
			"hash-panitia",
		);
		expect(eligibility).toBe("ok");
		expect(queued).toBe(true);
		// record lokal optimistik
		const { localGetAll, localStores } = await import("$lib/db/localStore");
		const checkins = await localGetAll<{ participantId: string }>(
			localStores.checkins,
		);
		expect(checkins.some((c) => c.participantId === LIVE_OK_ID)).toBe(true);
		// antrean
		const entries = await peekBatch(10);
		expect(entries).toHaveLength(1);
		expect(entries[0]?.endpoint).toBe("/rest/participants/checkin");
		expect(entries[0]?.payload).toMatchObject({
			participantId: LIVE_OK_ID,
			recordedBy: "hash-panitia",
		});
	});
});
