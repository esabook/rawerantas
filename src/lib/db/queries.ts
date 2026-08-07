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
	return (data ?? []) as Competition[];
}

export async function getPaymentConfigs(
	activeOnly = true,
): Promise<PaymentConfig[]> {
	if (get(demoMode)) {
		const { getMergedPaymentConfigs } = await import("./admin");
		return getMergedPaymentConfigs(activeOnly);
	}
	const { supabase } = await getSupabase();
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
	return (data ?? []) as Participant[];
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
	return (data ?? null) as Participant | null;
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
	const { supabase } = await getSupabase();
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
