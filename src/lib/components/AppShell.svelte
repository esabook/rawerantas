<script lang="ts">
import type { Snippet } from 'svelte';
import { get } from 'svelte/store';
import { demoMode } from '$lib/demo/store';
import BottomNav from './BottomNav.svelte';

	interface Props {
		children?: Snippet;
		offline?: Snippet;
		toaster?: Snippet;
	}

	const noop = (() => {}) as Snippet;

	let { children = noop, offline = noop, toaster = noop }: Props = $props();

	// QW-3/A41/F23: indikator mencolok saat build berjalan di mode demo —
	// data hanya tersimpan lokal per perangkat, tidak pernah masuk Supabase.
	const demo = $derived(get(demoMode));
</script>

<div class="flex min-h-dvh min-w-0 flex-col overflow-x-clip bg-background text-foreground">
	{#if demo}
		<div
			data-testid="demo-banner"
			role="status"
			class="sticky top-0 z-50 bg-amber-400 px-4 py-1.5 text-center text-xs font-bold uppercase tracking-widest text-black shadow-md"
		>
			⚠️ Mode Demo — data hanya lokal, tidak tersimpan ke server
		</div>
	{/if}

	{@render offline?.()}

	<main class="min-w-0 w-full flex-1 overflow-x-clip px-4 pb-32 pt-4">
		{@render children()}
	</main>

	<BottomNav />

	{@render toaster?.()}
</div>
