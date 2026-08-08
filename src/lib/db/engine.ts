import type { ScoringMode } from "./schema";

export interface ScoreRow {
	id: string;
	participantId?: string | null;
	lapakNumber?: number | null;
	weight?: number | null;
	runningTotal?: number | null;
	isJackpot?: boolean | null;
	aesthetic?: number | null;
	stability?: number | null;
	creativity?: number | null;
	totalWeighted?: number | null;
	status?: string | null;
	flightDurationMs?: number | null;
	receivedAt: Date | string;
}

export interface RankedResult {
	rank: number;
	key: string;
	score: number;
	subScore: number;
	bestAt: Date;
	entries: ScoreRow[];
}

export const HIAAS_WEIGHTS = {
	aesthetic: 0.4,
	stability: 0.4,
	creativity: 0.2,
} as const;

const toDate = (value: Date | string): Date =>
	value instanceof Date ? value : new Date(value);

const hiasTotal = (row: ScoreRow): number => {
	if (row.totalWeighted !== null && row.totalWeighted !== undefined) {
		return row.totalWeighted;
	}
	const a = row.aesthetic ?? 0;
	const s = row.stability ?? 0;
	const k = row.creativity ?? 0;
	return (
		a * HIAAS_WEIGHTS.aesthetic +
		s * HIAAS_WEIGHTS.stability +
		k * HIAAS_WEIGHTS.creativity
	);
};

const groupByParticipant = (rows: ScoreRow[]): Map<string, ScoreRow[]> => {
	const groups = new Map<string, ScoreRow[]>();
	for (const row of rows) {
		const key = row.participantId ?? row.lapakNumber?.toString() ?? row.id;
		const bucket = groups.get(key);
		if (bucket) {
			bucket.push(row);
		} else {
			groups.set(key, [row]);
		}
	}
	return groups;
};

const compute = (
	entries: ScoreRow[],
	mode: ScoringMode,
): { score: number; subScore: number; bestAt: Date } => {
	switch (mode) {
		case "terberat": {
			let score = -Infinity;
			let bestAt = entries[0] ? toDate(entries[0].receivedAt) : new Date(0);
			for (const entry of entries) {
				const weight = entry.weight ?? 0;
				if (weight > score) {
					score = weight;
					bestAt = toDate(entry.receivedAt);
				}
			}
			return { score: score === -Infinity ? 0 : score, subScore: 0, bestAt };
		}
		case "kumulatif": {
			const score = entries.reduce(
				(sum, entry) => sum + (entry.weight ?? entry.runningTotal ?? 0),
				0,
			);
			const bestAt =
				entries.length > 0
					? toDate(entries[entries.length - 1].receivedAt)
					: new Date(0);
			return { score, subScore: 0, bestAt };
		}
		case "jackpot_pita": {
			const jackpot = entries.find((entry) => entry.isJackpot);
			let weight = -Infinity;
			let weightAt = entries[0] ? toDate(entries[0].receivedAt) : new Date(0);
			for (const entry of entries) {
				const w = entry.weight ?? 0;
				if (w > weight) {
					weight = w;
					weightAt = toDate(entry.receivedAt);
				}
			}
			const bestAt = jackpot ? toDate(jackpot.receivedAt) : weightAt;
			return {
				score: jackpot ? 1 : 0,
				subScore: weight === -Infinity ? 0 : weight,
				bestAt,
			};
		}
		case "layangan_aduan": {
			const wins = entries.filter((entry) => entry.status === "menang");
			const bestAt = wins.length > 0 ? toDate(wins[0].receivedAt) : new Date(0);
			const totalDuration = entries.reduce(
				(sum, entry) => sum + (entry.flightDurationMs ?? 0),
				0,
			);
			return { score: wins.length, subScore: totalDuration, bestAt };
		}
		case "layangan_hias": {
			let score = -Infinity;
			let bestAt = entries[0] ? toDate(entries[0].receivedAt) : new Date(0);
			for (const entry of entries) {
				const total = hiasTotal(entry);
				if (total > score) {
					score = total;
					bestAt = toDate(entry.receivedAt);
				}
			}
			return { score: score === -Infinity ? 0 : score, subScore: 0, bestAt };
		}
	}
};

export function computeRanking(
	rows: ScoreRow[],
	mode: ScoringMode,
): RankedResult[] {
	const sorted = [...rows].sort(
		(a, b) => toDate(a.receivedAt).getTime() - toDate(b.receivedAt).getTime(),
	);
	const results: Array<{
		key: string;
		entries: ScoreRow[];
		score: number;
		subScore: number;
		bestAt: Date;
	}> = [];
	for (const [key, entries] of groupByParticipant(sorted)) {
		const { score, subScore, bestAt } = compute(entries, mode);
		results.push({ key, entries, score, subScore, bestAt });
	}
	results.sort((a, b) => {
		if (b.score !== a.score) return b.score - a.score;
		if (b.subScore !== a.subScore) return b.subScore - a.subScore;
		const byTime = a.bestAt.getTime() - b.bestAt.getTime();
		if (byTime !== 0) return byTime;
		return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
	});
	return results.map((result, index) => ({ rank: index + 1, ...result }));
}

export function calculateHiasTotal(
	aesthetic: number,
	stability: number,
	creativity: number,
): number {
	return (
		aesthetic * HIAAS_WEIGHTS.aesthetic +
		stability * HIAAS_WEIGHTS.stability +
		creativity * HIAAS_WEIGHTS.creativity
	);
}
