<script lang="ts">
	import { Crown, Medal } from "@lucide/svelte";
	import { computeRanking } from "$lib/db/engine";
	import type { ScoreRow } from "$lib/db/engine";
	import type { LeaderboardRow } from "$lib/db/queries";
	import type { Competition } from "$lib/db/queries";

	let {
		competition,
		rows,
	}: {
		competition: Competition;
		rows: LeaderboardRow[];
	} = $props();

	const toScoreRow = (row: LeaderboardRow): ScoreRow => {
		const base: ScoreRow = {
			id: String(row.id),
			participantId: row.participantId,
			receivedAt: row.receivedAt,
		};
		if (competition.scoringMode === "layangan_hias") {
			return {
				...base,
				aesthetic: Number(row.aesthetic ?? 0),
				stability: Number(row.stability ?? 0),
				creativity: Number(row.creativity ?? 0),
				totalWeighted: Number(
					row.totalWeighted ?? row.total_weighted ?? 0,
				),
			};
		}
		if (competition.scoringMode === "layangan_aduan") {
			return {
				...base,
				status: String(row.status ?? ""),
				flightDurationMs: Number(
					row.flightDurationMs ?? row.flight_duration_ms ?? 0,
				),
			};
		}
		return {
			...base,
			weight: Number(row.fishWeightGram ?? row.weight ?? 0),
			isJackpot: Boolean(row.isJackpot ?? row.is_jackpot),
		};
	};

	const ranking = $derived(
		computeRanking(rows.map(toScoreRow), competition.scoringMode),
	);
	const nameOf = (row: LeaderboardRow) =>
		(row.participants as { name?: string; lapak_number?: string } | null)
			?.name ?? "Peserta";
	const lapakOf = (row: LeaderboardRow) =>
		(row.participants as { name?: string; lapak_number?: string } | null)
			?.lapak_number;
	const formatSavedAt = (value: Date | string): string => {
		const date = value instanceof Date ? value : new Date(value);
		if (Number.isNaN(date.getTime())) {
			return "waktu tidak tersedia";
		}
		return new Intl.DateTimeFormat("id-ID", {
			day: "2-digit",
			month: "short",
			hour: "2-digit",
			minute: "2-digit",
		}).format(date);
	};

	const formatScore = (score: number, subScore: number): string => {
		switch (competition.scoringMode) {
			case "terberat":
			case "kumulatif":
			case "jackpot_pita":
				return `${(score / 1000).toLocaleString("id-ID")} kg`;
			case "layangan_aduan":
				return `${score} menang`;
			case "layangan_hias":
				return `${score.toFixed(1)} poin`;
		}
	};

	const formatDuration = (ms: number): string => {
		const totalSeconds = Math.max(0, Math.round(ms / 1000));
		const minutes = Math.floor(totalSeconds / 60);
		const seconds = totalSeconds % 60;
		return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
	};

	const maxDuration = (entries: ScoreRow[]): number =>
		entries.reduce(
			(max, entry) => Math.max(max, entry.flightDurationMs ?? 0),
			0,
		);

	const byParticipant = $derived(
		new Map(rows.map((r) => [r.participantId, r])),
	);
</script>

<div class="flex flex-col gap-3">
	{#if rows.length === 0}
		<div
			class="rounded-lg border border-border/60 p-8 text-center text-sm text-muted-foreground"
		>
			Belum ada skor tercatat.
		</div>
	{:else}
		<ol class="flex flex-col gap-2">
			{#each ranking as entry (entry.key)}
				{@const row = byParticipant.get(entry.key)}
				<li
					class="flex items-center justify-between gap-3 rounded-lg border px-2 py-2.5 {entry.rank ===
					1
						? 'border-gold bg-gold/10'
						: 'border-border/60'}"
				>
					<div class="flex min-w-0 items-center gap-3">
						<span
							class="w-6 shrink-0 text-center font-mono text-sm font-bold"
						>
							{#if entry.rank === 1}
								<Crown
									class="mx-auto h-4 w-4 text-gold"
									aria-hidden="true"
								/>
							{:else if entry.rank === 2}
								<Medal
									class="mx-auto h-4 w-4 text-slate-300"
									aria-hidden="true"
								/>
							{:else if entry.rank === 3}
								<Medal
									class="mx-auto h-4 w-4 text-amber-700"
									aria-hidden="true"
								/>
							{:else}
								{entry.rank}
							{/if}
						</span>
						<div class="min-w-0">
							<p class="truncate text-sm font-semibold">
								{row ? nameOf(row) : "Peserta"}
							</p>
							<p class="text-xs text-muted-foreground">
								{row && lapakOf(row)
									? `BIB ${lapakOf(row)}`
									: ""}
								{#if entry.entries.length > 1}
									· {entry.entries.length} skor
								{/if}
							</p>
							<p class="text-[10px] text-muted-foreground/80">
								Poin tersimpan {formatSavedAt(entry.bestAt)}
							</p>
						</div>
					</div>
					<span
						class="shrink-0 text-right font-mono text-sm font-bold tabular-nums"
					>
						{#if competition.scoringMode === "layangan_aduan"}
							{entry.score} menang
							<br />
							<span class="text-[10px] font-normal text-muted-foreground">
								Total {formatDuration(entry.subScore)} · Terlama {formatDuration(
									maxDuration(entry.entries),
								)}
							</span>
						{:else}
							{formatScore(entry.score, entry.subScore)}
						{/if}
					</span>
				</li>
			{/each}
		</ol>
	{/if}
</div>
