<script lang="ts" generics="T">
	import {
		AlignJustify,
		Columns3,
		Download,
		MoveHorizontal,
		Search,
		X,
	} from "@lucide/svelte";
	import type { Column, TableDensity, TableViewMode } from "./datatable.types";

	let {
		searchQuery = $bindable(""),
		columns = $bindable<Column<T>[]>([]),
		density = $bindable<TableDensity>("normal"),
		viewMode = $bindable<TableViewMode>("row-wrap"),
		onexport,
	}: {
		searchQuery?: string;
		columns?: Column<T>[];
		density?: TableDensity;
		viewMode?: TableViewMode;
		onexport?: () => void;
	} = $props();

	let showColumnMenu = $state(false);
	let menuRef = $state<HTMLDivElement | null>(null);

	function handleWindowClick(event: MouseEvent): void {
		if (showColumnMenu && menuRef && !menuRef.contains(event.target as Node)) {
			showColumnMenu = false;
		}
	}

	function handleKeydown(event: KeyboardEvent): void {
		if (showColumnMenu && event.key === "Escape") {
			showColumnMenu = false;
		}
	}

	function toggleColumn(key: Column<T>["key"], visible: boolean): void {
		columns = columns.map((column) =>
			column.key === key ? { ...column, hidden: !visible } : column,
		);
	}
</script>

<svelte:window onclick={handleWindowClick} onkeydown={handleKeydown} />

<div class="relative min-w-0" bind:this={menuRef}>
	<div class="no-scrollbar flex min-w-0 flex-nowrap items-center gap-2 overflow-x-auto pb-1">
		<div class="relative shrink-0 ml-[1px]">
			<Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
			<input
				type="text"
				class="input h-9 w-48 pl-9 pr-8 text-xs sm:w-56"
				placeholder="Cari data…"
				bind:value={searchQuery}
				aria-label="Cari data pembayaran"
			/>
			{#if searchQuery}
				<button type="button" class="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground" onclick={() => (searchQuery = "")} aria-label="Hapus pencarian">
					<X class="h-3.5 w-3.5" aria-hidden="true" />
				</button>
			{/if}
		</div>

		<div class="flex shrink-0 overflow-hidden rounded-lg border border-border bg-background/50" role="radiogroup" aria-label="Kerapatan tabel">
			{#each [["compact", "S"], ["normal", "M"], ["spacious", "L"]] as option}
				<button type="button" class="h-9 min-w-8 px-2 text-xs font-semibold {density === option[0] ? 'bg-gold text-background' : 'text-muted-foreground hover:bg-muted'}" class:rounded-l-lg={option[0] === "compact"} class:rounded-r-lg={option[0] === "spacious"} onclick={() => (density = option[0] as TableDensity)} title={option[0]}>{option[1]}</button>
			{/each}
		</div>

		<div class="flex shrink-0 overflow-hidden rounded-lg border border-border bg-background/50" role="radiogroup" aria-label="Mode tabel">
			<button type="button" class="inline-flex h-9 items-center gap-1 px-2 text-xs {viewMode === 'row-wrap' ? 'bg-gold text-background' : 'text-muted-foreground hover:bg-muted'} rounded-l-lg" onclick={() => (viewMode = "row-wrap")} title="Baris wrap"><AlignJustify class="h-3.5 w-3.5" aria-hidden="true" />Wrap</button>
			<button type="button" class="inline-flex h-9 items-center gap-1 px-2 text-xs {viewMode === 'row-scroll' ? 'bg-gold text-background' : 'text-muted-foreground hover:bg-muted'} rounded-r-lg" onclick={() => (viewMode = "row-scroll")} title="Baris scroll"><MoveHorizontal class="h-3.5 w-3.5" aria-hidden="true" />Scroll</button>
		</div>

		<div class="relative shrink-0">
			<button type="button" class="btn btn-sm" onclick={() => (showColumnMenu = !showColumnMenu)} aria-expanded={showColumnMenu} aria-haspopup="menu">
				<Columns3 class="h-3.5 w-3.5" aria-hidden="true" />
				Kolom
			</button>
		</div>

		{#if onexport}
			<button type="button" class="btn btn-sm shrink-0" onclick={onexport} title="Ekspor ke CSV">
				<Download class="h-3.5 w-3.5" aria-hidden="true" />
				Ekspor CSV
			</button>
		{/if}
	</div>

	{#if showColumnMenu}
		<div class="absolute right-0 top-full z-20 mt-1 w-56 rounded-xl border border-border bg-[#0a0f1c] p-3 shadow-xl" role="menu" aria-label="Tampilkan kolom">
			<p class="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tampilkan kolom</p>
			<div class="grid gap-2">
				{#each columns as column (String(column.key))}
					<label class="flex items-center gap-2 text-sm">
						<input type="checkbox" checked={!column.hidden} onchange={(event) => toggleColumn(column.key, event.currentTarget.checked)} class="h-4 w-4 accent-gold" />
						<span class="break-words">{column.label}</span>
					</label>
				{/each}
			</div>
		</div>
	{/if}
</div>
