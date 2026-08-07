<script lang="ts">
	import { onMount } from "svelte";
	import CompetitionList from "$lib/components/CompetitionList.svelte";
	import type { RankSummary } from "$lib/components/CompetitionList.svelte";
	import HeroSection from "$lib/components/HeroSection.svelte";
	import { computeRanking, type ScoreRow } from "$lib/db/engine";
	import {
		getCompetitions,
		getLeaderboard,
		type Competition,
	} from "$lib/db/queries";
	import type { ScoringMode } from "$lib/db/schema";

	const tableForMode: Record<ScoringMode, "scores_mancing" | "scores_layangan" | "scores_layangan_hias"> = {
		terberat: "scores_mancing",
		kumulatif: "scores_mancing",
		jackpot_pita: "scores_mancing",
		layangan_aduan: "scores_layangan",
		layangan_hias: "scores_layangan_hias",
	};

	let competitions = $state<Competition[]>([]);
	let top3 = $state<Map<string, RankSummary[]>>(new Map());
	let loading = $state(true);
	let loadError = $state("");
	const totalQuota = $derived(
		competitions.reduce((sum, c) => sum + c.totalQuota, 0),
	);

	onMount(async () => {
		try {
			const list = await getCompetitions();
			competitions = list;			const summaries = new Map<string, RankSummary[]>();
			for (const c of list) {
				const table = tableForMode[c.scoringMode];
				const rows = await getLeaderboard(c.id, table);
				const ranked = computeRanking(
					rows as unknown as ScoreRow[],
					c.scoringMode,
				);
				const participants = new Map(
					rows.map((r) => [
						String(r.participantId ?? r.lapak_number ?? r.id),
						r.participants?.name ?? "Peserta",
					]),
				);
				summaries.set(
					c.id,
					ranked.slice(0, 3).map((r) => ({
						name: participants.get(r.key) ?? "Peserta",
						score: r.score,
						subScore: r.subScore,
					})),
				);
			}
			top3 = summaries;
		} catch (e) {
			loadError = e instanceof Error ? e.message : "Gagal memuat data";
		} finally {
			loading = false;
		}
	});
</script>

<svelte:head>
	<title>Beranda — Lomba Agustusan</title>
	<meta name="description" content="Pendaftaran lomba, skor real-time, dan papan peringkat." />
</svelte:head>

<main class="pb-16">
	<HeroSection competitionCount={competitions.length} quotaTotal={totalQuota} />

	{#if loadError}
		<p class="mx-auto max-w-3xl px-4 text-sm text-destructive" role="alert">
			{loadError}
		</p>
	{/if}

	<CompetitionList {competitions} {top3} {loading} />
</main>
