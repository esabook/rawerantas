<script lang="ts">
	import { onMount } from "svelte";
	import CompetitionList from "$lib/components/CompetitionList.svelte";
	import HeroSection from "$lib/components/HeroSection.svelte";
	import SponsorStrip from "$lib/components/SponsorStrip.svelte";
	import FooterBar from "$lib/components/FooterBar.svelte";
	import { getSponsors, type Sponsor } from "$lib/db/sponsor";
	import { getCompetitions, type Competition } from "$lib/db/queries";

	let competitions = $state<Competition[]>([]);
	let loading = $state(true);
	let loadError = $state("");
	let sponsors = $state<Sponsor[]>([]);
	let sponsorLoading = $state(true);

	onMount(async () => {
		try {
			const list = await getCompetitions();
			competitions = list;
		} catch (e) {
			loadError = e instanceof Error ? e.message : "Gagal memuat data";
		} finally {
			loading = false;
		}
		try {
			sponsors = await getSponsors();
		} catch {
			// Sponsor bersifat tambahan; kegagalannya tidak boleh menghalangi arena.
			sponsors = [];
		} finally {
			sponsorLoading = false;
		}
	});
</script>

<svelte:head>
	<title>Beranda — Lomba Agustusan</title>
	<meta name="description" content="Pendaftaran lomba, skor real-time, dan papan peringkat." />
</svelte:head>

<main class="pb-16">
	<HeroSection />

	{#if loadError}
		<p class="px-4 text-sm text-destructive" role="alert">
			{loadError}
		</p>
	{/if}

	<CompetitionList {competitions} {loading} />
	<SponsorStrip {sponsors} loading={sponsorLoading} />
</main>

<FooterBar />
