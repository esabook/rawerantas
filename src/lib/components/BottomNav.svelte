<script lang="ts">
	import { page } from '$app/state';
	import { Home, Trophy, UserPlus } from '@lucide/svelte';
	import type { Component } from 'svelte';

	interface NavItem {
		href: string;
		label: string;
		icon: Component;
	}

	const items: NavItem[] = [
		{ href: '/', label: 'Landing', icon: Home },
		{ href: '/daftar', label: 'Daftar', icon: UserPlus },
		{ href: '/leaderboard', label: 'Leaderboard', icon: Trophy }
	];

	function isActive(href: string): boolean {
		return page.url.pathname === href;
	}
</script>

<nav aria-label="Navigasi utama" class="fixed inset-x-0 bottom-0 z-40">
	<div class="glass-panel mx-auto grid w-full max-w-lg grid-cols-3 border-t border-white/10">
		{#each items as item (item.href)}
			{@const active = isActive(item.href)}
			<a
				href={item.href}
				class="flex min-h-14 flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] transition-colors duration-150"
				aria-current={active ? 'page' : undefined}
			>
				<span class="flex flex-col items-center justify-center gap-0.5 rounded-full px-4 py-1 {active ? 'bg-gold/10 text-gold' : 'text-muted-foreground'}">
					<item.icon class="h-6 w-6" />
					<span class="{active ? 'font-semibold' : ''}">{item.label}</span>
				</span>
			</a>
		{/each}
	</div>
</nav>
