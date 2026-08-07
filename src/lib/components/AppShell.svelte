<script lang="ts">
	import type { Snippet } from 'svelte';
	import BottomNav from './BottomNav.svelte';
	import SoundToggle from './SoundToggle.svelte';

	interface Props {
		children?: Snippet;
		offline?: Snippet;
		toaster?: Snippet;
	}

	const noop = (() => {}) as Snippet;

	let { children = noop, offline = noop, toaster = noop }: Props = $props();
</script>

<div class="flex min-h-dvh flex-col bg-background text-foreground">
	<header class="glass-panel sticky top-0 z-40 border-b border-white/10">
		<div class="mx-auto flex w-full max-w-lg items-center justify-between px-4 py-3">
			<a href="/" class="flex items-center gap-2 text-base font-semibold">
				<span class="text-secondary">Pesta Rakyat</span>
				<span class="text-muted-foreground">Agustusan</span>
			</a>
			<SoundToggle />
		</div>
	</header>

	{@render offline?.()}

	<main class="mx-auto w-full max-w-lg flex-1 px-4 pb-32 pt-4">
		{@render children()}
	</main>

	<BottomNav />

	{@render toaster?.()}
</div>
