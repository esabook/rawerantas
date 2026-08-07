<script lang="ts">
	import { env } from "$lib/env";
	import { CalendarDays } from "@lucide/svelte";
	import CountdownTimer from "./CountdownTimer.svelte";

	let {
		competitionCount = 0,
		quotaTotal = 0,
	}: { competitionCount?: number; quotaTotal?: number } = $props();

	const eventDate =
		env.eventDate.length > 0
			? new Date(env.eventDate).toLocaleDateString("id-ID", {
					day: "numeric",
					month: "long",
				})
			: "";

	const parts = (env.appName || "Lomba Agustusan").trim().split(/\s+/);
	const nameHead =
		parts.length > 1 ? parts.slice(0, -1).join(" ") : env.appName || "Lomba";
	const nameTail = parts.length > 1 ? parts[parts.length - 1] : env.appYear;
</script>

<section class="relative mx-auto w-full max-w-3xl px-4 pb-4 pt-10 text-center">
	<div
		class="mx-auto h-1 w-28 rounded-full bg-gradient-to-r from-primary via-gold to-primary"
		aria-hidden="true"
	></div>

	<p
		class="mt-5 inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-gold"
	>
		<span class="h-1.5 w-1.5 animate-pulse rounded-full bg-gold" aria-hidden="true"></span>
		Pesta Rakyat {env.appYear}
	</p>

	<h1 class="font-display mt-3 text-5xl font-extrabold leading-[0.95] tracking-tight sm:text-6xl">
		{nameHead}
		<span class="text-gold">{nameTail}</span>
	</h1>

	<p class="mx-auto mt-4 max-w-xl text-muted-foreground">
		Ikuti lomba 17-an, catat skor langsung dari lapangan, dan lihat papan
		peringkat secara real-time.
	</p>

	<CountdownTimer />

	<div class="mt-6 flex flex-wrap justify-center gap-3">
		<a href="/daftar" class="btn btn-gold px-8 py-3.5 text-base">Daftar Lomba</a>
		<a href="/leaderboard" class="btn btn-ghost px-6 py-3.5 text-base">
			<CalendarDays class="h-4 w-4" aria-hidden="true" />
			Papan Peringkat
		</a>
	</div>

	{#if competitionCount > 0}
		<dl class="mx-auto mt-8 grid w-full max-w-md grid-cols-3 gap-px overflow-hidden rounded-xl border border-border/60 bg-border/60">
			<div class="bg-background/80 p-3">
				<dt class="text-[10px] uppercase tracking-widest text-muted-foreground">Lomba</dt>
				<dd class="font-display text-xl font-extrabold text-gold">{competitionCount}</dd>
			</div>
			<div class="bg-background/80 p-3">
				<dt class="text-[10px] uppercase tracking-widest text-muted-foreground">Kuota</dt>
				<dd class="font-display text-xl font-extrabold text-gold">{quotaTotal}</dd>
			</div>
			<div class="bg-background/80 p-3">
				<dt class="text-[10px] uppercase tracking-widest text-muted-foreground">Tanggal</dt>
				<dd class="font-display text-xl font-extrabold uppercase text-gold">{eventDate}</dd>
			</div>
		</dl>
	{/if}
</section>
