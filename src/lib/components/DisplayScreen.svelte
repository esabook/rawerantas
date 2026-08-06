<script module lang="ts">
	export const DISPLAY_CYCLE_MS = 30_000;
	export const DISPLAY_POLL_MS = 10_000;
	export const DISPLAY_CLOCK_MS = 1_000;
</script>

<script lang="ts">
	import { Crown } from "@lucide/svelte";
	import { get } from "svelte/store";
	import { onDestroy, onMount } from "svelte";
	import { computeRanking } from "$lib/db/engine";
	import type { ScoreRow } from "$lib/db/engine";
	import { getLeaderboardRows } from "$lib/db/leaderboard";
	import { getCompetitions } from "$lib/db/queries";
	import type { Competition, LeaderboardRow } from "$lib/db/queries";
	import { demoMode } from "$lib/demo/store";
	import { online } from "$lib/offline/networkStore";
	import { announce, loadTtsPreference } from "$lib/tts/ttsAnnouncer";
	import { env } from "$lib/env";

	let competitions = $state<Competition[]>([]);
	let index = $state(0);
	let rows = $state<LeaderboardRow[]>([]);
	let lastKnown = $state<LeaderboardRow[]>([]);
	let loading = $state(true);
	let error = $state("");
	let now = $state(new Date());

	const competition = $derived(
		competitions[index % Math.max(competitions.length, 1)],
	);
	const demo = $derived(get(demoMode));

	const clockText = $derived(
		now.toLocaleTimeString("id-ID", { hour12: false }),
	);

	const toScoreRow = (row: LeaderboardRow): ScoreRow => {
		const base: ScoreRow = {
			id: String(row.id),
			participantId: row.participantId,
			receivedAt: row.receivedAt,
		};
		if (competition?.scoringMode === "layangan_hias") {
			return {
				...base,
				aesthetic: Number(row.aesthetic ?? 0),
				stability: Number(row.stability ?? 0),
				creativity: Number(row.creativity ?? 0),
				totalWeighted: Number(row.totalWeighted ?? row.total_weighted ?? 0),
			};
		}
		if (competition?.scoringMode === "layangan_aduan") {
			return { ...base, status: String(row.status ?? "") };
		}
		return {
			...base,
			weight: Number(row.fishWeightGram ?? row.weight ?? 0),
			isJackpot: Boolean(row.isJackpot ?? row.is_jackpot),
		};
	};

	const ranking = $derived(
		computeRanking(rows.map(toScoreRow), competition?.scoringMode ?? "terberat"),
	);
	const byParticipant = $derived(
		new Map(rows.map((r) => [r.participantId, r])),
	);

	const nameOf = (row: LeaderboardRow) =>
		(row.participants as { name?: string; lapak_number?: string } | null)
			?.name ?? "Peserta";
	const lapakOf = (row: LeaderboardRow) =>
		(row.participants as { name?: string; lapak_number?: string } | null)
			?.lapak_number;

	const formatScore = (score: number, subScore: number): string => {
		switch (competition?.scoringMode) {
			case "layangan_aduan":
				return `${score} menang`;
			case "layangan_hias":
				return `${score.toFixed(1)} poin`;
			case "terberat":
			case "kumulatif":
			case "jackpot_pita":
				return `${(score / 1000).toLocaleString("id-ID")} kg`;
		}
	};

	const signatureOf = (list: LeaderboardRow[]): string =>
		JSON.stringify(
			list.map((r) => [
				r.participantId,
				r.receivedAt,
				r.fishWeightGram ?? r.totalWeighted ?? r.status ?? "",
			]),
		);

	const sigById = new Map<string, string>();
	const lastTopById = new Map<string, string>();
	const prevLenById = new Map<string, number>();

	const announceTop = (comp: Competition, list: LeaderboardRow[]) => {
		const top = list[0]?.participants;
		const topName =
			top && typeof top === "object" && "name" in top
				? String((top as { name?: unknown }).name ?? "")
				: "";
		if (!topName) {
			return;
		}
		announce(`${topName} memimpin ${comp.name}`);
	};

	const refresh = async (announceOnShow = false) => {
		const comp = competition;
		if (!comp) {
			return;
		}
		try {
			const next = await getLeaderboardRows(comp.id, comp.scoringMode);
			rows = next;
			lastKnown = next;
			error = "";
			const sig = signatureOf(next);
			const firstShow = !sigById.has(comp.id);
			const changed = !firstShow && sigById.get(comp.id) !== sig;
			const top = next[0]?.participants;
			const topName =
				top && typeof top === "object" && "name" in top
					? String((top as { name?: unknown }).name ?? "")
					: "";
			if (firstShow || announceOnShow) {
				announceTop(comp, next);
			} else if (changed) {
				if (topName && topName !== lastTopById.get(comp.id)) {
					lastTopById.set(comp.id, topName);
					announce(`${topName} memimpin ${comp.name}`);
				} else if (next.length !== prevLenById.get(comp.id)) {
					announce(`Skor baru tercatat — ${comp.name}`);
				}
			}
			sigById.set(comp.id, sig);
			prevLenById.set(comp.id, next.length);
			if (!lastTopById.has(comp.id)) {
				lastTopById.set(comp.id, topName);
			}
		} catch (e) {
			if (lastKnown.length > 0) {
				rows = lastKnown;
			}
			error =
				e instanceof Error
					? `Gagal memuat skor: ${e.message}`
					: "Gagal memuat skor.";
		}
	};

	let wakeLock: { release: () => Promise<void> } | null = null;

	const requestWakeLock = async () => {
		const nav = navigator as Navigator & {
			wakeLock?: {
				request: (type: "screen") => Promise<{
					release: () => Promise<void>;
				}>;
			};
		};
		if (!nav.wakeLock) {
			return;
		}
		try {
			wakeLock = await nav.wakeLock.request("screen");
		} catch {
			wakeLock = null;
		}
	};

	const onVisibility = () => {
		if (document.visibilityState === "visible") {
			void requestWakeLock();
		}
	};

	let channel: unknown;
	let unsubscribeOnline: (() => void) | null = null;
	let clockTimer: ReturnType<typeof setInterval> | null = null;
	let cycleTimer: ReturnType<typeof setInterval> | null = null;
	let pollTimer: ReturnType<typeof setInterval> | null = null;

	onMount(() => {
		loadTtsPreference();
		void requestWakeLock();
		document.addEventListener("visibilitychange", onVisibility);

		clockTimer = setInterval(() => {
			now = new Date();
		}, DISPLAY_CLOCK_MS);

		cycleTimer = setInterval(() => {
			if (competitions.length > 0) {
				index = (index + 1) % competitions.length;
				void refresh(true);
			}
		}, DISPLAY_CYCLE_MS);

		pollTimer = setInterval(() => {
			if (demo) {
				void refresh(false);
			}
		}, DISPLAY_POLL_MS);

		unsubscribeOnline = online.subscribe((isOnline) => {
			if (isOnline && !demo) {
				void refresh(false);
			}
		});

		void getCompetitions(true)
			.then((list) => {
				competitions = list;
				return refresh(true);
			})
			.finally(() => {
				loading = false;
			});

		if (!demo) {
			void import("$lib/db/queries").then(async ({ getSupabase }) => {
				const { supabase } = await getSupabase();
				channel = supabase
					.channel("display-live")
					.on(
						"postgres_changes",
						{
							event: "*",
							schema: "public",
							table: "scores_mancing",
						},
						() => void refresh(false),
					)
					.on(
						"postgres_changes",
						{
							event: "*",
							schema: "public",
							table: "scores_layangan",
						},
						() => void refresh(false),
					)
					.on(
						"postgres_changes",
						{
							event: "*",
							schema: "public",
							table: "scores_layangan_hias",
						},
						() => void refresh(false),
					)
					.on(
						"postgres_changes",
						{
							event: "UPDATE",
							schema: "public",
							table: "participants",
						},
						(payload) => {
							const p = payload.new as {
								status?: string;
								name?: string;
							};
							if (p.status === "checked_in") {
								announce(`${p.name ?? "Peserta"} sudah check-in`);
								void refresh(false);
							}
						},
					)
					.subscribe();
			});
		}
	});

	onDestroy(() => {
		if (clockTimer) {
			clearInterval(clockTimer);
		}
		if (cycleTimer) {
			clearInterval(cycleTimer);
		}
		if (pollTimer) {
			clearInterval(pollTimer);
		}
		unsubscribeOnline?.();
		document.removeEventListener("visibilitychange", onVisibility);
		void wakeLock?.release().catch(() => {});
		if (channel) {
			void import("$lib/db/queries").then(async ({ getSupabase }) => {
				const { supabase } = await getSupabase();
				supabase.removeChannel(channel as never).catch(() => {});
			});
		}
	});
</script>

<div class="flex min-h-dvh w-full flex-col bg-background text-foreground">
	<header class="flex items-center justify-between gap-4 border-b border-border/60 px-6 py-4">
		<div class="min-w-0">
			<p class="text-2xl font-black uppercase tracking-widest">
				{env.appName}
			</p>
			<p class="text-gold">{competition?.name}</p>
		</div>
		<div class="text-right">
			<p class="font-mono text-4xl font-bold tabular-nums">{clockText}</p>
			<p class="text-sm text-muted-foreground">
				Ronde {competition?.currentRound ?? 1}
			</p>
		</div>
	</header>

	{#if error && rows.length > 0}
		<p
			class="absolute right-3 top-3 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground"
			role="status"
		>
			Luring — menampilkan data terakhir tersimpan
		</p>
	{/if}

	<main class="flex flex-1 flex-col justify-center gap-6 overflow-hidden p-6">
		{#if loading}
			<p class="animate-pulse text-center text-2xl text-muted-foreground">
				Memuat papan skor…
			</p>
		{:else if !competition}
			<p class="text-center text-2xl text-muted-foreground">
				Belum ada kompetisi aktif.
			</p>
		{:else if rows.length === 0}
			<p class="text-center text-3xl text-muted-foreground">
				Belum ada skor tercatat.
			</p>
		{:else}
			<div class="grid grid-cols-3 items-end gap-4">
				{#each ranking.slice(0, 3) as entry (entry.key)}
					{@const row = byParticipant.get(entry.key)}
					<div
						class="rounded-2xl border px-4 py-5 text-center {entry.rank === 1
							? 'order-2 border-gold bg-gold/10 pb-8'
							: entry.rank === 2
								? 'order-1'
								: 'order-3'}"
					>
						{#if entry.rank === 1}
							<Crown class="mx-auto mb-2 h-10 w-10 text-gold" aria-hidden="true" />
						{/if}
						<p class="truncate text-3xl font-black">
							{row ? nameOf(row) : "Peserta"}
						</p>
						<p class="mt-1 text-sm text-muted-foreground">
							{row && lapakOf(row) ? `Lapak ${lapakOf(row)}` : ""}
						</p>
						<p class="mt-2 font-mono text-4xl font-bold tabular-nums">
							{formatScore(entry.score, entry.subScore)}
						</p>
					</div>
				{/each}
			</div>

			{#if ranking.length > 3}
				<ol class="mx-auto w-full max-w-4xl space-y-2">
					{#each ranking.slice(3, 10) as entry (entry.key)}
						{@const row = byParticipant.get(entry.key)}
						<li class="flex items-center justify-between gap-3 border-b border-border/30 px-2 py-2">
							<div class="flex min-w-0 items-center gap-4">
								<span class="w-8 text-center font-mono text-xl font-bold text-muted-foreground">
									{entry.rank}
								</span>
								<div class="min-w-0">
									<p class="truncate text-2xl font-bold">
										{row ? nameOf(row) : "Peserta"}
									</p>
									<p class="text-sm text-muted-foreground">
										{row && lapakOf(row) ? `Lapak ${lapakOf(row)}` : ""}
										{#if entry.entries.length > 1}
											· {entry.entries.length} skor
										{/if}
									</p>
								</div>
							</div>
							<span class="shrink-0 font-mono text-3xl font-bold tabular-nums">
								{formatScore(entry.score, entry.subScore)}
							</span>
						</li>
					{/each}
				</ol>
			{/if}

			<div class="flex items-center justify-center gap-2">
				{#each competitions as c, i (c.id)}
					<span
						class="h-2.5 rounded-full {i === index ? 'w-6 bg-gold' : 'w-2.5 bg-border'}"
						aria-label={i === index ? `Menampilkan ${c.name}` : c.name}
					></span>
				{/each}
			</div>
		{/if}
	</main>
</div>
