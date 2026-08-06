<script lang="ts">
	import { CheckCircle2, Loader2, Trophy, Wind, X } from "@lucide/svelte";
	import { onMount } from "svelte";
	import { undoable } from "$lib/components/toast/toastStore";
	import { getParticipants } from "$lib/db/queries";
	import type { Participant } from "$lib/db/queries";
	import {
		getRoundResults,
		removeLayanganScore,
		submitLayanganResult,
	} from "$lib/db/layangan";
	import type { LayanganScoreRecord, LayanganStatus } from "$lib/db/layangan";
	import { online } from "$lib/offline/networkStore";

	let {
		competitionId,
		competitionName,
		round,
		recordedBy,
	}: {
		competitionId: string;
		competitionName: string;
		round: number;
		recordedBy: string;
	} = $props();

	let participants = $state<Participant[]>([]);
	let results = $state<LayanganScoreRecord[]>([]);
	let submittingId = $state<string | null>(null);
	let error = $state("");

	const resultByParticipant = $derived(
		new Map(results.map((r) => [r.participantId, r.status])),
	);
	const activeParticipants = $derived(
		participants.filter((p) => !resultByParticipant.get(p.id)),
	);

	const load = async () => {
		const [rows, roundResults] = await Promise.all([
			getParticipants(competitionId),
			getRoundResults(competitionId, round),
		]);
		participants = rows;
		results = roundResults;
	};

	onMount(() => {
		void load();
	});

	const submit = async (p: Participant, status: LayanganStatus) => {
		if (submittingId !== null) {
			return;
		}
		if (resultByParticipant.get(p.id)) {
			error = `${p.name} sudah tercatat pada babak ini.`;
			return;
		}
		submittingId = p.id;
		error = "";
		try {
			const result = await submitLayanganResult({
				competitionId,
				participantId: p.id,
				round,
				status,
				recordedBy,
			});
			const label = `${p.name} — ${status === "menang" ? "MUDUN" : "PUTUS"}`;
			undoable(result.queued ? `Antrean: ${label}` : `Tersimpan: ${label}`, {
				onUndo: () => {
					void removeLayanganScore(result.id, result.queued).then(() => {
						void load();
						undoable("Hasil dibatalkan", {
							onConfirm: () => {},
							timeoutMs: 2000,
						});
					});
				},
				onConfirm: () => {},
			});
			results = await getRoundResults(competitionId, round);
		} catch (e) {
			error =
				e instanceof Error ? e.message : "Gagal menyimpan hasil.";
		} finally {
			submittingId = null;
		}
	};
</script>

<div class="mx-auto flex w-full max-w-md flex-col gap-4 rounded-xl border border-border bg-background/60 p-6">
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-2">
			<Wind class="h-5 w-5 text-gold" aria-hidden="true" />
			<h1 class="font-bold">{competitionName}</h1>
			<span class="rounded-full bg-gold/15 px-2.5 py-1 text-xs font-semibold text-gold">
				Babak {round}
			</span>
		</div>
		{#if !$online}
			<span class="rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-600">
				Offline — antrean
			</span>
		{/if}
	</div>

	{#if error}
		<p class="text-sm text-destructive" role="alert">{error}</p>
	{/if}

	{#if activeParticipants.length === 0}
		<div class="rounded-lg border border-border/60 p-6 text-center text-sm text-muted-foreground">
			Semua peserta babak ini sudah tercatat hasil.
		</div>
	{/if}

	<ul class="flex flex-col gap-2">
		{#each activeParticipants as p (p.id)}
			<li class="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2.5">
				<div class="min-w-0">
					<p class="truncate text-sm font-semibold">{p.name}</p>
					<p class="text-xs text-muted-foreground">{p.lapakNumber} · {p.phone}</p>
				</div>
				<div class="flex shrink-0 gap-2">
					<button
						type="button"
						class="btn h-11 bg-emerald-600 text-white hover:bg-emerald-700"
						onclick={() => void submit(p, "menang")}
						disabled={submittingId !== null}
					>
						{#if submittingId === p.id}
							<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
						{:else}
							<Trophy class="h-4 w-4" aria-hidden="true" />
						{/if}
						MUDUN
					</button>
					<button
						type="button"
						class="btn h-11 bg-destructive text-white hover:bg-destructive/90"
						onclick={() => void submit(p, "putus")}
						disabled={submittingId !== null}
					>
						{#if submittingId === p.id}
							<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
						{:else}
							<X class="h-4 w-4" aria-hidden="true" />
						{/if}
						PUTUS
					</button>
				</div>
			</li>
		{/each}
	</ul>

	{#if resultByParticipant.size > 0}
		<div class="rounded-lg border border-border/60 p-3 text-xs text-muted-foreground">
			<p class="mb-1 font-semibold">Hasil tercatat babak ini ({resultByParticipant.size})</p>
			<ul class="flex flex-wrap gap-1">
				{#each [...resultByParticipant.entries()] as [pid, status]}
					<li class="rounded-full bg-border/40 px-2 py-0.5">
						{participants.find((x) => x.id === pid)?.name ?? "—"}
						<span class={status === "menang" ? "text-emerald-600" : "text-destructive"}>
							{status === "menang" ? "MUDUN" : "PUTUS"}
						</span>
					</li>
				{/each}
			</ul>
		</div>
	{/if}
</div>
