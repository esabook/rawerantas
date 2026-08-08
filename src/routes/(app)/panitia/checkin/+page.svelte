<script lang="ts">
	import CheckinScanner from "$lib/components/CheckinScanner.svelte";
	import PinGate from "$lib/components/PinGate.svelte";
	import { env } from "$lib/env";
</script>

<svelte:head>
	<title>Check-in | {env.appName}</title>
</svelte:head>

<PinGate kind="panitia" title="PIN Panitia">
	{#snippet children()}
		<div class="w-full py-8">
			<CheckinScanner />
		</div>
	{/snippet}
</PinGate>
