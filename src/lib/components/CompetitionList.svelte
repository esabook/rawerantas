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
	const liveCount = $derived(competitions.filter(isLive).length);
</script>

<section class="w-full py-8" aria-label="Daftar lomba">
	<div class="mx-auto flex w-full max-w-3xl items-end justify-between gap-2 px-4">
		<h2 class="text-2xl font-extrabold tracking-tight">
			Daftar <span class="text-gold">Lomba</span>
		</h2>
		{#if liveCount > 0}
			<span class="shrink-0 text-[10px] font-bold uppercase tracking-widest text-red-400">
				{liveCount} Live
			</span>
		{/if}
	</div>

	{#if loading}
		<div class="no-scrollbar mx-auto mt-4 flex w-full max-w-3xl gap-4 overflow-x-auto px-4">
			{#each [1, 2, 3] as i}
				<div
					class="h-44 w-72 shrink-0 animate-pulse rounded-xl border border-border/60 bg-background/60"
					aria-label="loading card"
				></div>
			{/each}
		</div>
	{:else if competitions.length === 0}
		<p class="mx-auto max-w-3xl px-4 pt-4 text-muted-foreground">
			Belum ada lomba dibuka.
		</p>
	{:else}
		<div
			class="no-scrollbar mx-auto mt-4 flex w-full max-w-3xl snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2"
		>
			{#each competitions as c}
				<article
					class="flex w-72 shrink-0 snap-start flex-col overflow-hidden rounded-xl border border-border/60 bg-background/60"
					data-testid="competition-card"
				>
					<div class="h-1 shrink-0 {isLive(c) ? 'bg-gold' : 'bg-muted'}" aria-hidden="true"></div>
					<div class="flex flex-1 flex-col gap-3 p-4 {isLive(c) ? '' : 'opacity-60'}">
						<div class="flex items-start justify-between gap-2">
							<h3 class="text-lg font-bold leading-tight">{c.name}</h3>
							{#if isLive(c)}
								<span
									class="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-400"
								>
									<span class="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" aria-hidden="true"></span>
									Live
								</span>
							{:else}
								<span
									class="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground"
									title="Lomba belum dibuka"
								>
									<Lock class="h-3.5 w-3.5" aria-hidden="true" />
									Tutup
								</span>
							{/if}
						</div>
						<p class="text-xs text-muted-foreground">
							Biaya pendaftaran Rp {c.fee.toLocaleString("id-ID")}
							&middot; Kuota {c.totalQuota} orang
						</p>

						{#if (top3.get(c.id)?.length ?? 0) > 0}
							<div class="border-t border-border/60 pt-2">
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

						{#if isLive(c)}
							<a href="/daftar" class="btn btn-sm mt-auto w-full">Daftar</a>
						{:else}
							<button type="button" class="btn btn-sm btn-ghost mt-auto w-full" disabled>
								Segera dibuka
							</button>
						{/if}
					</div>
				</article>
			{/each}
		</div>
	{/if}
</section>
