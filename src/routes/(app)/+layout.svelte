<script lang="ts">
	import AppShell from '$lib/components/AppShell.svelte';
	import OfflineBanner from '$lib/components/OfflineBanner.svelte';
	import { initNetworkStore } from '$lib/offline/networkStore';

	initNetworkStore();

	let { children } = $props();
</script>

<AppShell>
	{#snippet offline()}
		<OfflineBanner />
	{/snippet}
	{@render children()}
</AppShell>
