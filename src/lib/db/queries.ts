import type { InferSelectModel } from "drizzle-orm";
import { get } from "svelte/store";
import {
	demoCompetitions,
	demoHiasScores,
	demoLayanganScores,
	demoMancingScores,
	demoParticipants,
	demoPayments,
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
import { supabase } from "./supabaseClient";

export type Competition = InferSelectModel<typeof competitions>;
export type PaymentConfig = InferSelectModel<typeof paymentConfigs>;
export type Participant = InferSelectModel<typeof participants>;
export type ParticipantPayment = InferSelectModel<typeof participantPayments>;
export type ScoreMancing = InferSelectModel<typeof scoresMancing>;
export type ScoreLayangan = InferSelectModel<typeof scoresLayangan>;
export type ScoreLayanganHias = InferSelectModel<typeof scoresLayanganHias>;

export type LeaderboardRow = Record<string, unknown> & {
	participants?: { name: string; lapak_number: string | null } | null;
};

export async function getCompetitions(
	activeOnly = true,
): Promise<Competition[]> {
	if (get(demoMode)) {
		const all = demoCompetitions();
		return activeOnly ? all.filter((c) => c.isActive) : all;
	}
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
	if (get(demoMode)) {
		return [];
	}
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
	if (get(demoMode)) {
		const all = demoParticipants();
		return competitionId
			? all.filter((p) => p.competitionId === competitionId)
			: all;
	}
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

export async function getPayments(
	participantId?: string,
): Promise<ParticipantPayment[]> {
	if (get(demoMode)) {
		const all = demoPayments();
		return participantId
			? all.filter((p) => p.participantId === participantId)
			: all;
	}
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
	return (data ?? []) as ParticipantPayment[];
}

export async function getLeaderboard(
	competitionId: string,
	table: "scores_mancing" | "scores_layangan" | "scores_layangan_hias",
): Promise<LeaderboardRow[]> {
	if (get(demoMode)) {
		const participantsMap = new Map(demoParticipants().map((p) => [p.id, p]));
		const rows: Array<{
			id: string;
			receivedAt: Date | string;
			competitionId: string;
			participantId: string;
		}> =
			table === "scores_mancing"
				? demoMancingScores()
				: table === "scores_layangan"
					? demoLayanganScores()
					: demoHiasScores();
		return rows
			.filter((r) => r.competitionId === competitionId)
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
	const { data, error } = await supabase
		.from(table)
		.select("*, participants(name, lapak_number)")
		.eq("competition_id", competitionId)
		.order("received_at", { ascending: true });
	if (error) {
		throw new Error(`getLeaderboard: ${error.message}`);
	}
	return (data ?? []) as LeaderboardRow[];
}
