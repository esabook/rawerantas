import type { InferSelectModel } from "drizzle-orm";
import { get } from "svelte/store";
import {
	demoHiasScores,
	demoLayanganScores,
	demoMancingScores,
	demoParticipants,
} from "$lib/demo/generator";
import { demoMode } from "$lib/demo/store";
import type {
	competitions,
	participantPayments,
	participants,
	paymentConfigs,
	scoresLayangan,
	scoresLayanganHias,
	scoresMancing,
} from "./schema";

let supabasePromise: Promise<typeof import("./supabaseClient")> | null = null;
export const getSupabase = () =>
	(supabasePromise ??= import("./supabaseClient").then((m) => m));

export type Competition = InferSelectModel<typeof competitions>;
export type PaymentConfig = InferSelectModel<typeof paymentConfigs>;
export type Participant = InferSelectModel<typeof participants>;
export type ParticipantPayment = InferSelectModel<typeof participantPayments>;
export type ScoreMancing = InferSelectModel<typeof scoresMancing>;
export type ScoreLayangan = InferSelectModel<typeof scoresLayangan>;
export type ScoreLayanganHias = InferSelectModel<typeof scoresLayanganHias>;

export type LeaderboardRow = {
	id: string;
	receivedAt: Date | string;
	competitionId: string;
	participantId: string;
	[key: string]: unknown;
	participants?: { name: string; lapak_number: string | null } | null;
};

type DbRow = Record<string, unknown>;

const value = <T>(row: DbRow, camel: string, snake: string): T =>
	(row[camel] ?? row[snake]) as T;

export const normalizeCompetitionRow = (row: DbRow): Competition =>
	({
		...row,
		scoringMode: value(row, "scoringMode", "scoring_mode"),
		minDp: value(row, "minDp", "min_dp"),
		totalQuota: value(row, "totalQuota", "total_quota"),
		currentRound: value(row, "currentRound", "current_round"),
		isActive: value(row, "isActive", "is_active"),
		createdAt: value(row, "createdAt", "created_at"),
	}) as Competition;

export const normalizePaymentConfigRow = (row: DbRow): PaymentConfig =>
	({
		...row,
		accountName: value(row, "accountName", "account_name"),
		accountNumber: value(row, "accountNumber", "account_number"),
		qrisImageUrl: value(row, "qrisImageUrl", "qris_image_url"),
		isActive: value(row, "isActive", "is_active"),
		createdAt: value(row, "createdAt", "created_at"),
	}) as PaymentConfig;

export const normalizeParticipantRow = (row: DbRow): Participant =>
	({
		...row,
		competitionId: value(row, "competitionId", "competition_id"),
		ticketNumber: value(row, "ticketNumber", "ticket_number"),
		lapakNumber: value(row, "lapakNumber", "lapak_number"),
		checkedInAt: value(row, "checkedInAt", "checked_in_at"),
		createdAt: value(row, "createdAt", "created_at"),
	}) as Participant;

export const normalizePaymentRow = (row: DbRow): ParticipantPayment =>
	({
		...row,
		participantId: value(row, "participantId", "participant_id"),
		paymentMethod: value(row, "paymentMethod", "payment_method"),
		proofImageUrl: value(row, "proofImageUrl", "proof_image_url"),
		isVerified: value(row, "isVerified", "is_verified"),
		verifiedBy: value(row, "verifiedBy", "verified_by"),
		rejectReason: value(row, "rejectReason", "reject_reason"),
		createdAt: value(row, "createdAt", "created_at"),
	}) as ParticipantPayment;

export const normalizeMancingScoreRow = (row: DbRow): ScoreMancing =>
	({
		...row,
		competitionId: value(row, "competitionId", "competition_id"),
		participantId: value(row, "participantId", "participant_id"),
		fishWeightGram: value(row, "fishWeightGram", "fish_weight_gram"),
		fishType: value(row, "fishType", "fish_type"),
		isJackpot: value(row, "isJackpot", "is_jackpot"),
		runningTotal: value(row, "runningTotal", "running_total"),
		recordedBy: value(row, "recordedBy", "recorded_by"),
		idempotencyKey: value(row, "idempotencyKey", "idempotency_key"),
		receivedAt: value(row, "receivedAt", "received_at"),
		createdAt: value(row, "createdAt", "created_at"),
	}) as ScoreMancing;

export const normalizeLayanganScoreRow = (row: DbRow): ScoreLayangan =>
	({
		...row,
		competitionId: value(row, "competitionId", "competition_id"),
		participantId: value(row, "participantId", "participant_id"),
		flightDurationMs: value(row, "flightDurationMs", "flight_duration_ms"),
		recordedBy: value(row, "recordedBy", "recorded_by"),
		idempotencyKey: value(row, "idempotencyKey", "idempotency_key"),
		receivedAt: value(row, "receivedAt", "received_at"),
		createdAt: value(row, "createdAt", "created_at"),
	}) as ScoreLayangan;

export const normalizeHiasScoreRow = (row: DbRow): ScoreLayanganHias =>
	({
		...row,
		competitionId: value(row, "competitionId", "competition_id"),
		participantId: value(row, "participantId", "participant_id"),
		totalWeighted: value(row, "totalWeighted", "total_weighted"),
		recordedBy: value(row, "recordedBy", "recorded_by"),
		idempotencyKey: value(row, "idempotencyKey", "idempotency_key"),
		receivedAt: value(row, "receivedAt", "received_at"),
		editedAt: value(row, "editedAt", "edited_at"),
		createdAt: value(row, "createdAt", "created_at"),
	}) as ScoreLayanganHias;

const normalizeLeaderboardRow = (
	row: DbRow,
	table: "scores_mancing" | "scores_layangan" | "scores_layangan_hias",
): LeaderboardRow => {
	const normalized =
		table === "scores_mancing"
			? normalizeMancingScoreRow(row)
			: table === "scores_layangan"
				? normalizeLayanganScoreRow(row)
				: normalizeHiasScoreRow(row);
	return {
		...normalized,
		weight:
			table === "scores_mancing"
				? (normalized as ScoreMancing).fishWeightGram
				: undefined,
		total_weighted:
			table === "scores_layangan_hias"
				? (normalized as ScoreLayanganHias).totalWeighted
				: row.total_weighted,
		participants: (row.participants ?? null) as LeaderboardRow["participants"],
	} as LeaderboardRow;
};

export async function getCompetitions(
	activeOnly = true,
): Promise<Competition[]> {
	if (get(demoMode)) {
		const { getMergedCompetitions } = await import("./admin");
		return getMergedCompetitions(activeOnly);
	}
	const { supabase } = await getSupabase();
	let query = supabase
		.from("competitions")
		.select("*")
		.order("created_at", { ascending: true });
	if (activeOnly) {
		query = query.eq("is_active", true);
	}
	const { data, error } = await query;
	if (error) {
		throw new Error(`getCompetitions: ${error.message}`);
	}
	return (data ?? []).map((row) => normalizeCompetitionRow(row as DbRow));
}

export async function getPaymentConfigs(
	activeOnly = true,
): Promise<PaymentConfig[]> {
	if (get(demoMode)) {
		const { getMergedPaymentConfigs } = await import("./admin");
		return getMergedPaymentConfigs(activeOnly);
	}
	const { supabase } = await getSupabase();
	// B4-3/A30: lewat RPC SECURITY DEFINER agar admin bisa membaca metode
	// non-aktif (RLS select hanya is_active=true).
	const { data, error } = await supabase.rpc("get_payment_configs", {
		p_active_only: activeOnly,
	});
	if (error) {
		throw new Error(`getPaymentConfigs: ${error.message}`);
	}
	return ((data ?? []) as DbRow[]).map((row) =>
		normalizePaymentConfigRow(row),
	);
}

export async function getParticipants(
	competitionId?: string,
): Promise<Participant[]> {
	if (get(demoMode)) {
		const all = demoParticipants();
		return competitionId
			? all.filter((p) => p.competitionId === competitionId)
			: all;
	}
	const { supabase } = await getSupabase();
	let query = supabase
		.from("participants")
		.select("*")
		.order("created_at", { ascending: true });
	if (competitionId) {
		query = query.eq("competition_id", competitionId);
	}
	const { data, error } = await query;
	if (error) {
		throw new Error(`getParticipants: ${error.message}`);
	}
	return (data ?? []).map((row) => normalizeParticipantRow(row as DbRow));
}

/**
 * Cari peserta per id. Mode demo: gabungan peserta seed + peserta lokal
 * (idb `demo_registrations`, termasuk yang baru daftar via register).
 */
export async function getParticipantById(
	id: string,
): Promise<Participant | null> {
	if (get(demoMode)) {
		const { demoLocalParticipants } = await import("$lib/db/register");
		const local = await demoLocalParticipants();
		return (
			local.find((p) => p.id === id) ??
			demoParticipants().find((p) => p.id === id) ??
			null
		);
	}
	const { supabase } = await getSupabase();
	const { data, error } = await supabase
		.from("participants")
		.select("*")
		.eq("id", id)
		.maybeSingle();
	if (error) {
		throw new Error(`getParticipantById: ${error.message}`);
	}
	return data ? normalizeParticipantRow(data as DbRow) : null;
}

export async function getPayments(
	participantId?: string,
): Promise<ParticipantPayment[]> {
	if (get(demoMode)) {
		const { getMergedPayments } = await import("./admin");
		const all = await getMergedPayments();
		return participantId
			? all.filter((p) => p.participantId === participantId)
			: all;
	}
	const { supabase } = await getSupabase();
	let query = supabase
		.from("participant_payments")
		.select("*")
		.order("created_at", { ascending: true });
	if (participantId) {
		query = query.eq("participant_id", participantId);
	}
	const { data, error } = await query;
	if (error) {
		throw new Error(`getPayments: ${error.message}`);
	}
	return (data ?? []).map((row) => normalizePaymentRow(row as DbRow));
}

export async function getLeaderboard(
	competitionId: string,
	table: "scores_mancing" | "scores_layangan" | "scores_layangan_hias",
	round?: number,
): Promise<LeaderboardRow[]> {
	if (get(demoMode)) {
		const participantsMap = new Map(demoParticipants().map((p) => [p.id, p]));
		const rows: Array<{
			id: string;
			receivedAt: Date | string;
			competitionId: string;
			participantId: string;
			round?: number;
		}> =
			table === "scores_mancing"
				? demoMancingScores()
				: table === "scores_layangan"
					? demoLayanganScores()
					: demoHiasScores();
		return rows
			.filter((r) => r.competitionId === competitionId)
			.filter((r) => round === undefined || r.round === round)
			.map((r) => {
				const participant = participantsMap.get(r.participantId);
				return {
					...r,
					participants: participant
						? { name: participant.name, lapak_number: participant.lapakNumber }
						: null,
				};
			});
	}
	const { supabase } = await getSupabase();
	let query = supabase
		.from(table)
		.select("*, participants(name, lapak_number)")
		.eq("competition_id", competitionId);
	if (round !== undefined) {
		query = query.eq("round", round);
	}
	const { data, error } = await query.order("received_at", { ascending: true });
	if (error) {
		throw new Error(`getLeaderboard: ${error.message}`);
	}
	return (data ?? []).map((row) =>
		normalizeLeaderboardRow(row as DbRow, table),
	);
}
