import { normalizePhone } from "$lib/db/register";
import { PROOF_IMAGES_BUCKET } from "$lib/db/storage";
import type { ExecuteOp, SyncResult } from "./sync";

/** Postgres unique_violation — retry setelah sukses = konflik, bukan galat. */
function isUniqueViolation(error: unknown): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		(error as { code?: unknown }).code === "23505"
	);
}

async function toResult(
	op: () => PromiseLike<{ error: unknown }>,
): Promise<SyncResult> {
	const { error } = await op();
	if (!error) return "ok";
	return isUniqueViolation(error) ? "conflict" : "error";
}

type SupabaseClient = typeof import("$lib/db/supabaseClient")["supabase"];

/**
 * Jalankan satu op antrean offline lewat Supabase — cermin dari live-path
 * masing-masing modul db/*.ts (scores.ts, layangan.ts, hias.ts, checkin.ts,
 * payment.ts, register.ts). Dipakai oleh runSyncOnce() saat drain antrean.
 */
export const executeQueueEntry: ExecuteOp = async (entry) => {
	const { supabase } = await import("$lib/db/supabaseClient");
	const payload = entry.payload as Record<string, unknown>;

	switch (entry.endpoint) {
		case "/rest/participants/checkin": {
			// B1-5/A22: drain memakai RPC check_in — eligibility dicek ulang server
			// (bukan update buta); penolakan bisnis → conflict (hentikan retry).
			let rpcResponse: { data: unknown; error: unknown };
			try {
				rpcResponse = await supabase.rpc("check_in", {
					p_participant_id: payload.participantId,
					p_recorded_by: payload.recordedBy ?? null,
				});
			} catch {
				return "error";
			}
			if (rpcResponse.error) {
				return "error";
			}
			const result = rpcResponse.data as
				| { ok?: boolean; reason?: string }
				| undefined;
			return result?.ok === true ? "ok" : "conflict";
		}

		case "/rest/scores/mancing":
			return toResult(() =>
				supabase.from("scores_mancing").insert({
					competition_id: payload.competitionId,
					participant_id: payload.participantId,
					fish_weight_gram: payload.fishWeightGram,
					is_jackpot: payload.isJackpot,
					recorded_by: payload.recordedBy,
					idempotency_key: payload.idempotencyKey,
				}),
			);

		case "/rest/scores/mancing/delete": {
			// QW-2/A25: undo pasca-drain tiba sebagai idempotencyKey, bukan
			// UUID baris — pilih kolom sesuai identitas di payload.
			const column =
				payload.idempotencyKey !== undefined ? "idempotency_key" : "id";
			const value = (payload.idempotencyKey ?? payload.scoreId) as string;
			return toResult(() =>
				supabase.from("scores_mancing").delete().eq(column, value),
			);
		}

		case "/rest/scores/layangan":
			return toResult(() =>
				supabase.from("scores_layangan").insert({
					competition_id: payload.competitionId,
					participant_id: payload.participantId,
					round: payload.round,
					status: payload.status,
					flight_duration_ms: payload.flightDurationMs,
					recorded_by: payload.recordedBy,
					idempotency_key: payload.idempotencyKey,
				}),
			);

		case "/rest/scores/layangan/delete": {
			// QW-2/A25: sama seperti mancing — dukung delete via idempotency_key.
			const column =
				payload.idempotencyKey !== undefined ? "idempotency_key" : "id";
			const value = (payload.idempotencyKey ?? payload.scoreId) as string;
			return toResult(() =>
				supabase.from("scores_layangan").delete().eq(column, value),
			);
		}

		case "/rest/scores/layangan-hias":
			if (payload.existing) {
				return toResult(() =>
					supabase
						.from("scores_layangan_hias")
						.update({
							aesthetic: payload.aesthetic,
							stability: payload.stability,
							creativity: payload.creativity,
							edited_at: new Date().toISOString(),
							recorded_by: payload.recordedBy,
						})
						.eq("participant_id", payload.participantId as string)
						.eq("competition_id", payload.competitionId as string),
				);
			}
			return toResult(() =>
				supabase.from("scores_layangan_hias").insert({
					competition_id: payload.competitionId,
					participant_id: payload.participantId,
					aesthetic: payload.aesthetic,
					stability: payload.stability,
					creativity: payload.creativity,
					recorded_by: payload.recordedBy,
					idempotency_key: payload.idempotencyKey,
				}),
			);

		case "/rest/payments":
			return executePayment(supabase, payload);

		case "/rest/participants":
			return executeRegister(supabase, payload);

		default:
			return "error";
	}
};

async function executePayment(
	supabase: SupabaseClient,
	payload: Record<string, unknown>,
): Promise<SyncResult> {
	let proofUrl: string | null = null;
	const proof = payload.proof as ArrayBuffer | null;
	if (proof && !payload.isCash) {
		const mime =
			(payload.proofMime as string) === "image/webp"
				? "image/webp"
				: (payload.proofMime as string) === "image/png"
					? "image/png"
					: "image/jpeg";
		const ext =
			mime === "image/webp" ? "webp" : mime === "image/png" ? "png" : "jpg";
		const blob = new Blob([proof], { type: mime });
		const path = `proofs/${payload.participantId}/${Date.now()}.${ext}`;
		const { error: uploadError } = await supabase.storage
			.from(PROOF_IMAGES_BUCKET)
			.upload(path, blob, { contentType: mime });
		if (uploadError) {
			// QW-6/F15/A20: jangan insert pembayaran tanpa bukti — laporkan
			// gagal agar antrean me-retry (sampai cap RETRIES_CAP → dead).
			return "error";
		}
		const { data } = supabase.storage
			.from(PROOF_IMAGES_BUCKET)
			.getPublicUrl(path);
		proofUrl = data.publicUrl;
	}
	// B1-1 (F14/F24/A19/F9): tulis via RPC `submit_payment` — dedup
	// idempotency_key, validasi nominal, dan recalc status terjadi atomik
	// di server (F9: tak ada lagi update status yang tak diperiksa).
	let rpcResponse: { data: unknown; error: unknown };
	try {
		rpcResponse = await supabase.rpc("submit_payment", {
			p_participant_id: payload.participantId,
			p_method: payload.method,
			p_amount: payload.amount,
			p_proof_url: proofUrl,
			p_is_cash: payload.isCash,
			p_idempotency_key: payload.idempotencyKey ?? null,
			p_phone: payload.phone ?? null,
		});
	} catch {
		return "error";
	}
	if (rpcResponse.error) {
		return "error";
	}
	const result = rpcResponse.data as { ok?: boolean } | undefined;
	// Penolakan bisnis (phone mismatch, diskualifikasi, nominal) deterministik
	// — hentikan retry sebagai conflict, bukan mengulang sampai dead.
	return result?.ok ? "ok" : "conflict";
}

async function executeRegister(
	supabase: SupabaseClient,
	payload: Record<string, unknown>,
): Promise<SyncResult> {
	const phone = normalizePhone(payload.phone as string);
	// B1-4 (F1/F2/F3/F12): registrasi via RPC — kuota atomik, tiket sequence,
	// dedupe idempoten di server (bukan insert/cari manual).
	let rpcResponse: { data: unknown; error: unknown };
	try {
		rpcResponse = await supabase.rpc("register_participant", {
			p_competition: payload.competitionId,
			p_name: payload.name,
			p_phone: phone,
			p_idempotency_key: payload.idempotencyKey ?? null,
		});
	} catch {
		return "error";
	}
	if (rpcResponse.error) {
		return "error";
	}
	const result = rpcResponse.data as
		| { ok?: boolean; reason?: string }
		| undefined;
	// Kuota penuh / penolakan bisnis deterministik → hentikan retry sebagai
	// conflict; error lain → retry.
	return result?.ok === true ? "ok" : "conflict";
}
