import { nextTicketNumber, normalizePhone } from "$lib/db/register";
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
		case "/rest/participants/checkin":
			return toResult(() =>
				supabase
					.from("participants")
					.update({
						status: "checked_in",
						checked_in_at: new Date().toISOString(),
					})
					.eq("id", payload.participantId as string),
			);

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
		if (!uploadError) {
			const { data } = supabase.storage
				.from(PROOF_IMAGES_BUCKET)
				.getPublicUrl(path);
			proofUrl = data.publicUrl;
		}
	}
	const { error, data } = await supabase
		.from("participant_payments")
		.insert({
			participant_id: payload.participantId,
			amount: payload.amount,
			payment_method: payload.method,
			proof_image_url: proofUrl,
			is_verified: payload.isCash,
		})
		.select("id")
		.single();
	if (error) {
		return isUniqueViolation(error) ? "conflict" : "error";
	}
	if (data) {
		await supabase
			.from("participants")
			.update({ status: payload.mode === "full" ? "fully_paid" : "dp_paid" })
			.eq("id", payload.participantId as string);
	}
	return "ok";
}

async function executeRegister(
	supabase: SupabaseClient,
	payload: Record<string, unknown>,
): Promise<SyncResult> {
	const phone = normalizePhone(payload.phone as string);
	const { data: existing } = await supabase
		.from("participants")
		.select("id")
		.eq("competition_id", payload.competitionId as string)
		.eq("phone", phone)
		.maybeSingle();
	if (existing) {
		return "conflict";
	}
	const { error } = await supabase.from("participants").insert({
		competition_id: payload.competitionId,
		name: payload.name,
		phone,
		ticket_number: nextTicketNumber(Date.now() % 1_000_000),
		status: "registered",
	});
	return error ? (isUniqueViolation(error) ? "conflict" : "error") : "ok";
}
