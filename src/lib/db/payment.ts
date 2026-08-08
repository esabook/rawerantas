import { get } from "svelte/store";
import { demoMode } from "$lib/demo/store";
import { isOfflineError } from "$lib/offline/networkStore";
import { enqueue } from "$lib/offline/queue";
import { localClear, localGetAll, localPut, localStores } from "./localStore";
import type { Participant, ParticipantPayment } from "./queries";
import { getParticipantById, getPayments } from "./queries";
import { PROOF_IMAGES_BUCKET } from "./storage";

export interface PaymentInput {
	participantId: string;
	competitionId: string;
	method: string;
	amount: number;
	proofBlob: Blob | null;
	isCash: boolean;
	/**
	 * Nomor WA pengirim — ownership di RPC `submit_payment` (B1-1).
	 * Opsional sampai seluruh caller mengirimkannya; RPC melewatkan check
	 * bila null.
	 */
	phone?: string;
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
		// B2-1/F6/F18: jangan selalu memakai fee penuh — pakai nominal yang
		// dikirim (default sisa = fee - paid). Validasi integer positif.
		if (!Number.isFinite(amount) || amount <= 0) {
			throw new InvalidDpIncrementError();
		}
		return Math.round(amount);
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
	// B1-1 (F14/F24/A19): satu UUID idempotensi per percobaan submit —
	// dipakai sebagai p_idempotency_key RPC DAN kunci antrean, sehingga
	// drain offline idempoten end-to-end.
	const idempotencyKey = crypto.randomUUID();
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
				idempotencyKey,
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
		// B1-1: tulis via RPC `submit_payment` — validasi nominal & dedup di
		// server, status dihitung ulang dari total terverifikasi (F5: tanpa
		// status optimistik; F9: insert+status satu transaksi server-side).
		const { data, error } = await sb.rpc("submit_payment", {
			p_participant_id: input.participantId,
			p_method: input.method,
			p_amount: amount,
			p_proof_url: proofUrl,
			p_is_cash: input.isCash,
			p_idempotency_key: idempotencyKey,
			p_phone: input.phone ?? null,
		});
		if (error) {
			throw error;
		}
		const result = data as
			| { ok: boolean; paymentId?: string; reason?: string }
			| undefined;
		if (!result?.ok) {
			throw new Error(submitPaymentReasonMessage(result?.reason));
		}
		return { paymentId: result.paymentId ?? null, queued: false };
	} catch (e) {
		if (!isOfflineError(e)) {
			throw e;
		}
		await enqueue(idempotencyKey, "/rest/payments", {
			participantId: input.participantId,
			competitionId: input.competitionId,
			method: input.method,
			amount,
			mode,
			isCash: input.isCash,
			phone: input.phone ?? null,
			idempotencyKey,
			proof: input.proofBlob ? await input.proofBlob.arrayBuffer() : null,
			proofMime: input.proofBlob?.type ?? null,
		});
		return { paymentId: null, queued: true };
	}
}

/** Pesan ramah utk reason penolakan RPC `submit_payment`. */
function submitPaymentReasonMessage(reason: string | undefined): string {
	switch (reason) {
		case "participant_not_found":
			return "Peserta tidak ditemukan.";
		case "phone_mismatch":
			return "Nomor WhatsApp tidak cocok dengan data peserta.";
		case "disqualified":
			return "Peserta didiskualifikasi.";
		case "competition_not_found":
			return "Kompetisi tidak ditemukan.";
		case "invalid_amount":
			return "Nominal pembayaran tidak valid.";
		case "below_min_dp":
			return "Nominal di bawah DP minimal.";
		case "bad_increment":
			return `Nominal DP harus kelipatan Rp ${PAYMENT_AMOUNT_STEP.toLocaleString("id-ID")}.`;
		case "locked":
			return "Data terkunci setelah acara selesai. Hubungi panitia.";
		default:
			return "Pembayaran ditolak server. Periksa kembali data lalu coba lagi.";
	}
}

export interface ResubmitPaymentInput {
	paymentId: string;
	participantId: string;
	competitionId: string;
	amount: number;
	proofBlob: Blob | null;
	isCash: boolean;
	phone?: string;
}

/**
 * B1-2 (F8/F17): perbaiki / kirim ulang pembayaran yang ditolak atau masih
 * pending. Demo: update baris lokal (reset reject). Live: via RPC
 * `resubmit_payment` (kepemilikan & guard verified di server). Offline:
 * dilempar ke error — jalur executor untuk op resubmit tercatat sbg celah
 * (di luar FILES B1-2; antrean resubmit menyusul).
 */
export async function resubmitPayment(
	input: ResubmitPaymentInput,
	_competition: { fee: number; minDp: number } | undefined,
): Promise<PaymentResult> {
	if (get(demoMode)) {
		const payments = await localGetAll<ParticipantPayment>(STORE);
		const payment = payments.find((p) => p.id === input.paymentId);
		if (!payment) {
			throw new Error("Pembayaran tidak ditemukan.");
		}
		if (payment.isVerified) {
			throw new Error("Pembayaran sudah terverifikasi.");
		}
		await localPut(STORE, {
			...payment,
			amount: input.amount,
			proofImageUrl: input.isCash ? null : "draft-proof",
			isVerified: input.isCash,
			verifiedBy: null,
			rejectReason: null,
		});
		return { paymentId: input.paymentId, queued: false };
	}
	let proofUrl: string | null = null;
	try {
		const { supabase: sb } = await import("./supabaseClient");
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
				throw uploadError;
			}
			const { data } = sb.storage.from(PROOF_IMAGES_BUCKET).getPublicUrl(path);
			proofUrl = data.publicUrl;
		}
		const { data, error } = await sb.rpc("resubmit_payment", {
			p_payment_id: input.paymentId,
			p_amount: input.amount,
			p_proof_url: proofUrl,
			p_phone: input.phone ?? null,
		});
		if (error) {
			throw error;
		}
		const result = data as { ok?: boolean; reason?: string } | undefined;
		if (!result?.ok) {
			throw new Error(resubmitReasonMessage(result?.reason));
		}
		return { paymentId: input.paymentId, queued: false };
	} catch (e) {
		if (!isOfflineError(e)) {
			throw e;
		}
		throw new Error(
			"Sedang offline — kirim ulang pembayaran saat koneksi pulih.",
		);
	}
}

/** Pesan ramah utk reason penolakan RPC `resubmit_payment`. */
function resubmitReasonMessage(reason: string | undefined): string {
	switch (reason) {
		case "payment_not_found":
			return "Pembayaran tidak ditemukan.";
		case "already_verified":
			return "Pembayaran sudah terverifikasi dan tidak dapat diubah.";
		case "phone_mismatch":
			return "Nomor WhatsApp tidak cocok dengan data peserta.";
		case "invalid_amount":
			return "Nominal pembayaran tidak valid.";
		case "locked":
			return "Data terkunci setelah acara selesai. Hubungi panitia.";
		default:
			return "Permintaan kirim ulang ditolak server. Hubungi panitia bila tetap gagal.";
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
			phone: participant.phone,
		},
		"full",
		remaining,
	);
}
