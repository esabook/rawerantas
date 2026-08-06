<script lang="ts">
	import { AlertTriangle, Wind, Loader2 } from "@lucide/svelte";
	import { onMount } from "svelte";
	import LayanganPanel from "$lib/components/LayanganPanel.svelte";
	import PinGate from "$lib/components/PinGate.svelte";
	import { getCompetitions } from "$lib/db/queries";
	import type { Competition } from "$lib/db/queries";
	import { env } from "$lib/env";
	import { sha256Hex } from "$lib/security/pin";

	let competitions = $state<Competition[]>([]);
	let loading = $state(true);
	let error = $state("");
	let recordedBy = $state("");

	const aduan = $derived(
		competitions.filter((c) => c.scoringMode === "layangan_aduan"),
	);
	const competition = $derived(aduan[0]);

	onMount(() => {
		void sha256Hex(env.juriPin).then((hash) => {
			recordedBy = hash;
		});
		void getCompetitions(false)
			.then((rows) => {
				competitions = rows;
			})
			.catch((e) => {
				error = e instanceof Error ? e.message : "Gagal memuat kompetisi.";
			})
			.finally(() => {
				loading = false;
			});
	});
</script>

<svelte:head>
	<title>Juri Layangan | {env.appName}</title>
</svelte:head>

<PinGate kind="juri" title="PIN Juri Layangan">
	{#snippet children()}
		<div class="px-4 py-8">
			{#if loading}
				<div class="flex flex-col items-center gap-2 py-16 text-muted-foreground">
					<Loader2 class="h-6 w-6 animate-spin" aria-hidden="true" />
					<p class="text-sm">Memuat…</p>
				</div>
			{:else if error || !competition}
				<div class="mx-auto max-w-sm rounded-xl border border-border bg-background/60 p-8 text-center">
					<AlertTriangle class="mx-auto h-8 w-8 text-destructive" aria-hidden="true" />
					<h1 class="mt-3 text-lg font-bold">Kompetisi aduan layangan tidak ditemukan</h1>
					<p class="mt-1 text-sm text-muted-foreground">
						Periksa konfigurasi kompetisi (scoring_mode layangan_aduan).
					</p>
				</div>
			{:else}
				<LayanganPanel
					competitionId={competition.id}
					competitionName={competition.name}
					round={competition.currentRound}
					{recordedBy}
				/>
			{/if}
		</div>
	{/snippet}
</PinGate>
