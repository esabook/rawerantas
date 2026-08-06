<script lang="ts">
	import DisplayScreen from "$lib/components/DisplayScreen.svelte";
	import PinGate from "$lib/components/PinGate.svelte";
	import { env } from "$lib/env";
</script>

<svelte:head>
	<title>Display | {env.appName}</title>
</svelte:head>

<PinGate kind="admin" title="PIN Display">
	{#snippet children()}
		<DisplayScreen />
	{/snippet}
</PinGate>
