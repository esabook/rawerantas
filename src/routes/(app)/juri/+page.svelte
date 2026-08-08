<script lang="ts">
	import { CalendarDays, Fish, Wind } from "@lucide/svelte";
	import PinGate from "$lib/components/PinGate.svelte";
	import { env } from "$lib/env";

	const events = [
		{
			href: "/juri/mancing",
			label: "Mancing",
			description: "Catat hasil tangkapan dan skor lomba mancing.",
			icon: Fish,
		},
		{
			href: "/juri/layangan",
			label: "Aduan layangan",
			description: "Catat hasil pertandingan per babak.",
			icon: Wind,
		},
		{
			href: "/juri/layangan-hias",
			label: "Layangan hias",
			description: "Nilai kriteria dan simpan skor peserta.",
			icon: CalendarDays,
		},
	];
</script>

<svelte:head>
	<title>Events Juri | {env.appName}</title>
</svelte:head>

<PinGate kind="juri" title="PIN Juri">
	{#snippet children()}
		<main class="w-full py-8">
			<div class="flex w-full flex-col gap-5">
				<div>
					<p class="text-xs font-semibold uppercase tracking-widest text-cyan-300">Area juri</p>
					<h1 class="mt-2 text-2xl font-bold">Pilih event</h1>
					<p class="mt-1 text-sm text-muted-foreground">Buka papan input sesuai lomba yang sedang dinilai.</p>
				</div>
				<div class="grid w-full grid-cols-1 gap-4 lg:grid-cols-3">
					{#each events as event}
						<a href={event.href} class="flex min-h-40 flex-col justify-between gap-4 rounded-2xl border border-border bg-background/60 p-5 transition-colors hover:border-cyan-300/50">
							<event.icon class="h-7 w-7 text-cyan-300" aria-hidden="true" />
							<span>
								<strong class="block text-lg">{event.label}</strong>
								<span class="mt-1 block text-sm text-muted-foreground">{event.description}</span>
							</span>
						</a>
					{/each}
				</div>
			</div>
		</main>
	{/snippet}
</PinGate>
