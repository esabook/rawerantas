import { get } from "svelte/store";
import { demoMode } from "$lib/demo/store";
import { DB_VERSION, ensureAllStores } from "$lib/offline/idbSchema";
import { enqueue } from "$lib/offline/queue";
import type { Participant } from "./queries";

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

export class AmountBelowMinDpError extends Error {
	constructor(minDp: number) {
		super(`DP minimal Rp ${minDp.toLocaleString("id-ID")}.`);
		this.name = "AmountBelowMinDpError";
	}
}

const DB_NAME = "rawerantas";
const STORE = "demo_payments";

let dbPromise: Promise<IDBDatabase> | null = null;

const getDb = (): Promise<IDBDatabase> => {
	dbPromise ??= new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, DB_VERSION);
		req.onupgradeneeded = () => {
			ensureAllStores(req.result);
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
	return dbPromise;
};

export async function resetDemoPayments(): Promise<void> {
	const db = await getDb();
	await new Promise<void>((resolve, reject) => {
		const tx = db.transaction(STORE, "readwrite");
		tx.objectStore(STORE).clear();
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
}

async function saveDemoPayment(
	payment: Record<string, unknown>,
	participant: Participant,
): Promise<void> {
	const db = await getDb();
	await new Promise<void>((resolve, reject) => {
		const tx = db.transaction(STORE, "readwrite");
		tx.objectStore(STORE).put(payment);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
	const regs = await demoRegistrations(db);
	const updated = regs.map((r) => (r.id === participant.id ? participant : r));
	await new Promise<void>((resolve, reject) => {
		const tx = db.transaction("demo_registrations", "readwrite");
		for (const r of updated) {
			tx.objectStore("demo_registrations").put(r);
		}
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
}

async function demoRegistrations(db: IDBDatabase): Promise<Participant[]> {
	return new Promise((resolve, reject) => {
		const req = db
			.transaction("demo_registrations")
			.objectStore("demo_registrations")
			.getAll();
		req.onsuccess = () => resolve((req.result as Participant[]) ?? []);
		req.onerror = () => reject(req.error);
	});
}

export function validateAmount(
	amount: number,
	competition: { fee: number; minDp: number } | undefined,
	mode: "dp" | "full",
): number {
	if (mode === "full") {
		return competition?.fee ?? amount;
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
	if (get(demoMode)) {
		const participant: Participant = {
			id: input.participantId,
			competitionId: input.competitionId,
			ticketNumber: `T-${Date.now() % 1_000_000}`,
			lapakNumber: null,
			name: "",
			phone: "",
			status: mode === "full" ? "fully_paid" : "dp_paid",
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
			const path = `proofs/${input.participantId}/${Date.now()}.jpg`;
			const { error: uploadError } = await sb.storage
				.from("proofs")
				.upload(path, input.proofBlob, { contentType: "image/jpeg" });
			if (!uploadError) {
				const { data } = sb.storage.from("proofs").getPublicUrl(path);
				proofUrl = data.publicUrl;
			}
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
	} catch {
		await enqueue(
			`payment:${input.participantId}:${mode}:${Date.now()}`,
			"/rest/payments",
			{
				participantId: input.participantId,
				competitionId: input.competitionId,
				method: input.method,
				amount,
				mode,
				proof: input.proofBlob ? await input.proofBlob.arrayBuffer() : null,
			},
		);
		return { paymentId: null, queued: true };
	}
}
