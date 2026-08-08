import { describe, expect, it, vi } from "vitest";

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
	normalizeCompetitionRow,
	normalizeHiasScoreRow,
	normalizeParticipantRow,
	normalizePaymentConfigRow,
	normalizePaymentRow,
} from "$lib/db/queries";

describe("Supabase row normalization", () => {
	it("maps live snake_case rows into app camelCase fields", () => {
		expect(
			normalizeCompetitionRow({
				id: "c1",
				name: "Mancing",
				scoring_mode: "terberat",
				fee: 50000,
				min_dp: 25000,
				total_quota: 50,
				current_round: 2,
				is_active: true,
				created_at: "2026-08-17T00:00:00Z",
			}),
		).toMatchObject({
			scoringMode: "terberat",
			minDp: 25000,
			totalQuota: 50,
			currentRound: 2,
			isActive: true,
		});

		expect(
			normalizeParticipantRow({
				id: "p1",
				competition_id: "c1",
				ticket_number: "RA-1",
				lapak_number: "7",
				name: "Budi",
				phone: "+6281",
				status: "checked_in",
				checked_in_at: "2026-08-17T01:00:00Z",
				created_at: "2026-08-17T00:00:00Z",
			}),
		).toMatchObject({
			competitionId: "c1",
			ticketNumber: "RA-1",
			lapakNumber: "7",
			checkedInAt: "2026-08-17T01:00:00Z",
		});
	});

	it("maps payment and hias fields used by admin and leaderboard", () => {
		expect(
			normalizePaymentConfigRow({
				id: "cfg1",
				method: "qris",
				account_name: null,
				account_number: null,
				qris_image_url: "https://img.test/qris.jpg",
				instructions: "Scan",
				is_active: true,
				created_at: "2026-08-17T00:00:00Z",
			}),
		).toMatchObject({
			qrisImageUrl: "https://img.test/qris.jpg",
			isActive: true,
		});

		expect(
			normalizePaymentRow({
				id: "pay1",
				participant_id: "p1",
				amount: 25000,
				payment_method: "qris",
				proof_image_url: "https://img.test/proof.jpg",
				is_verified: false,
				verified_by: null,
				reject_reason: "Blur",
				created_at: "2026-08-17T00:00:00Z",
			}),
		).toMatchObject({
			participantId: "p1",
			paymentMethod: "qris",
			proofImageUrl: "https://img.test/proof.jpg",
			isVerified: false,
			rejectReason: "Blur",
		});

		expect(
			normalizeHiasScoreRow({
				id: "h1",
				competition_id: "c1",
				participant_id: "p1",
				aesthetic: 80,
				stability: 90,
				creativity: 70,
				total_weighted: 82,
				recorded_by: "hash",
				idempotency_key: "00000000-0000-4000-8000-000000000001",
				received_at: "2026-08-17T00:00:00Z",
				edited_at: null,
				created_at: "2026-08-17T00:00:00Z",
			}),
		).toMatchObject({
			competitionId: "c1",
			participantId: "p1",
			totalWeighted: 82,
			recordedBy: "hash",
		});
	});
});
