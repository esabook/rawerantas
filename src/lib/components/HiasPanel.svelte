<script lang="ts">
	import { CheckCircle2, Loader2, Pencil, Wind } from "@lucide/svelte";
	import { onMount } from "svelte";
	import { sfx, vibrate } from "$lib/audio/sfx";
	import { undoable } from "$lib/components/toast/toastStore";
	import {
		computeHiasTotal,
		getHiasScore,
		isWithinEditWindow,
		removeHiasScore,
		submitHiasScore,
	} from "$lib/db/hias";
	import { getParticipants } from "$lib/db/queries";
	import type { Participant } from "$lib/db/queries";
	import { online } from "$lib/offline/networkStore";

	let {
		competitionId,
		competitionName,
		recordedBy,
	}: {
		competitionId: string;
		competitionName: string;
		recordedBy: string;
	} = $props();

	let participants = $state<Participant[]>([]);
	let selectedId = $state<string | null>(null);
	let aesthetic = $state(80);
	let stability = $state(80);
	let creativity = $state(80);
	let scored = $state<Record<string, { total: number; editable: boolean }>>(
		{},
	);
	let submitting = $state(false);
	let error = $state("");

	const selected = $derived(participants.find((p) => p.id === selectedId));
	const totalPreview = $derived(
		computeHiasTotal(aesthetic, stability, creativity),
	);
	const canSubmit = $derived(selectedId !== null && !submitting);

	const load = async () => {
		// B3-1/A23: offline-safe — kegagalan fetch tidak boleh mengosongkan panel.
		try {
			const rows = await getParticipants(competitionId);
			participants = rows;
			const map: Record<string, { total: number; editable: boolean }> = {};
			for (const p of rows) {
				const score = await getHiasScore(competitionId, p.id);
				if (score) {
					map[p.id] = {
						total: score.totalWeighted,
						editable: isWithinEditWindow(score),
					};
				}
			}
			scored = map;
		} catch {
			// pertahankan data yang sudah ada.
		}
	};

	onMount(() => {
		void load();
		// B3-3/A36: polling ringan agar peserta baru muncul tanpa reload.
		const timer = setInterval(load, 30_000);
		return () => clearInterval(timer);
	});

	const select = async (p: Participant) => {
		selectedId = p.id;
		error = "";
		sfx.tap();
		vibrate(10);
		const score = await getHiasScore(competitionId, p.id);
		aesthetic = score?.aesthetic ?? 80;
		stability = score?.stability ?? 80;
		creativity = score?.creativity ?? 80;
	};

	const submit = async () => {
		if (!canSubmit || !selected) {
			return;
		}
		if (scored[selected.id] && !scored[selected.id].editable) {
			error = "Jendela edit 5 menit telah berlalu. Rescore ditolak.";
			return;
		}
		submitting = true;
		error = "";
		try {
			const result = await submitHiasScore({
				competitionId,
				participantId: selected.id,
				aesthetic,
				stability,
				creativity,
				recordedBy,
			});
			const label = `${selected.name} — ${totalPreview} poin`;
			undoable(
				result.queued ? `Antrean: ${label}` : `Tersimpan: ${label}`,
				{
					onUndo: () => {
						if (selected) {
							void removeHiasScore(selected.competitionId, selected.id).then(
								() => {
									void load();
									undoable("Skor hias dibatalkan.", {
										onConfirm: () => {},
									});
								},
							);
						}
					},
					onConfirm: () => {},
				},
			);
			scored[selected.id] = { total: totalPreview, editable: true };
			await load();
			sfx.coin();
			vibrate(80);
		} catch (e) {
			sfx.error();
			vibrate([120, 60, 120]);
			error = e instanceof Error ? e.message : "Gagal menyimpan skor.";
		} finally {
			submitting = false;
		}
	};
</script>

<div
	class="flex w-full flex-col gap-4 rounded-xl border border-border bg-background/60 p-4"
>
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-2">
			<Wind class="h-5 w-5 text-gold" aria-hidden="true" />
			<h1 class="font-bold">{competitionName}</h1>
		</div>
		{#if !$online}
			<span
				class="rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-600"
			>
				Offline — antrean
			</span>
		{/if}
	</div>

	{#if error}
		<p class="text-sm text-destructive" role="alert">{error}</p>
	{/if}

	<ul class="flex flex-wrap gap-2">
		{#each participants as p (p.id)}
			{@const score = scored[p.id]}
			<button
				type="button"
				class="btn flex flex-col gap-0.5 px-2 py-2 text-left text-sm {selectedId ===
				p.id
					? 'border-gold'
					: ''}"
				onclick={() => void select(p)}
			>
				<span class="font-semibold">{p.name}</span>
				<span class="text-xs text-muted-foreground">
					{#if score}
						{score.total} poin
						{#if score.editable}
							<span
								class="inline-flex items-center gap-0.5 text-gold"
							>
								<Pencil class="h-3 w-3" aria-hidden="true" /> edit
							</span>
						{/if}
					{:else}
						belum diskor
					{/if}
				</span>
			</button>
		{/each}
	</ul>

	{#if selected}
		<div class="flex flex-col gap-4">
			<p class="text-sm font-semibold">Skor: {selected.name}</p>
			<label class="flex flex-col gap-1 text-sm">
				<span class="flex justify-between">
					<span class="font-medium">Estetika</span>
					<span class="tabular-nums text-muted-foreground"
						>{aesthetic}</span
					>
				</span>
				<input
					type="range"
					min="0"
					max="100"
					bind:value={aesthetic}
					class="accent-gold"
					onchange={() => sfx.slider()}
				/>
			</label>
			<label class="flex flex-col gap-1 text-sm">
				<span class="flex justify-between">
					<span class="font-medium">Kestabilan</span>
					<span class="tabular-nums text-muted-foreground"
						>{stability}</span
					>
				</span>
				<input
					type="range"
					min="0"
					max="100"
					bind:value={stability}
					class="accent-gold"
					onchange={() => sfx.slider()}
				/>
			</label>
			<label class="flex flex-col gap-1 text-sm">
				<span class="flex justify-between">
					<span class="font-medium">Kreativitas</span>
					<span class="tabular-nums text-muted-foreground"
						>{creativity}</span
					>
				</span>
				<input
					type="range"
					min="0"
					max="100"
					bind:value={creativity}
					class="accent-gold"
					onchange={() => sfx.slider()}
				/>
			</label>
			<div
				class="flex items-center justify-between rounded-lg border border-border bg-background px-4 py-3"
			>
				<span class="text-sm font-medium">Total berbobot</span>
				<span
					class="font-mono text-2xl font-bold tabular-nums"
					aria-label="Total berbobot"
				>
					{totalPreview}
				</span>
			</div>
			<button
				type="button"
				class="btn btn-gold h-12 text-base"
				onclick={() => void submit()}
				disabled={!canSubmit}
			>
				{#if submitting}
					<Loader2 class="h-5 w-5 animate-spin" aria-hidden="true" />
					Menyimpan…
				{:else if scored[selected.id]}
					<Pencil class="h-5 w-5" aria-hidden="true" />
					Simpan Perubahan
				{:else}
					<CheckCircle2 class="h-5 w-5" aria-hidden="true" />
					Simpan Skor
				{/if}
			</button>
		</div>
	{/if}
</div>
