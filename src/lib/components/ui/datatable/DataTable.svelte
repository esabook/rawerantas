<script lang="ts" generics="T">
	import { ChevronLeft, ChevronRight } from "@lucide/svelte";
	import DataTableToolbar from "./DataTableToolbar.svelte";
	import {
		exportToCSV,
		type Column,
		type SortDir,
		type TableDensity,
		type TableViewMode,
	} from "./datatable.types";

	let {
		columns = $bindable<Column<T>[]>([]),
		rows,
		page = $bindable(1),
		pageSize = $bindable(10),
		loading = false,
		keyField = "id" as keyof T,
		exportFilename = "data-export.csv",
		onrowclick,
		cell,
	}: {
		columns: Column<T>[];
		rows: T[];
		page?: number;
		pageSize?: number;
		loading?: boolean;
		keyField?: keyof T;
		exportFilename?: string;
		onrowclick?: (row: T) => void;
		cell?: import("svelte").Snippet<[{ column: Column<T>; row: T }]>;
	} = $props();

	let searchQuery = $state("");
	let density = $state<TableDensity>("normal");
	let viewMode = $state<TableViewMode>("row-wrap");
	let sortKey = $state<keyof T | string | null>(null);
	let sortDir = $state<SortDir>(null);

	function getValue(column: Column<T>, row: T): unknown {
		return column.getValue ? column.getValue(row) : row[column.key as keyof T];
	}

	const filteredRows = $derived.by(() => {
		if (!searchQuery.trim()) return rows;
		const query = searchQuery.toLowerCase();
		return rows.filter((row) =>
			columns.some((column) => {
				const value = getValue(column, row);
				return value !== null && value !== undefined && String(value).toLowerCase().includes(query);
			}),
		);
	});

	const sortedRows = $derived.by(() => {
		if (!sortKey || !sortDir) return filteredRows;
		const column = columns.find((item) => item.key === sortKey);
		return [...filteredRows].sort((left, right) => {
			const valueA = column ? getValue(column, left) : left[sortKey as keyof T];
			const valueB = column ? getValue(column, right) : right[sortKey as keyof T];
			if (valueA === valueB) return 0;
			if (valueA === null || valueA === undefined) return 1;
			if (valueB === null || valueB === undefined) return -1;
			const result = valueA > valueB ? 1 : -1;
			return sortDir === "asc" ? result : -result;
		});
	});

	const visibleColumns = $derived(columns.filter((column) => !column.hidden));
	const totalPages = $derived(Math.ceil(sortedRows.length / pageSize) || 1);
	const displayRows = $derived(
		sortedRows.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize),
	);

	$effect(() => {
		searchQuery;
		if (page > totalPages) page = totalPages;
		if (page < 1) page = 1;
	});

	function handleSort(key: keyof T | string): void {
		if (sortKey === key) {
			sortDir = sortDir === "asc" ? "desc" : sortDir === "desc" ? null : "asc";
		} else {
			sortKey = key;
			sortDir = "asc";
		}
	}

	function openRow(row: T): void {
		onrowclick?.(row);
	}

	function handleRowKeydown(event: KeyboardEvent, row: T): void {
		if (event.key === "Enter" || event.key === " ") {
			event.preventDefault();
			openRow(row);
		}
	}
</script>

<div class="flex min-w-0 flex-col gap-3">
	<DataTableToolbar bind:searchQuery bind:columns bind:density bind:viewMode onexport={() => exportToCSV(columns, sortedRows, exportFilename)} />

	{#if loading}
		<div class="rounded-xl border border-border bg-background/60 p-8 text-center text-sm text-muted-foreground">Memuat data…</div>
	{:else if displayRows.length === 0}
		<div class="rounded-xl border border-border bg-background/60 p-8 text-center text-sm text-muted-foreground">Belum ada data pembayaran dengan filter ini.</div>
	{:else}
		<div class="min-w-0 overflow-x-auto rounded-xl border border-border bg-background/60">
			<table class="w-full min-w-[920px] table-auto text-left text-sm" class:table-fixed={viewMode === "row-wrap"}>
				<thead class="border-b border-border bg-white/[0.03] text-xs text-muted-foreground">
					<tr>
						{#each visibleColumns as column (String(column.key))}
							<th class="px-2 py-3 font-medium" style:width={column.width} style:text-align={column.align ?? "left"}>
								{#if column.sortable}
									<button type="button" class="inline-flex items-center gap-1 font-medium hover:text-foreground" onclick={() => handleSort(column.key)}>
										{column.label}
										<span aria-hidden="true">{sortKey === column.key && sortDir === "asc" ? "↑" : sortKey === column.key && sortDir === "desc" ? "↓" : "↕"}</span>
									</button>
								{:else}
									{column.label}
								{/if}
							</th>
						{/each}
					</tr>
				</thead>
				<tbody class="divide-y divide-border/70">
					{#each displayRows as row (String(row[keyField]))}
						<tr
							class="align-top transition-colors hover:bg-white/[0.04] {onrowclick ? 'cursor-pointer focus-visible:bg-white/[0.06]' : ''}"
							role={onrowclick ? "button" : undefined}
							tabindex={onrowclick ? 0 : undefined}
							aria-label={onrowclick ? "Lihat detail baris" : undefined}
							onclick={() => openRow(row)}
							onkeydown={(event) => handleRowKeydown(event, row)}
						>
							{#each visibleColumns as column (String(column.key))}
								<td
									class="border-b border-border/70 px-2 {density === 'compact' ? 'py-2' : density === 'spacious' ? 'py-4' : 'py-3'} {viewMode === 'row-wrap' || column.wrap ? 'whitespace-normal break-words' : 'whitespace-nowrap'}"
									style:text-align={column.align ?? "left"}
								>
									{#if cell}
										{@render cell({ column, row })}
									{:else if column.cell}
										{@render column.cell(row)}
									{:else}
										{getValue(column, row) ?? "—"}
									{/if}
								</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}

	<div class="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
		<span>Menampilkan {displayRows.length} dari {sortedRows.length} pembayaran</span>
		{#if totalPages > 1}
			<nav class="flex items-center gap-2" aria-label="Navigasi halaman pembayaran">
				<button type="button" class="btn btn-sm" disabled={page <= 1} onclick={() => (page -= 1)} aria-label="Halaman sebelumnya"><ChevronLeft class="h-4 w-4" aria-hidden="true" />Sebelumnya</button>
				<span><strong>{page}</strong>/{totalPages}</span>
				<button type="button" class="btn btn-sm" disabled={page >= totalPages} onclick={() => (page += 1)} aria-label="Halaman berikutnya">Berikutnya<ChevronRight class="h-4 w-4" aria-hidden="true" /></button>
			</nav>
		{/if}
	</div>
</div>
