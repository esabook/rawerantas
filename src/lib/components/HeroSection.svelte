<script lang="ts">
	import { env } from "$lib/env";
	import { CalendarDays } from "@lucide/svelte";
	import CountdownTimer from "./CountdownTimer.svelte";
</script>

<section class="mx-auto flex w-full max-w-3xl flex-col items-center gap-6 px-4 py-12 text-center">
	<p class="inline-flex items-center rounded-full border border-gold/30 bg-gold/10 px-4 py-1 text-xs font-semibold text-gold">
		Pesta Rakyat
	</p>
	<h1 class="text-4xl font-extrabold leading-tight sm:text-5xl">
		{env.appName || "Lomba Agustusan"}
		<span class="text-gold"> {env.appYear}</span>
	</h1>
	<p class="max-w-xl text-muted-foreground">
		Ikuti lomba 17-an, catat skor langsung dari lapangan, dan lihat papan
		peringkat secara real-time.
	</p>

	<CountdownTimer />

	<div class="mt-2 flex flex-wrap justify-center gap-3">
		<a href="/daftar" class="btn btn-gold">Daftar Lomba</a>
		<a href="/leaderboard" class="btn btn-ghost">
			<CalendarDays class="h-4 w-4" aria-hidden="true" />
			Papan Peringkat
		</a>
	</div>
</section>
