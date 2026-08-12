<script lang="ts">
	import { AlertTriangle, Loader2, Wind } from "@lucide/svelte";
	import { onMount } from "svelte";
	import HiasPanel from "$lib/components/HiasPanel.svelte";
	import PinGate from "$lib/components/PinGate.svelte";
	import { getCompetitions } from "$lib/db/queries";
	import type { Competition } from "$lib/db/queries";
	import { formatStaffActor } from "$lib/db/staff";
	import { env } from "$lib/env";
	import { readStaffGrant } from "$lib/security/pin";

	let competitions = $state<Competition[]>([]);
	let loading = $state(true);
	let error = $state("");
	let recordedBy = $state("");
	let selectedId = $state<string | null>(null);

	const hias = $derived(
		competitions
			.filter((c) => c.isActive)
			.filter((c) => c.scoringMode === "layangan_hias"),
	);
	const competition = $derived(
		hias.find((c) => c.id === selectedId) ?? hias[0],
	);

	onMount(() => {
		const staff = readStaffGrant("juri");
		recordedBy = staff
			? formatStaffActor({ id: staff.staffId, name: staff.name })
			: "";
		const load = () =>
			getCompetitions(false)
				.then((rows) => {
					competitions = rows;
				})
				.catch((e) => {
					error = e instanceof Error ? e.message : "Gagal memuat kompetisi.";
				})
				.finally(() => {
					loading = false;
				});
		void load();
		const timer = setInterval(load, 30_000);
		return () => clearInterval(timer);
	});
</script>

<svelte:head>
	<title>Juri Layangan Hias | {env.appName}</title>
</svelte:head>

<PinGate kind="juri" title="PIN Juri Layangan Hias">
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
					<h1 class="mt-3 text-lg font-bold">Kompetisi layangan hias tidak ditemukan</h1>
					<p class="mt-1 text-sm text-muted-foreground">
						Periksa konfigurasi kompetisi (scoring_mode layangan_hias).
					</p>
				</div>
			{:else}
				<div class="mb-4 flex flex-wrap items-center gap-3">
					{#if hias.length > 1}
						<label class="flex items-center gap-2 text-sm">
							<span class="text-muted-foreground">Kompetisi</span>
							<select
								class="input"
								value={competition?.id ?? ""}
								onchange={(e) =>
									(selectedId = e.currentTarget.value)}
							>
								{#each hias as c (c.id)}
									<option value={c.id}>{c.name}</option>
								{/each}
							</select>
						</label>
					{/if}
				</div>
				<HiasPanel
					competitionId={competition.id}
					competitionName={competition.name}
					{recordedBy}
				/>
			{/if}
		</div>
	{/snippet}
</PinGate>
