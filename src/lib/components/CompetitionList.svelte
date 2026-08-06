<script lang="ts">
	import { Lock, Medal, Trophy } from "@lucide/svelte";
	import type { Competition } from "$lib/db/queries";

	export interface RankSummary {
		name: string;
		score: number;
		subScore: number;
	}

	let {
		competitions,
		top3,
		loading = false,
	}: {
		competitions: Competition[];
		top3: Map<string, RankSummary[]>;
		loading?: boolean;
	} = $props();

	const isLive = (c: Competition) => c.isActive;
</script>

<section class="mx-auto w-full max-w-3xl px-4 py-8" aria-label="Daftar lomba">
	<h2 class="mb-4 text-xl font-bold">Daftar Lomba</h2>

	{#if loading}
		<div class="grid gap-3 sm:grid-cols-2">
			{#each [1, 2, 3, 4] as i}
				<div class="glass-panel h-32 animate-pulse rounded-xl" aria-label="loading card"></div>
			{/each}
		</div>
	{:else if competitions.length === 0}
		<p class="text-muted-foreground">Belum ada lomba dibuka.</p>
	{:else}
		<div class="grid gap-3 sm:grid-cols-2">
			{#each competitions as c}
				<div class="glass-panel rounded-xl p-4 {isLive(c) ? '' : 'opacity-60'}" data-testid="competition-card">
					<div class="flex items-start justify-between gap-2">
						<h3 class="font-semibold">{c.name}</h3>
						{#if !isLive(c)}
							<span class="inline-flex items-center gap-1 text-xs text-muted-foreground" title="Lomba belum dibuka">
								<Lock class="h-3.5 w-3.5" aria-hidden="true" />
								Tutup
							</span>
						{/if}
					</div>
					<p class="mt-1 text-xs text-muted-foreground">
						Biaya pendaftaran Rp {c.fee.toLocaleString("id-ID")}
						&middot; Kuota {c.totalQuota} orang
					</p>

					{#if isLive(c)}
						<a href="/daftar" class="btn btn-sm mt-3 w-full">Daftar</a>
					{:else}
						<button type="button" class="btn btn-sm btn-ghost mt-3 w-full" disabled>
							Segera dibuka
						</button>
					{/if}

					{#if (top3.get(c.id)?.length ?? 0) > 0}
						<div class="mt-3 border-t border-border/60 pt-2">
							<p class="mb-1 flex items-center gap-1 text-xs font-semibold text-secondary">
								<Trophy class="h-3.5 w-3.5" aria-hidden="true" />
								Peringkat teratas
							</p>
							<ol class="space-y-0.5">
							{#each top3.get(c.id) ?? [] as row, i}
								<li class="flex items-center justify-between text-sm">
									<span class="flex items-center gap-1.5">
										<Medal class="h-3.5 w-3.5 {i === 0 ? 'text-gold' : 'text-muted-foreground'}" aria-hidden="true" />
										{row.name}
									</span>
									<span class="tabular-nums text-muted-foreground">
										{row.score.toLocaleString("id-ID")}
										{#if row.subScore > 0}
											<small> ({row.subScore.toLocaleString("id-ID")})</small>
										{/if}
									</span>
								</li>
							{/each}
							</ol>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</section>
