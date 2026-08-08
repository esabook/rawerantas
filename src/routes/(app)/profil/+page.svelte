<script lang="ts">
	import { page } from "$app/state";
	import {
		CalendarDays,
		Home,
		ScanLine,
		ShieldCheck,
		Trophy,
		UserPlus,
	} from "@lucide/svelte";

	type ProfileRole = "guest" | "admin" | "juri" | "panitia";

	const role = $derived.by((): ProfileRole => {
		const value = page.url.searchParams.get("role");
		return value === "admin" || value === "juri" || value === "panitia"
			? value
			: "guest";
	});
	const roleLabel = $derived(
		{
			guest: "Pengunjung",
			admin: "Admin",
			juri: "Juri",
			panitia: "Panitia",
		}[role],
	);
</script>

<svelte:head>
	<title>Profil — Rawerantas</title>
</svelte:head>

<main class="w-full py-8">
	<div
		class="flex w-full flex-col gap-5 rounded-2xl border border-border bg-background/60 p-4"
	>
		<div>
			<p
				class="text-xs font-semibold uppercase tracking-widest text-cyan-300"
			>
				Profil akses
			</p>
			<h1 class="mt-2 text-2xl font-bold">{roleLabel}</h1>
			<p class="mt-1 text-sm text-muted-foreground">
				Navigasi menyesuaikan area yang sedang dibuka.
			</p>
		</div>

		<div
			class="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
		>
			<a
				class="flex items-center gap-3 rounded-xl border border-border p-4 hover:border-cyan-300/50"
				href="/"
			>
				<Home class="h-5 w-5 text-cyan-300" aria-hidden="true" />
				<span>Beranda</span>
			</a>
			{#if role === "guest"}
				<a
					class="flex items-center gap-3 rounded-xl border border-border p-4 hover:border-cyan-300/50"
					href="/daftar"
				>
					<UserPlus
						class="h-5 w-5 text-cyan-300"
						aria-hidden="true"
					/>
					<span>Daftar lomba</span>
				</a>
				<a
					class="flex items-center gap-3 rounded-xl border border-border p-4 hover:border-cyan-300/50"
					href="/leaderboard"
				>
					<Trophy class="h-5 w-5 text-cyan-300" aria-hidden="true" />
					<span>Leaderboard</span>
				</a>
			{:else if role === "admin"}
				<a
					class="flex items-center gap-3 rounded-xl border border-border p-4 hover:border-cyan-300/50"
					href="/admin"
				>
					<ShieldCheck
						class="h-5 w-5 text-cyan-300"
						aria-hidden="true"
					/>
					<span>Admin</span>
				</a>
			{:else if role === "juri"}
				<a
					class="flex items-center gap-3 rounded-xl border border-border p-4 hover:border-cyan-300/50"
					href="/juri"
				>
					<CalendarDays
						class="h-5 w-5 text-cyan-300"
						aria-hidden="true"
					/>
					<span>Events</span>
				</a>
			{:else}
				<a
					class="flex items-center gap-3 rounded-xl border border-border p-4 hover:border-cyan-300/50"
					href="/panitia/checkin"
				>
					<ScanLine
						class="h-5 w-5 text-cyan-300"
						aria-hidden="true"
					/>
					<span>Check-in</span>
				</a>
			{/if}
		</div>
	</div>
</main>
