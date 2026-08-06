export const THERMAL_WIDTHS = [58, 80] as const;
export type ThermalWidth = (typeof THERMAL_WIDTHS)[number];
export const DEFAULT_THERMAL_WIDTH: ThermalWidth = 80;

export function selectThermalWidth(query: URLSearchParams): ThermalWidth {
	const raw = query.get("print");
	if (raw === "58") {
		return 58;
	}
	if (raw === "80") {
		return 80;
	}
	return DEFAULT_THERMAL_WIDTH;
}

export function thermalCss(widthMm: ThermalWidth): string {
	return `@media print { @page { size: ${widthMm}mm auto; margin: 0; } body { margin: 0; width: ${widthMm}mm; } }`;
}
