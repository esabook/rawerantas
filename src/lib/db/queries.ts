import type { InferSelectModel } from "drizzle-orm";
import type {
	competitions,
	participantPayments,
	participants,
	paymentConfigs,
	scoresLayangan,
	scoresLayanganHias,
	scoresMancing,
} from "./schema";
import { supabase } from "./supabaseClient";

export type Competition = InferSelectModel<typeof competitions>;
export type PaymentConfig = InferSelectModel<typeof paymentConfigs>;
export type Participant = InferSelectModel<typeof participants>;
export type ParticipantPayment = InferSelectModel<typeof participantPayments>;
export type ScoreMancing = InferSelectModel<typeof scoresMancing>;
export type ScoreLayangan = InferSelectModel<typeof scoresLayangan>;
export type ScoreLayanganHias = InferSelectModel<typeof scoresLayanganHias>;

export async function getCompetitions(
	activeOnly = true,
): Promise<Competition[]> {
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
	return (data ?? []) as Competition[];
}

export async function getPaymentConfigs(
	activeOnly = true,
): Promise<PaymentConfig[]> {
	let query = supabase
		.from("payment_configs")
		.select("*")
		.order("created_at", { ascending: true });
	if (activeOnly) {
		query = query.eq("is_active", true);
	}
	const { data, error } = await query;
	if (error) {
		throw new Error(`getPaymentConfigs: ${error.message}`);
	}
	return (data ?? []) as PaymentConfig[];
}

export async function getParticipants(
	competitionId?: string,
): Promise<Participant[]> {
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
	return (data ?? []) as Participant[];
}

export async function getLeaderboard(
	competitionId: string,
	table: "scores_mancing" | "scores_layangan" | "scores_layangan_hias",
): Promise<Record<string, unknown>[]> {
	const { data, error } = await supabase
		.from(table)
		.select("*, participants(name, lapak_number)")
		.eq("competition_id", competitionId)
		.order("received_at", { ascending: true });
	if (error) {
		throw new Error(`getLeaderboard: ${error.message}`);
	}
	return (data ?? []) as Record<string, unknown>[];
}
