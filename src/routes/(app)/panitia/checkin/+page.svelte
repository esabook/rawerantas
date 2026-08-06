<script lang="ts">
	import CheckinScanner from "$lib/components/CheckinScanner.svelte";
	import { env } from "$lib/env";
</script>

<svelte:head>
	<title>Check-in | {env.appName}</title>
</svelte:head>

<div class="px-4 py-8">
	<CheckinScanner />
</div>
