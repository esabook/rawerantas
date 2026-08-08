import type { Snippet } from "svelte";

export type SortDir = "asc" | "desc" | null;
export type TableDensity = "compact" | "normal" | "spacious";
export type TableViewMode = "row-wrap" | "row-scroll";

export interface Column<T> {
	key: keyof T | string;
	label: string;
	getValue?: (row: T) => unknown;
	sortable?: boolean;
	wrap?: boolean;
	width?: string;
	hidden?: boolean;
	align?: "left" | "center" | "right";
	cell?: Snippet<[T]>;
}

export function exportToCSV<T>(
	columns: Column<T>[],
	rows: T[],
	filename = "export-data.csv",
): void {
	const visibleColumns = columns.filter((column) => !column.hidden);
	const headers = visibleColumns
		.map((column) => `"${column.label.replace(/"/g, '""')}"`)
		.join(",");
	const dataRows = rows.map((row) =>
		visibleColumns
			.map((column) => {
				const value = column.getValue
					? column.getValue(row)
					: row[column.key as keyof T];
				const text = value === null || value === undefined ? "" : String(value);
				return `"${text.replace(/"/g, '""')}"`;
			})
			.join(","),
	);
	const blob = new Blob([[headers, ...dataRows].join("\n")], {
		type: "text/csv;charset=utf-8;",
	});
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	URL.revokeObjectURL(url);
}
