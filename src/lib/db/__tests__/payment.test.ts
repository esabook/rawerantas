import "fake-indexeddb/auto";
import {
	afterAll,
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
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
import { clearQueue, peekBatch } from "$lib/offline/queue";

/** Supabase tiruan utk jalur live (QW-6/B1-1) — upload storage & RPC bisa
 * disetel gagal; panggilan RPC/upload ditangkap utk asersi. */
const sb = vi.hoisted(() => ({
	uploadError: null as Error | null,
	rpcError: null as Error | null,
	rpcResult: { ok: true, paymentId: "pay-uuid-1" } as Record<string, unknown>,
	rpcs: [] as Array<{ fn: string; args: Record<string, unknown> }>,
	uploads: [] as string[],
}));

vi.mock("$lib/db/supabaseClient", () => ({
	supabase: {
		removeAllChannels: () => {},
		rpc: (fn: string, args: Record<string, unknown>) => {
			sb.rpcs.push({ fn, args });
			if (sb.rpcError) throw sb.rpcError;
			return { data: sb.rpcResult, error: null };
		},
		storage: {
			from: () => ({
				upload: (path: string) => {
					sb.uploads.push(path);
					return { error: sb.uploadError };
				},
				getPublicUrl: (path: string) => ({
					data: { publicUrl: `https://cdn.test/${path}` },
				}),
			}),
		},
	},
}));

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

describe("submitPayment live — RPC submit_payment (QW-6/F15/A20, B1-1)", () => {
	const INPUT = (proofBlob: Blob | null) => ({
		participantId: "p-live-1",
		competitionId,
		method: "qris",
		amount: 30_000,
		proofBlob,
		isCash: false,
		phone: "081234567890",
	});

	beforeEach(async () => {
		sb.uploadError = null;
		sb.rpcError = null;
		sb.rpcResult = { ok: true, paymentId: "pay-uuid-1" };
		sb.rpcs.length = 0;
		sb.uploads.length = 0;
		await clearQueue();
		await setDemoMode(false);
	});

	afterAll(async () => {
		await clearQueue();
		await setDemoMode(true);
	});

	it("gagal upload bukti (error storage) → throw, tanpa panggilan RPC", async () => {
		sb.uploadError = new Error("Bucket storage penuh");
		await expect(
			submitPayment(
				INPUT(new Blob(["x"], { type: "image/jpeg" })),
				"dp",
				competition,
			),
		).rejects.toThrow();
		expect(sb.uploads).toHaveLength(1);
		expect(sb.rpcs).toHaveLength(0);
	});

	it("gagal upload karena offline → masuk antrean dgn bukti, tanpa RPC", async () => {
		sb.uploadError = new TypeError("Failed to fetch");
		const res = await submitPayment(
			INPUT(new Blob(["x"], { type: "image/jpeg" })),
			"dp",
			competition,
		);
		expect(res.queued).toBe(true);
		expect(sb.rpcs).toHaveLength(0);
		const entries = await peekBatch(10);
		expect(entries).toHaveLength(1);
		expect(entries[0]?.endpoint).toBe("/rest/payments");
		const queuedPayload = entries[0]?.payload as
			| Record<string, unknown>
			| undefined;
		expect(queuedPayload?.proof).toBeInstanceOf(ArrayBuffer);
	});

	it("upload sukses → RPC submit_payment membawa proof_url, phone & idempotency", async () => {
		const res = await submitPayment(
			INPUT(new Blob(["x"], { type: "image/jpeg" })),
			"dp",
			competition,
		);
		expect(res).toEqual({ paymentId: "pay-uuid-1", queued: false });
		expect(sb.uploads).toHaveLength(1);
		expect(sb.rpcs).toHaveLength(1);
		expect(sb.rpcs[0]?.fn).toBe("submit_payment");
		expect(sb.rpcs[0]?.args).toMatchObject({
			p_participant_id: "p-live-1",
			p_method: "qris",
			p_amount: 30_000,
			p_is_cash: false,
			p_phone: "081234567890",
		});
		expect(sb.rpcs[0]?.args.p_proof_url).toContain(
			"https://cdn.test/proofs/p-live-1/",
		);
	});

	it("RPC menolak (reason bisnis) → pesan ramah, tanpa antrean", async () => {
		sb.rpcResult = { ok: false, reason: "disqualified" };
		await expect(
			submitPayment(
				INPUT(new Blob(["x"], { type: "image/jpeg" })),
				"dp",
				competition,
			),
		).rejects.toThrow("didiskualifikasi");
		expect(await peekBatch(10)).toHaveLength(0);
	});

	it("gagal jaringan saat RPC → antrean; kunci antrean == idempotency_key RPC (F24)", async () => {
		sb.rpcError = new TypeError("Failed to fetch");
		const res = await submitPayment(
			INPUT(new Blob(["x"], { type: "image/jpeg" })),
			"dp",
			competition,
		);
		expect(res.queued).toBe(true);
		expect(sb.rpcs).toHaveLength(1);
		const entries = await peekBatch(10);
		expect(entries).toHaveLength(1);
		const queuedPayload = entries[0]?.payload as
			| Record<string, unknown>
			| undefined;
		expect(entries[0]?.idempotencyKey).toBe(queuedPayload?.idempotencyKey);
		expect(entries[0]?.idempotencyKey).toBe(sb.rpcs[0]?.args.p_idempotency_key);
	});
});
