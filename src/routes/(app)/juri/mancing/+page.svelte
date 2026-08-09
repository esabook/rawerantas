<script lang="ts">
	import { AlertTriangle, Loader2 } from "@lucide/svelte";
	import { onMount } from "svelte";
	import PinGate from "$lib/components/PinGate.svelte";
	import MancingPanel from "$lib/components/MancingPanel.svelte";
	import { getCompetitions } from "$lib/db/queries";
	import type { Competition } from "$lib/db/queries";
	import { env } from "$lib/env";
	import { readOfficer, sha256Hex } from "$lib/security/pin";

	let competitions = $state<Competition[]>([]);
	let loading = $state(true);
	let error = $state("");
	let recordedBy = $state("");
	let selectedId = $state<string | null>(null);
	let roundWarning = $state("");

	const mancing = $derived(
		competitions
			.filter((c) => c.isActive)
			.filter((c) =>
				["terberat", "kumulatif", "jackpot_pita"].includes(c.scoringMode),
			),
	);
	const competition = $derived(
		mancing.find((c) => c.id === selectedId) ?? mancing[0],
	);

	onMount(() => {
		void sha256Hex(env.juriPin)
			.then((hash) => {
				// B4-6/A14: rekam identitas petugas + hash PIN di recordedBy.
				const officer = readOfficer("juri");
				recordedBy = officer ? `${hash}:${officer}` : hash;
			})
			.catch(() => {
				recordedBy = "";
			});
		const load = () =>
			getCompetitions(false)
				.then((rows) => {
					competitions = rows;
					// B3-2/A29: deteksi perubahan babak saat halaman terbuka.
					const prev = competition;
					if (prev) {
						const next = rows.find((c) => c.id === prev.id);
						if (next && next.currentRound !== prev.currentRound) {
							roundWarning = `Babak berubah ke ${next.currentRound} oleh admin.`;
						}
					}
				})
				.catch((e) => {
					error = e instanceof Error ? e.message : "Gagal memuat kompetisi.";
				})
				.finally(() => {
					loading = false;
				});
		void load();
		// B3-2/A29: polling 30 detik utk deteksi perubahan babak/reaktif.
		const timer = setInterval(load, 30_000);
		return () => clearInterval(timer);
	});
</script>

<svelte:head>
	<title>Juri Mancing | {env.appName}</title>
</svelte:head>

<PinGate kind="juri" title="PIN Juri Mancing">
	{#snippet children()}
		<div class="px-4 py-8">
			{#if loading}
				<div class="flex flex-col items-center gap-2 py-16 text-muted-foreground">
					<Loader2 class="h-6 w-6 animate-spin" aria-hidden="true" />
					<p class="text-sm">Memuat…</p>
				</div>
			{:else if error || !competition}
				<div class="rounded-xl border border-border bg-background/60 p-8 text-center">
					<AlertTriangle class="mx-auto h-8 w-8 text-destructive" aria-hidden="true" />
					<h1 class="mt-3 text-lg font-bold">Kompetisi mancing tidak ditemukan</h1>
					<p class="mt-1 text-sm text-muted-foreground">
						Periksa konfigurasi kompetisi (scoring_mode mancing).
					</p>
				</div>
			{:else}
				<div class="mb-4 flex flex-wrap items-center gap-3">
					{#if mancing.length > 1}
						<label class="flex items-center gap-2 text-sm">
							<span class="text-muted-foreground">Kompetisi</span>
							<select
								class="input"
								value={competition?.id ?? ""}
								onchange={(e) =>
									(selectedId = e.currentTarget.value)}
							>
								{#each mancing as c (c.id)}
									<option value={c.id}>{c.name}</option>
								{/each}
							</select>
						</label>
					{/if}
					{#if roundWarning}
						<span
							class="rounded-lg border border-amber-300/30 bg-amber-300/10 px-2 py-1 text-xs text-amber-200"
							role="status"
							>{roundWarning}</span
						>
					{/if}
				</div>
				<MancingPanel
					competitionId={competition.id}
					competitionName={competition.name}
					{recordedBy}
				/>
			{/if}
		</div>
	{/snippet}
</PinGate>
