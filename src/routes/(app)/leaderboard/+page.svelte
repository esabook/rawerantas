<script lang="ts">
	import { RefreshCw } from "@lucide/svelte";
	import { get } from "svelte/store";
	import { onDestroy, onMount } from "svelte";
	import LeaderboardBoard from "$lib/components/LeaderboardBoard.svelte";
	import { getLeaderboardRows } from "$lib/db/leaderboard";
	import { getCompetitions } from "$lib/db/queries";
	import type { Competition } from "$lib/db/queries";
	import { demoMode } from "$lib/demo/store";
	import { env } from "$lib/env";
	import { online } from "$lib/offline/networkStore";
	import { announce } from "$lib/tts/ttsAnnouncer";

	let competitions = $state<Competition[]>([]);
	let selectedId = $state<string | null>(null);
	let rows = $state<Awaited<ReturnType<typeof getLeaderboardRows>>>([]);
	let lastKnown = $state<typeof rows>([]);
	let loading = $state(true);
	let refreshing = $state(false);
	let error = $state("");
	let lastTop = $state("");

	const competition = $derived(
		competitions.find((c) => c.id === selectedId) ?? competitions[0],
	);
	const demo = $derived(get(demoMode));

	const refresh = async () => {
		if (!competition || refreshing) {
			return;
		}
		refreshing = true;
		try {
			const next = await getLeaderboardRows(
				competition.id,
				competition.scoringMode,
				competition.scoringMode === "layangan_aduan"
					? competition.currentRound
					: undefined,
			);
			rows = next;
			lastKnown = next;
			error = "";
			const top = next[0]?.participants;
			const topName =
				top && typeof top === "object" && "name" in top
					? String((top as { name?: unknown }).name ?? "")
					: "";
			if (topName && topName !== lastTop) {
				lastTop = topName;
				announce(`${topName} memimpin ${competition.name}`);
			}
		} catch (e) {
			if (lastKnown.length > 0) {
				rows = lastKnown;
			}
			error =
				e instanceof Error
					? `Gagal memuat skor: ${e.message}`
					: "Gagal memuat skor.";
		} finally {
			refreshing = false;
		}
	};

	let channel: unknown;
	let unsubscribeOnline: (() => void) | null = null;
	let pollTimer: ReturnType<typeof setInterval> | null = null;

	onMount(() => {
		void getCompetitions(false)
			.then((list) => {
				competitions = list;
				selectedId = list[0]?.id ?? null;
				return refresh();
			})
			.finally(() => {
				loading = false;
			});
		unsubscribeOnline = online.subscribe((isOnline) => {
			if (isOnline && !demo) {
				void refresh();
			}
		});
		// B3-7/A35: polling fallback 30 dtk bila realtime tidak menyala.
		pollTimer = setInterval(() => void refresh(), 30_000);
		if (!demo) {
			void import("$lib/db/queries").then(async ({ getSupabase }) => {
				const { supabase } = await getSupabase();
				channel = supabase
					.channel("leaderboard-live")
					.on(
						"postgres_changes",
						{
							event: "*",
							schema: "public",
							table: "scores_mancing",
						},
						() => void refresh(),
					)
					.on(
						"postgres_changes",
						{
							event: "*",
							schema: "public",
							table: "scores_layangan",
						},
						() => void refresh(),
					)
					.on(
						"postgres_changes",
						{
							event: "*",
							schema: "public",
							table: "scores_layangan_hias",
						},
						() => void refresh(),
					)
					.subscribe();
			});
		}
	});

	onDestroy(() => {
		unsubscribeOnline?.();
		if (pollTimer !== null) {
			clearInterval(pollTimer);
		}
		if (channel) {
			void import("$lib/db/queries").then(async ({ getSupabase }) => {
				const { supabase } = await getSupabase();
				supabase.removeChannel(channel as never).catch(() => {});
			});
		}
	});
</script>

<svelte:head>
	<title>Leaderboard | {env.appName}</title>
</svelte:head>

<div class="flex w-full flex-col gap-4 py-8">
	<div class="flex items-center justify-between">
		<h1 class="text-lg font-bold">Leaderboard</h1>
		<button
			type="button"
			class="btn btn-ghost btn-sm"
			onclick={() => void refresh()}
			disabled={refreshing}
			aria-busy={refreshing}
			aria-label="Muat ulang skor"
		>
			<RefreshCw
				class="h-4 w-4 {refreshing ? 'animate-spin' : ''}"
				aria-hidden="true"
			/>
			<!-- {refreshing ? "Memuat…" : "Muat ulang"} -->
		</button>
	</div>

	{#if loading}
		<div class="flex flex-col gap-2" aria-label="memuat leaderboard">
			{#each [1, 2, 3, 4] as i}
				<div
					class="h-12 animate-pulse rounded-lg border border-border/60 bg-background/60"
				></div>
			{/each}
		</div>
	{:else if !competition}
		<div
			class="rounded-lg border border-border/60 p-8 text-center text-sm text-muted-foreground"
		>
			Tidak ada kompetisi aktif.
		</div>
	{:else}
		<div
			class="no-scrollbar flex min-w-0 snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain px-1 pb-2 [touch-action:pan-x]"
		>
			{#each competitions as c (c.id)}
				<button
					type="button"
					class="btn shrink-0 snap-start whitespace-nowrap {competition.id ===
					c.id
						? 'btn-gold'
						: ''}"
					onclick={() => {
						selectedId = c.id;
						void refresh();
					}}
				>
					{c.name}
				</button>
			{/each}
		</div>
		{#if error}
			<p class="text-sm text-destructive" role="alert">{error}</p>
			{#if rows.length > 0}
				<p class="text-xs text-muted-foreground" role="status">
					Menampilkan data terakhir yang tersimpan (offline).
				</p>
			{/if}
		{/if}
		<LeaderboardBoard {competition} {rows} />
	{/if}
</div>
