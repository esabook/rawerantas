import { get } from "svelte/store";
import { demoParticipants } from "$lib/demo/generator";
import { demoMode } from "$lib/demo/store";
import type { LeaderboardRow } from "./queries";
import { getLeaderboard } from "./queries";
import type { ScoringMode } from "./schema";

/**
 * Baris leaderboard untuk satu kompetisi — seed + skor lokal perangkat
 * (demo) atau query supabase (live). Urutan ASC received_at (engine
 * mengurutkan sendiri).
 */
export async function getLeaderboardRows(
	competitionId: string,
	mode: ScoringMode,
): Promise<LeaderboardRow[]> {
	if (!get(demoMode)) {
		const table =
			mode === "layangan_hias"
				? "scores_layangan_hias"
				: mode === "layangan_aduan"
					? "scores_layangan"
					: "scores_mancing";
		return getLeaderboard(competitionId, table);
	}
	const participantsMap = new Map(demoParticipants().map((p) => [p.id, p]));
	const rows: LeaderboardRow[] = [];
	const push = (r: {
		id: string;
		competitionId: string;
		participantId: string;
		receivedAt: Date | string;
		[key: string]: unknown;
	}) => {
		const p = participantsMap.get(r.participantId);
		rows.push({
			...r,
			participants: p ? { name: p.name, lapak_number: p.lapakNumber } : null,
		});
	};
	if (mode === "layangan_hias") {
		const { getAllHiasScores } = await import("./hias");
		for (const s of await getAllHiasScores(competitionId)) {
			push({
				id: s.participantId,
				competitionId: s.competitionId,
				participantId: s.participantId,
				receivedAt: s.receivedAt,
				aesthetic: s.aesthetic,
				stability: s.stability,
				creativity: s.creativity,
				total_weighted: s.totalWeighted,
			});
		}
	} else if (mode === "layangan_aduan") {
		const { getAllLayanganScores } = await import("./layangan");
		for (const s of await getAllLayanganScores(competitionId)) {
			push({
				id: s.id,
				competitionId: s.competitionId,
				participantId: s.participantId,
				receivedAt: s.receivedAt,
				status: s.status,
				round: s.round,
			});
		}
	} else {
		const { getAllScores } = await import("./scores");
		for (const s of await getAllScores(competitionId)) {
			push({
				id: s.id,
				competitionId: s.competitionId,
				participantId: s.participantId,
				receivedAt: s.receivedAt,
				weight: s.fishWeightGram,
				fishWeightGram: s.fishWeightGram,
				isJackpot: s.isJackpot,
			});
		}
	}
	return rows;
}
