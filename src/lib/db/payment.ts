import { get } from "svelte/store";
import { demoMode } from "$lib/demo/store";
import { isOfflineError } from "$lib/offline/networkStore";
import { enqueue } from "$lib/offline/queue";
import { localClear, localGetAll, localPut, localStores } from "./localStore";
import type { Participant } from "./queries";
import { getParticipantById, getPayments } from "./queries";
import { PROOF_IMAGES_BUCKET } from "./storage";

export interface PaymentInput {
	participantId: string;
	competitionId: string;
	method: string;
	amount: number;
	proofBlob: Blob | null;
	isCash: boolean;
}

export interface PaymentResult {
	paymentId: string | null;
	queued: boolean;
}

export interface CashPaymentInput {
	participantId: string;
	competitionId: string;
}

export const PAYMENT_AMOUNT_STEP = 500;

export class AmountBelowMinDpError extends Error {
	constructor(minDp: number) {
		super(`DP minimal Rp ${minDp.toLocaleString("id-ID")}.`);
		this.name = "AmountBelowMinDpError";
	}
}

export class InvalidDpIncrementError extends Error {
	constructor() {
		super(
			`Nominal DP harus kelipatan Rp ${PAYMENT_AMOUNT_STEP.toLocaleString("id-ID")}.`,
		);
		this.name = "InvalidDpIncrementError";
	}
}

const STORE = localStores.payments;

export async function resetDemoPayments(): Promise<void> {
	await localClear(STORE);
}

async function saveDemoPayment(
	payment: Record<string, unknown>,
	participant: Participant,
): Promise<void> {
	await localPut(STORE, payment);
	const regs = await localGetAll<Participant>(localStores.registrations);
	const updated = regs.map((r) =>
		r.id === participant.id ? { ...r, status: participant.status } : r,
	);
	for (const r of updated) {
		await localPut(localStores.registrations, r);
	}
}

export function validateAmount(
	amount: number,
	competition: { fee: number; minDp: number } | undefined,
	mode: "dp" | "full",
): number {
	if (mode === "full") {
		return competition?.fee ?? amount;
	}
	if (!Number.isInteger(amount) || amount % PAYMENT_AMOUNT_STEP !== 0) {
		throw new InvalidDpIncrementError();
	}
	const minDp = competition?.minDp ?? 0;
	if (amount < minDp) {
		throw new AmountBelowMinDpError(minDp);
	}
	return amount;
}

export async function submitPayment(
	input: PaymentInput,
	mode: "dp" | "full",
	competition: { fee: number; minDp: number } | undefined,
): Promise<PaymentResult> {
	const amount = validateAmount(input.amount, competition, mode);
	return persistPayment(input, mode, amount);
}

async function persistPayment(
	input: PaymentInput,
	mode: "dp" | "full",
	amount: number,
): Promise<PaymentResult> {
	if (get(demoMode)) {
		const participant: Participant = {
			id: input.participantId,
			competitionId: input.competitionId,
			ticketNumber: `T-${Date.now() % 1_000_000}`,
			lapakNumber: null,
			name: "",
			phone: "",
			status: mode === "full" ? "fully_paid" : "dp_paid",
			checkedInAt: null,
			createdAt: new Date(),
		};
		await saveDemoPayment(
			{
				id: crypto.randomUUID(),
				participantId: input.participantId,
				amount,
				paymentMethod: input.method,
				proofImageUrl: input.isCash ? null : "draft-proof",
				isVerified: input.isCash,
				verifiedBy: null,
				createdAt: new Date(),
			},
			participant,
		);
		return { paymentId: null, queued: false };
	}
	try {
		const { supabase: sb } = await import("./supabaseClient");
		let proofUrl: string | null = null;
		if (input.proofBlob && !input.isCash) {
			const mime =
				input.proofBlob.type === "image/webp"
					? "image/webp"
					: input.proofBlob.type === "image/png"
						? "image/png"
						: "image/jpeg";
			const ext =
				mime === "image/webp" ? "webp" : mime === "image/png" ? "png" : "jpg";
			const path = `proofs/${input.participantId}/${Date.now()}.${ext}`;
			const { error: uploadError } = await sb.storage
				.from(PROOF_IMAGES_BUCKET)
				.upload(path, input.proofBlob, { contentType: mime });
			if (uploadError) {
				// QW-6/F15/A20: gagal upload = fatal — jangan insert tanpa bukti.
				// Error offline jatuh ke catch di bawah → antrean (bukti ikut
				// tersimpan di payload utk retry executor); error lain (storage
				// penuh, salah bucket) muncul ke user sebagai pesan jelas.
				throw uploadError;
			}
			const { data } = sb.storage.from(PROOF_IMAGES_BUCKET).getPublicUrl(path);
			proofUrl = data.publicUrl;
		}
		const { data, error } = await sb
			.from("participant_payments")
			.insert({
				participant_id: input.participantId,
				amount,
				payment_method: input.method,
				proof_image_url: proofUrl,
				is_verified: input.isCash,
			})
			.select("id")
			.single();
		if (error) {
			throw error;
		}
		await sb
			.from("participants")
			.update({ status: mode === "full" ? "fully_paid" : "dp_paid" })
			.eq("id", input.participantId);
		return { paymentId: (data as { id: string }).id, queued: false };
	} catch (e) {
		if (!isOfflineError(e)) {
			throw e;
		}
		await enqueue(
			`payment:${input.participantId}:${mode}:${Date.now()}`,
			"/rest/payments",
			{
				participantId: input.participantId,
				competitionId: input.competitionId,
				method: input.method,
				amount,
				mode,
				isCash: input.isCash,
				proof: input.proofBlob ? await input.proofBlob.arrayBuffer() : null,
				proofMime: input.proofBlob?.type ?? null,
			},
		);
		return { paymentId: null, queued: true };
	}
}

/** Catat pelunasan tunai dari panitia dengan nominal sisa yang aktual. */
export async function submitCashPayment(
	input: CashPaymentInput,
	competition: { fee: number } | undefined,
): Promise<PaymentResult> {
	const participant = await getParticipantById(input.participantId);
	if (!participant) {
		throw new Error("Peserta tidak ditemukan.");
	}
	if (participant.status === "disqualified") {
		throw new Error("Peserta didiskualifikasi.");
	}
	if (participant.status === "checked_in") {
		throw new Error("Peserta sudah check-in.");
	}
	if (!competition || competition.fee <= 0) {
		throw new Error("Kompetisi tidak ditemukan.");
	}

	const payments = await getPayments(input.participantId);
	const rejected = payments.find(
		(p) => !p.isVerified && Boolean(p.rejectReason?.trim()),
	);
	if (rejected) {
		throw new Error(
			`Pembayaran peserta ditolak admin${rejected.rejectReason ? `: ${rejected.rejectReason.trim()}` : "."}`,
		);
	}
	const paid = payments
		.filter((p) => p.isVerified && !p.rejectReason?.trim())
		.reduce((sum, p) => sum + Number(p.amount), 0);
	const remaining = Math.max(0, competition.fee - paid);
	if (remaining === 0) {
		throw new Error("Peserta sudah lunas.");
	}

	return persistPayment(
		{
			...input,
			method: "cash",
			amount: remaining,
			proofBlob: null,
			isCash: true,
		},
		"full",
		remaining,
	);
}
