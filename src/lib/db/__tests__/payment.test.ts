import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { verifyPayment } from "$lib/db/admin";
import { localGetAll, localStores } from "$lib/db/localStore";
import {
	AmountBelowMinDpError,
	InvalidDpIncrementError,
	resetDemoPayments,
	submitCashPayment,
	submitPayment,
	validateAmount,
} from "$lib/db/payment";
import { getPayments } from "$lib/db/queries";
import { registerParticipant, resetDemoRegistrations } from "$lib/db/register";
import { demoCompetitions } from "$lib/demo/generator";
import { demoMode, setDemoMode } from "$lib/demo/store";

const competition = { fee: 100_000, minDp: 25_000 };
const competitionId = demoCompetitions()[0].id;

const setupParticipant = async () => {
	const res = await registerParticipant({
		competitionId,
		name: "Budi",
		phone: "081234567890",
	});
	return res.participantId;
};

describe("validateAmount", () => {
	it("menerima DP di atas min_dp", () => {
		expect(validateAmount(30_000, competition, "dp")).toBe(30_000);
	});

	it("menerima DP sama dengan min_dp", () => {
		expect(validateAmount(25_000, competition, "dp")).toBe(25_000);
	});

	it("menolak DP di bawah min_dp", () => {
		expect(() => validateAmount(10_000, competition, "dp")).toThrow(
			AmountBelowMinDpError,
		);
		expect(() => validateAmount(10_000, competition, "dp")).toThrow(
			"DP minimal Rp 25.000",
		);
	});

	it("menolak DP yang bukan kelipatan Rp500", () => {
		expect(() => validateAmount(25_250, competition, "dp")).toThrow(
			InvalidDpIncrementError,
		);
	});

	it("mode lunas memakai fee kompetisi", () => {
		expect(validateAmount(1, competition, "full")).toBe(100_000);
	});
});

describe("submitPayment (demo)", () => {
	beforeEach(async () => {
		await setDemoMode(true);
		await resetDemoRegistrations();
		await resetDemoPayments();
	});
	afterEach(() => {
		demoMode.set(false);
	});

	it("menyimpan pembayaran DP di demo_payments dan update status peserta", async () => {
		const participantId = await setupParticipant();
		await submitPayment(
			{
				participantId,
				competitionId,
				method: "qris",
				amount: 30_000,
				proofBlob: new Blob(["fake"], { type: "image/jpeg" }),
				isCash: false,
			},
			"dp",
			competition,
		);

		const payments = await localGetAll<Record<string, unknown>>(
			localStores.payments,
		);
		expect(payments).toHaveLength(1);
		expect(payments[0]).toMatchObject({
			participantId,
			amount: 30_000,
			paymentMethod: "qris",
		});
		expect(payments[0].isVerified).toBe(false);

		const regs = await localGetAll<Record<string, unknown>>(
			localStores.registrations,
		);
		expect(regs.find((r) => r.id === participantId)).toMatchObject({
			status: "dp_paid",
		});
	});

	it("pembayaran tunai tersimpan tanpa bukti dan terverifikasi", async () => {
		const participantId = await setupParticipant();
		const res = await submitPayment(
			{
				participantId,
				competitionId,
				method: "cash",
				amount: 100_000,
				proofBlob: null,
				isCash: true,
			},
			"full",
			competition,
		);
		expect(res).toEqual({ paymentId: null, queued: false });

		const payments = await localGetAll<Record<string, unknown>>(
			localStores.payments,
		);
		expect(payments[0]).toMatchObject({
			participantId,
			proofImageUrl: null,
			isVerified: true,
		});
	});

	it("pelunasan tunai panitia hanya mencatat sisa yang belum dibayar", async () => {
		const participantId = await setupParticipant();
		await submitPayment(
			{
				participantId,
				competitionId,
				method: "qris",
				amount: 25_000,
				proofBlob: null,
				isCash: false,
			},
			"dp",
			competition,
		);
		const dpPayment = (await getPayments(participantId))[0];
		if (!dpPayment) {
			throw new Error("pembayaran DP test tidak ditemukan");
		}
		await verifyPayment(dpPayment.id, "panitia-test");
		const res = await submitCashPayment(
			{ participantId, competitionId },
			competition,
		);

		expect(res).toEqual({ paymentId: null, queued: false });
		const payments = await localGetAll<Record<string, unknown>>(
			localStores.payments,
		);
		expect(payments).toHaveLength(2);
		expect(payments.find((p) => p.paymentMethod === "cash")).toMatchObject({
			amount: 75_000,
			isVerified: true,
		});
	});
});
