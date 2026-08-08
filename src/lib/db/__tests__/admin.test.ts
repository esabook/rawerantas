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

import {
	adminActorHash,
	advanceRound,
	demoAuditLogs,
	getMergedPayments,
	getUnverifiedPayments,
	rejectPayment,
	resetDemoAdminState,
	saveCompetition,
	savePaymentConfig,
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
		const { round } = await advanceRound(aduan.id, hash);
		expect(round).toBe(before + 1);
		const comps = await getCompetitions(false);
		expect(comps.find((c) => c.id === aduan.id)?.currentRound).toBe(before + 1);
	});

	it("reset membersihkan override", async () => {
		await saveCompetition({ ...mancing, fee: 90000 }, await adminActorHash());
		await resetDemoAdminState();
		const comps = await getCompetitions(false);
		expect(comps.find((c) => c.id === mancing.id)?.fee).toBe(mancing.fee);
	});
});
