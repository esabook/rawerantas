<script lang="ts">
	import AdminPanel from "$lib/components/AdminPanel.svelte";
	import PinGate from "$lib/components/PinGate.svelte";
	import { env } from "$lib/env";
</script>

<svelte:head>
	<title>Admin | {env.appName}</title>
</svelte:head>

<PinGate kind="admin" title="PIN Admin">
	{#snippet children()}
		<div class="min-w-0 w-full overflow-x-clip py-6 sm:px-4 sm:py-8">
			<AdminPanel />
		</div>
	{/snippet}
</PinGate>
