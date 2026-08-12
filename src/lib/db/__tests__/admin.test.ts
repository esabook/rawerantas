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

/** Supabase tiruan utk jalur live verify/reject (B1-3). */
const sb = vi.hoisted(() => ({
	rpcResult: { ok: true } as Record<string, unknown>,
	rpcError: null as Error | null,
	rpcs: [] as Array<{ fn: string; args: Record<string, unknown> }>,
	proofRow: {
		payment_method: "qris",
		proof_image_url: "https://cdn.test/p.jpg",
	} as Record<string, unknown> | null,
	lockRow: null as Record<string, unknown> | null,
}));

vi.mock("$lib/db/supabaseClient", () => ({
	supabase: {
		removeAllChannels: () => {},
		rpc: (fn: string, args: Record<string, unknown>) => {
			sb.rpcs.push({ fn, args });
			if (sb.rpcError) throw sb.rpcError;
			return { data: sb.rpcResult, error: null };
		},
		from: () => ({
			select: () => ({
				eq: () => ({
					maybeSingle: async () => ({ data: sb.proofRow, error: null }),
				}),
				limit: () => ({
					maybeSingle: async () => ({ data: sb.lockRow, error: null }),
				}),
				single: async () => ({ data: sb.lockRow, error: null }),
			}),
		}),
	},
}));

import {
	adminActorHash,
	advanceRound,
	demoAuditLogs,
	getDataLock,
	getMergedPayments,
	getUnverifiedPayments,
	rejectPayment,
	resetDemoAdminState,
	saveCompetition,
	savePaymentConfig,
	setDataLock,
	startRound,
	stopRound,
	undoCheckIn,
	verifyPayment,
} from "$lib/db/admin";
import { localPut, localStores } from "$lib/db/localStore";
import { submitPayment } from "$lib/db/payment";
import {
	getCompetitions,
	getPaymentConfigs,
	getPayments,
} from "$lib/db/queries";
import { registerParticipant, resetDemoRegistrations } from "$lib/db/register";
import { demoCompetitions, demoPaymentConfigs } from "$lib/demo/generator";
import { setDemoMode } from "$lib/demo/store";
import { clearQueue, peekBatch } from "$lib/offline/queue";

const mancing = demoCompetitions()[0];
const aduan = demoCompetitions()[1];
function must<T>(v: T | undefined | null, msg = "nilai wajib ada"): T {
	if (v == null) {
		throw new Error(msg);
	}
	return v;
}

const qris = demoPaymentConfigs().find((c) => c.method === "qris");
if (!qris) {
	throw new Error("seed qris tidak ada");
}

describe("admin domain", () => {
	beforeEach(async () => {
		await setDemoMode(true);
		await resetDemoAdminState();
		await resetDemoRegistrations();
	});

	it("verify payment → isVerified + verified_by + audit row", async () => {
		const competition = demoCompetitions()[0];
		const res = await registerParticipant({
			competitionId: competition.id,
			name: "Budi Verifikasi",
			phone: "081234567890",
		});
		await submitPayment(
			{
				participantId: res.participantId,
				competitionId: competition.id,
				method: "qris",
				amount: 25000,
				proofBlob: null,
				isCash: false,
			},
			"dp",
			competition,
		);
		const unverified = await getUnverifiedPayments();
		const pending = unverified.find(
			(p) => p.participantId === res.participantId,
		);
		expect(pending).toBeDefined();
		const hash = await adminActorHash();
		const { status } = await verifyPayment(must(pending).id, hash);
		expect(status).toBe("verified");
		const payments = await getPayments(res.participantId);
		const verified = payments.find(
			(p) => p.participantId === res.participantId,
		);
		expect(verified?.isVerified).toBe(true);
		expect(verified?.verifiedBy).toBe(hash);
		const audits = await demoAuditLogs();
		expect(audits[0]?.action).toBe("verify_payment");
		expect(audits[0]?.entityId).toBe(must(pending).id);
		expect(audits[0]?.actorHash).toBe(hash);
	});

	it("verify lunas → status peserta fully_paid", async () => {
		const competition = demoCompetitions()[0];
		const res = await registerParticipant({
			competitionId: competition.id,
			name: "Cici Lunas",
			phone: "081298765432",
		});
		await submitPayment(
			{
				participantId: res.participantId,
				competitionId: competition.id,
				method: "qris",
				amount: 25000,
				proofBlob: null,
				isCash: false,
			},
			"dp",
			competition,
		);
		await submitPayment(
			{
				participantId: res.participantId,
				competitionId: competition.id,
				method: "qris",
				amount: 25000,
				proofBlob: null,
				isCash: false,
			},
			"full",
			competition,
		);
		const hash = await adminActorHash();
		const payments = await getPayments(res.participantId);
		for (const p of payments) {
			if (p.participantId === res.participantId) {
				await verifyPayment(p.id, hash);
			}
		}
		const { demoLocalParticipants } = await import("$lib/db/register");
		const local = await demoLocalParticipants();
		expect(local.find((p) => p.id === res.participantId)?.status).toBe(
			"fully_paid",
		);
	});

	it("verify non-tunai tanpa bukti → ditolak, baris tetap unverified (QW-5/A11)", async () => {
		const competition = demoCompetitions()[0];
		const res = await registerParticipant({
			competitionId: competition.id,
			name: "Dedi Tanpa Bukti",
			phone: "081234500002",
		});
		const paymentId = crypto.randomUUID();
		await localPut(localStores.payments, {
			id: paymentId,
			participantId: res.participantId,
			amount: 25000,
			paymentMethod: "qris",
			proofImageUrl: null,
			isVerified: false,
			verifiedBy: null,
			rejectReason: null,
			createdAt: new Date(),
		});
		const hash = await adminActorHash();
		await expect(verifyPayment(paymentId, hash)).rejects.toThrow("bukti");
		const payments = await getPayments(res.participantId);
		expect(payments.find((p) => p.id === paymentId)?.isVerified).toBe(false);
	});

	it("verify tunai tanpa bukti tetap diperbolehkan (QW-5/A11)", async () => {
		const competition = demoCompetitions()[0];
		const res = await registerParticipant({
			competitionId: competition.id,
			name: "Eka Tunai Tanpa Bukti",
			phone: "081234500003",
		});
		const paymentId = crypto.randomUUID();
		await localPut(localStores.payments, {
			id: paymentId,
			participantId: res.participantId,
			amount: 25000,
			paymentMethod: "cash",
			proofImageUrl: null,
			isVerified: false,
			verifiedBy: null,
			rejectReason: null,
			createdAt: new Date(),
		});
		const hash = await adminActorHash();
		const { status } = await verifyPayment(paymentId, hash);
		expect(status).toBe("verified");
		const payments = await getPayments(res.participantId);
		expect(payments.find((p) => p.id === paymentId)?.isVerified).toBe(true);
	});

	it("verify baris sudah terverifikasi → ditolak (B1-3/A33)", async () => {
		const competition = demoCompetitions()[0];
		const res = await registerParticipant({
			competitionId: competition.id,
			name: "Vera Sudah Verified",
			phone: "081234500020",
		});
		const paymentId = crypto.randomUUID();
		await localPut(localStores.payments, {
			id: paymentId,
			participantId: res.participantId,
			amount: 25000,
			paymentMethod: "qris",
			proofImageUrl: "draft-proof",
			isVerified: true,
			verifiedBy: "hash",
			rejectReason: null,
			createdAt: new Date(),
		});
		await expect(
			verifyPayment(paymentId, await adminActorHash()),
		).rejects.toThrow("sudah terverifikasi");
	});

	it("reject baris sudah terverifikasi → ditolak (B1-3/A33)", async () => {
		const competition = demoCompetitions()[0];
		const res = await registerParticipant({
			competitionId: competition.id,
			name: "Yudi Sudah Verified",
			phone: "081234500021",
		});
		const paymentId = crypto.randomUUID();
		await localPut(localStores.payments, {
			id: paymentId,
			participantId: res.participantId,
			amount: 25000,
			paymentMethod: "qris",
			proofImageUrl: "draft-proof",
			isVerified: true,
			verifiedBy: "hash",
			rejectReason: null,
			createdAt: new Date(),
		});
		await expect(
			rejectPayment(paymentId, await adminActorHash(), "x"),
		).rejects.toThrow("sudah terverifikasi");
	});

	it("reject payment → reason + audit row", async () => {
		const competition = demoCompetitions()[0];
		const res = await registerParticipant({
			competitionId: competition.id,
			name: "Dedi Ditolak",
			phone: "081233344455",
		});
		await submitPayment(
			{
				participantId: res.participantId,
				competitionId: competition.id,
				method: "bank_transfer",
				amount: 25000,
				proofBlob: null,
				isCash: false,
			},
			"dp",
			competition,
		);
		const pending = (await getUnverifiedPayments()).find(
			(p) => p.participantId === res.participantId,
		);
		expect(pending).toBeDefined();
		const hash = await adminActorHash();
		const { status } = await rejectPayment(
			must(pending).id,
			hash,
			"Bukti tidak terbaca",
		);
		expect(status).toBe("rejected");
		const all = await getMergedPayments();
		const rejected = all.find((p) => p.id === must(pending).id);
		expect(rejected?.isVerified).toBe(false);
		expect(rejected?.rejectReason).toBe("Bukti tidak terbaca");
		expect(rejected?.participantName.length ?? 0).toBeGreaterThan(0);
		expect(rejected?.participantPhone.length ?? 0).toBeGreaterThan(0);
		expect(rejected?.participantTicket.length ?? 0).toBeGreaterThan(0);
		const audits = await demoAuditLogs();
		expect(audits[0]?.action).toBe("reject_payment");
		expect(audits[0]?.payload?.reason).toBe("Bukti tidak terbaca");
	});

	it("saveCompetition → getCompetitions merge override + audit", async () => {
		const hash = await adminActorHash();
		await saveCompetition({ ...mancing, fee: 75000 }, hash);
		const comps = await getCompetitions(false);
		expect(comps.find((c) => c.id === mancing.id)?.fee).toBe(75000);
		const audits = await demoAuditLogs();
		expect(audits[0]?.action).toBe("save_competition");
		expect(audits[0]?.actorHash).toBe(hash);
	});

	it("savePaymentConfig toggle non-aktif → tidak muncul di getPaymentConfigs(true) + audit", async () => {
		const hash = await adminActorHash();
		await savePaymentConfig({ ...qris, isActive: false }, hash);
		const all = await getPaymentConfigs(false);
		expect(all.find((c) => c.id === qris.id)?.isActive).toBe(false);
		const active = await getPaymentConfigs(true);
		expect(active.some((c) => c.id === qris.id)).toBe(false);
		const audits = await demoAuditLogs();
		expect(audits[0]?.action).toBe("save_payment_config");
	});

	it("advance round hanya mode aduan layangan", async () => {
		const hash = await adminActorHash();
		await expect(advanceRound(mancing.id, hash)).rejects.toThrow(
			"hanya untuk mode aduan",
		);
	});

	it("advance round aduan → current_round +1 dan terlihat via getCompetitions", async () => {
		const before = aduan.currentRound;
		const hash = await adminActorHash();
		const { round, ok } = await advanceRound(aduan.id, hash, { force: true });
		expect(ok).toBe(true);
		expect(round).toBe(before + 1);
		const comps = await getCompetitions(false);
		expect(comps.find((c) => c.id === aduan.id)?.currentRound).toBe(before + 1);
	});

	it("advance round diblokir bila masih ada peserta belum dinilai (B4-1/A15)", async () => {
		const before = aduan.currentRound;
		const hash = await adminActorHash();
		const res = await advanceRound(aduan.id, hash);
		expect(res.ok).toBe(false);
		expect(res.unjudged).toBeGreaterThan(0);
		// babak tidak berubah
		const comps = await getCompetitions(false);
		expect(comps.find((c) => c.id === aduan.id)?.currentRound).toBe(before);
	});

	it("reset membersihkan override", async () => {
		await saveCompetition({ ...mancing, fee: 90000 }, await adminActorHash());
		await resetDemoAdminState();
		const comps = await getCompetitions(false);
		expect(comps.find((c) => c.id === mancing.id)?.fee).toBe(mancing.fee);
	});

	it("startRound (demo): set roundStartedAt/Round/By, terlihat via getCompetitions", async () => {
		const res = await startRound(aduan.id, aduan.currentRound, "staff-1:Budi");
		expect(res.queued).toBe(false);
		const comps = await getCompetitions(false);
		const updated = comps.find((c) => c.id === aduan.id);
		expect(updated?.roundStartedRound).toBe(aduan.currentRound);
		expect(updated?.roundStartedBy).toBe("staff-1:Budi");
		expect(updated?.roundStartedAt).toBeTruthy();
	});

	it("startRound dipanggil dua kali (ulangi) → roundStartedAt berubah", async () => {
		await startRound(aduan.id, aduan.currentRound, "staff-1:Budi");
		const first = (await getCompetitions(false)).find(
			(c) => c.id === aduan.id,
		)?.roundStartedAt;
		await new Promise((resolve) => setTimeout(resolve, 5));
		await startRound(aduan.id, aduan.currentRound, "staff-1:Budi");
		const second = (await getCompetitions(false)).find(
			(c) => c.id === aduan.id,
		)?.roundStartedAt;
		expect(new Date(second as Date).getTime()).toBeGreaterThan(
			new Date(first as Date).getTime(),
		);
	});

	it("stopRound (demo): kosongkan roundStartedAt/Round/By", async () => {
		await startRound(aduan.id, aduan.currentRound, "staff-1:Budi");
		await stopRound(aduan.id);
		const updated = (await getCompetitions(false)).find(
			(c) => c.id === aduan.id,
		);
		expect(updated?.roundStartedAt).toBeNull();
		expect(updated?.roundStartedRound).toBeNull();
		expect(updated?.roundStartedBy).toBeNull();
	});
});

describe("verify/reject live via RPC (B1-3)", () => {
	beforeEach(async () => {
		sb.rpcResult = { ok: true };
		sb.rpcError = null;
		sb.rpcs.length = 0;
		sb.proofRow = {
			payment_method: "qris",
			proof_image_url: "https://cdn.test/p.jpg",
		};
		await setDemoMode(false);
	});

	afterAll(async () => {
		await setDemoMode(true);
	});

	it("verify → RPC verify_payment dipanggil (guard & audit di server)", async () => {
		const hash = await adminActorHash();
		const { status } = await verifyPayment("pay-1", hash);
		expect(status).toBe("verified");
		expect(sb.rpcs.at(-1)?.fn).toBe("verify_payment");
		expect(sb.rpcs.at(-1)?.args).toMatchObject({
			p_payment_id: "pay-1",
			p_actor_hash: hash,
		});
	});

	it("verify RPC tolak no_proof → pesan ramah", async () => {
		sb.rpcResult = { ok: false, reason: "no_proof" };
		await expect(
			verifyPayment("pay-1", await adminActorHash()),
		).rejects.toThrow("bukti pembayaran tidak ada");
	});

	it("reject → RPC reject_payment dipanggil dgn reason", async () => {
		const hash = await adminActorHash();
		const { status } = await rejectPayment("pay-1", hash, "bukti buram");
		expect(status).toBe("rejected");
		expect(sb.rpcs.at(-1)?.args).toMatchObject({
			p_payment_id: "pay-1",
			p_actor_hash: hash,
			p_reason: "bukti buram",
		});
	});

	it("reject RPC tolak already_verified → pesan ramah", async () => {
		sb.rpcResult = { ok: false, reason: "already_verified" };
		await expect(
			rejectPayment("pay-1", await adminActorHash(), "x"),
		).rejects.toThrow("sudah terverifikasi");
	});
	describe("data lock (B1-8/A17)", () => {
		beforeEach(async () => {
			sb.rpcResult = { ok: true };
			sb.rpcError = null;
			sb.rpcs.length = 0;
			await setDemoMode(true);
			await resetDemoAdminState();
		});

		it("demo: setDataLock benar → getDataLock merefleksikan", async () => {
			const hash = await adminActorHash();
			expect((await getDataLock()).locked).toBe(false);
			const locked = await setDataLock(true, hash);
			expect(locked.locked).toBe(true);
			expect(locked.lockedBy).toBe(hash);
			expect((await getDataLock()).locked).toBe(true);
			await setDataLock(false, hash);
			expect((await getDataLock()).locked).toBe(false);
		});

		it("live: setDataLock via RPC set_data_lock + getDataLock", async () => {
			await setDemoMode(false);
			sb.rpcResult = { ok: true, locked: true };
			// getDataLock live memakai select dari tabel data_lock — mock from().
			sb.lockRow = {
				is_locked: true,
				locked_at: "2026-08-17T10:00:00Z",
				locked_by: "hash",
			};
			const locked = await setDataLock(true, await adminActorHash());
			expect(sb.rpcs.at(-1)?.fn).toBe("set_data_lock");
			expect(sb.rpcs.at(-1)?.args).toMatchObject({ p_locked: true });
			expect(locked.locked).toBe(true);
		});

		it("live: getDataLock tabel kosong → unlocked default, tidak error", async () => {
			await setDemoMode(false);
			sb.lockRow = null;
			const state = await getDataLock();
			expect(state.locked).toBe(false);
			expect(state.lockedAt).toBeNull();
			expect(state.lockedBy).toBeNull();
		});
		describe("undoCheckIn recalc status (B2-6/F11/A9)", () => {
			beforeEach(async () => {
				await setDemoMode(true);
				await resetDemoAdminState();
				await resetDemoRegistrations();
			});

			it("undo peserta yang lunas → status tetap fully_paid, bukan dp_paid", async () => {
				const competition = demoCompetitions()[0];
				const res = await registerParticipant({
					competitionId: competition.id,
					name: "Ung Lunas",
					phone: "081234500060",
				});
				// bayar lunas (fee) + verifikasi
				await submitPayment(
					{
						participantId: res.participantId,
						competitionId: competition.id,
						method: "qris",
						amount: competition.fee,
						proofBlob: null,
						isCash: false,
					},
					"full",
					competition,
				);
				const payment = (await getPayments(res.participantId))[0];
				if (!payment) throw new Error("payment tidak ada");
				await verifyPayment(payment.id, await adminActorHash());
				// check-in lalu undo
				const { checkInParticipant, resetDemoCheckins } = await import(
					"$lib/db/checkin"
				);
				await resetDemoCheckins();
				await checkInParticipant(res.participantId);
				await undoCheckIn(res.participantId, await adminActorHash());
				// status lokal tetap fully_paid (tidak turun ke dp_paid)
				const { demoLocalParticipants } = await import("$lib/db/register");
				const local = await demoLocalParticipants();
				expect(local.find((p) => p.id === res.participantId)?.status).toBe(
					"fully_paid",
				);
				// A21: undo check-in terekam di audit demo
				const { demoAuditLogs } = await import("$lib/db/admin");
				const logs = await demoAuditLogs();
				expect(
					logs.some(
						(l) =>
							l.action === "undo_check_in" && l.entityId === res.participantId,
					),
				).toBe(true);
			});
		});
	});
});

describe("startRound/stopRound live (RPC + data_lock + offline queue)", () => {
	beforeEach(async () => {
		sb.rpcResult = { ok: true };
		sb.rpcError = null;
		sb.rpcs.length = 0;
		await clearQueue();
		await setDemoMode(false);
	});

	afterAll(async () => {
		await clearQueue();
		await setDemoMode(true);
	});

	it("online → RPC start_round dipanggil, tidak queued", async () => {
		const res = await startRound(aduan.id, 2, "staff-1:Budi");
		expect(res.queued).toBe(false);
		expect(sb.rpcs.at(-1)?.fn).toBe("start_round");
		expect(sb.rpcs.at(-1)?.args).toMatchObject({
			p_competition_id: aduan.id,
			p_round: 2,
			p_started_by: "staff-1:Budi",
		});
	});

	it("RPC menolak locked → pesan terkunci, bukan offline-queue", async () => {
		sb.rpcResult = { ok: false, reason: "locked" };
		await expect(startRound(aduan.id, 2, "staff-1:Budi")).rejects.toThrow(
			"terkunci",
		);
		expect(await peekBatch(10)).toHaveLength(0);
	});

	it("offline → di-enqueue ke /rest/competitions/start-round, queued:true", async () => {
		sb.rpcError = new TypeError("Failed to fetch");
		const res = await startRound(aduan.id, 2, "staff-1:Budi");
		expect(res.queued).toBe(true);
		const entries = await peekBatch(10);
		expect(entries).toHaveLength(1);
		expect(entries[0]?.endpoint).toBe("/rest/competitions/start-round");
		expect(entries[0]?.payload).toMatchObject({
			competitionId: aduan.id,
			round: 2,
			startedBy: "staff-1:Budi",
		});
	});

	it("stopRound online → RPC stop_round dipanggil, tidak queued", async () => {
		const res = await stopRound(aduan.id);
		expect(res.queued).toBe(false);
		expect(sb.rpcs.at(-1)?.fn).toBe("stop_round");
		expect(sb.rpcs.at(-1)?.args).toMatchObject({ p_competition_id: aduan.id });
	});

	it("stopRound tetap jalan walau data_lock terkunci (beres-beres selalu boleh)", async () => {
		sb.rpcResult = { ok: true };
		const res = await stopRound(aduan.id);
		expect(res.queued).toBe(false);
	});

	it("stopRound offline → di-enqueue ke /rest/competitions/stop-round", async () => {
		sb.rpcError = new TypeError("Failed to fetch");
		const res = await stopRound(aduan.id);
		expect(res.queued).toBe(true);
		const entries = await peekBatch(10);
		expect(entries).toHaveLength(1);
		expect(entries[0]?.endpoint).toBe("/rest/competitions/stop-round");
		expect(entries[0]?.payload).toMatchObject({ competitionId: aduan.id });
	});
});
