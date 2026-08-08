<script lang="ts">
	import { page } from '$app/state';
	import {
		CalendarDays,
		Home,
		LayoutDashboard,
		ScanLine,
		ShieldCheck,
		Trophy,
		UserCircle,
		UserPlus,
	} from '@lucide/svelte';
	import type { Component } from 'svelte';

	type NavContext = 'guest' | 'admin' | 'juri' | 'panitia';

	interface NavItem {
		href: string;
		label: string;
		icon: Component;
	}

	const currentPath = $derived(page.url.pathname);
	const context = $derived.by((): NavContext => {
		const role = page.url.searchParams.get('role');
		if (currentPath === '/profil' && (role === 'admin' || role === 'juri' || role === 'panitia')) {
			return role;
		}
		if (currentPath === '/admin' || currentPath.startsWith('/admin/')) return 'admin';
		if (currentPath === '/juri' || currentPath.startsWith('/juri/')) return 'juri';
		if (currentPath.startsWith('/panitia/')) return 'panitia';
		return 'guest';
	});

	const items = $derived.by((): NavItem[] => {
		if (context === 'admin') {
			return [
				{ href: '/', label: 'BERANDA', icon: Home },
				{ href: '/admin', label: 'ADMIN', icon: ShieldCheck },
				{ href: '/profil?role=admin', label: 'PROFIL', icon: UserCircle },
			];
		}
		if (context === 'juri') {
			return [
				{ href: '/', label: 'BERANDA', icon: Home },
				{ href: '/juri', label: 'EVENTS', icon: CalendarDays },
				{ href: '/profil?role=juri', label: 'PROFIL', icon: UserCircle },
			];
		}
		if (context === 'panitia') {
			return [
				{ href: '/', label: 'BERANDA', icon: Home },
				{ href: '/panitia/checkin', label: 'CHECK-IN', icon: ScanLine },
				{ href: '/profil?role=panitia', label: 'PROFIL', icon: UserCircle },
			];
		}
		return [
			{ href: '/', label: 'BERANDA', icon: Home },
			{ href: '/daftar', label: 'DAFTAR', icon: UserPlus },
			{ href: '/leaderboard', label: 'LEADERBOARD', icon: Trophy },
		];
	});

	function isActive(href: string): boolean {
		if (href.startsWith('/profil')) return currentPath === '/profil';
		if (href === '/juri') return currentPath === '/juri' || currentPath.startsWith('/juri/');
		if (href === '/panitia/checkin') return currentPath.startsWith('/panitia/');
		return currentPath === href;
	}
</script>

<nav aria-label="Navigasi utama" class="fixed inset-x-0 bottom-0 z-40">
	<div class="border-t border-cyan-300/20 bg-[#05070d]/95 shadow-[0_-4px_28px_rgba(34,211,238,0.1)] backdrop-blur-xl">
		<div class="grid w-full grid-cols-3">
		{#each items as item (item.href)}
			{@const active = isActive(item.href)}
			<a
				href={item.href}
				class="flex min-h-14 min-w-0 flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] transition-colors duration-150"
				aria-current={active ? 'page' : undefined}
			>
				<span class="flex w-full min-w-0 flex-col items-center justify-center gap-0.5 rounded-full px-2 py-1 {active ? 'bg-gold/10 text-gold' : 'text-muted-foreground'}">
					<item.icon class="h-6 w-6" />
					<span class="block w-full truncate text-center text-[10px] uppercase tracking-wider {active ? 'font-semibold' : ''}">{item.label}</span>
				</span>
			</a>
		{/each}
		</div>
	</div>
</nav>
