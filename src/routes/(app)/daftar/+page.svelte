<script lang="ts">
	import { onMount } from "svelte";
	import RegistrationForm from "$lib/components/RegistrationForm.svelte";
	import { getCompetitions, type Competition } from "$lib/db/queries";

	let competitions = $state<Competition[]>([]);
	let loading = $state(true);
	let loadError = $state("");

	onMount(async () => {
		try {
			competitions = await getCompetitions(false);
		} catch (e) {
			loadError = e instanceof Error ? e.message : "Gagal memuat lomba";
		} finally {
			loading = false;
		}
	});
</script>

<svelte:head>
	<title>Daftar Lomba</title>
</svelte:head>

<main class="py-8">
	{#if loading}
		<div class="mx-auto w-full max-w-md animate-pulse rounded-xl bg-muted p-6">
			<div class="h-6 w-1/2 rounded bg-muted-foreground/20"></div>
			<div class="mt-4 h-10 rounded bg-muted-foreground/10"></div>
		</div>
	{:else if loadError}
		<p class="mx-auto max-w-md text-sm text-destructive" role="alert">{loadError}</p>
	{:else}
		<RegistrationForm {competitions} />
	{/if}
</main>
