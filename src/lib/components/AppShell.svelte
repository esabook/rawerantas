<script lang="ts">
import type { Snippet } from 'svelte';
import BottomNav from './BottomNav.svelte';

	interface Props {
		children?: Snippet;
		offline?: Snippet;
		toaster?: Snippet;
	}

	const noop = (() => {}) as Snippet;

	let { children = noop, offline = noop, toaster = noop }: Props = $props();
</script>

<div class="flex min-h-dvh min-w-0 flex-col overflow-x-clip bg-background text-foreground">
	{@render offline?.()}

	<main class="min-w-0 w-full flex-1 overflow-x-clip px-4 pb-32 pt-4">
		{@render children()}
	</main>

	<BottomNav />

	{@render toaster?.()}
</div>
