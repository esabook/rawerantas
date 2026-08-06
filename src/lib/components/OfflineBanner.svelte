<script lang="ts">
	import { Wifi, WifiOff } from "@lucide/svelte";
	import { online, queueCount } from "$lib/offline/networkStore";
</script>

{#if !$online || $queueCount > 0}
	<div
		role="status"
		aria-live="polite"
		class="glass-panel z-30 mx-auto flex w-full max-w-lg items-center gap-2 px-4 py-2 text-sm {!$online ? 'bg-destructive/20' : ''}"
	>
		{#if !$online}
			<WifiOff class="h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
			<span class="text-foreground">Luring — data tersimpan lokal</span>
		{:else if $queueCount > 0}
			<Wifi class="h-4 w-4 shrink-0 text-secondary" aria-hidden="true" />
			<span class="text-foreground">Menunggu sinkronisasi</span>
			<span
				class="ml-auto inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-destructive px-2 text-xs font-semibold text-destructive-foreground"
			>
				{$queueCount}
			</span>
		{/if}
	</div>
{/if}
