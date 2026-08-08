<script lang="ts">
	import { ArrowUpRight, Handshake } from "@lucide/svelte";
	import type { Sponsor } from "$lib/db/sponsor";

	let {
		sponsors,
		loading = false,
	}: {
		sponsors: Sponsor[];
		loading?: boolean;
	} = $props();
</script>

{#if loading || sponsors.length > 0}
	<section
		class="w-full border-y border-slate-800/80 bg-[#070a12] py-8 sm:py-10"
		aria-labelledby="sponsor-title"
	>
		<div class="flex min-w-0 w-full flex-col gap-4 px-2 sm:px-4 lg:px-8">
			<div class="flex items-end justify-between gap-3">
				<div>
					<p
						class="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-300"
					>
						<Handshake class="h-3.5 w-3.5" aria-hidden="true" />
						Dukungan arena
					</p>
					<h2
						id="sponsor-title"
						class="font-display mt-2 text-2xl font-extrabold uppercase tracking-tight text-white sm:text-3xl"
					>
						Sponsor & partner
					</h2>
				</div>
			</div>

			{#if loading}
				<div
					class="no-scrollbar flex min-w-0 snap-x gap-4 overflow-x-auto pb-2 [touch-action:pan-x]"
				>
					{#each [1, 2, 3] as item}
						<div
							class="h-32 w-[min(82vw,28rem)] shrink-0 animate-pulse snap-start rounded-2xl border border-slate-800 bg-[#0a0f1c] sm:h-40"
							aria-label={`Memuat sponsor ${item}`}
						></div>
					{/each}
				</div>
			{:else}
				<div
					class="no-scrollbar flex min-w-0 snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [touch-action:pan-x]"
					aria-label="Daftar sponsor"
				>
					{#each sponsors as sponsor (sponsor.id)}
						<a
							href={sponsor.url}
							target="_blank"
							rel="noopener noreferrer"
							class="group w-[min(82vw,28rem)] shrink-0 snap-start overflow-hidden rounded-2xl border border-slate-800 bg-[#0a0f1c] transition-[border-color,box-shadow] hover:border-cyan-300/50 hover:shadow-[0_0_28px_rgba(34,211,238,0.12)]"
						>
							<div
								class="aspect-[10/3] overflow-hidden bg-slate-950"
							>
								<img
									src={sponsor.imageUrl}
									alt="Banner sponsor"
									class="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
									loading="lazy"
								/>
							</div>
							<div
								class="flex items-center gap-2 border-t border-slate-800 px-2 py-2 text-[10px] text-slate-400"
							>
								<span class="min-w-0 flex-1 truncate"
									>{sponsor.url}</span
								>
								<ArrowUpRight
									class="h-3.5 w-3.5 shrink-0 text-cyan-300"
									aria-hidden="true"
								/>
							</div>
						</a>
					{/each}
				</div>
			{/if}
		</div>
	</section>
{/if}
