import { describe, expect, it, vi } from "vitest";

vi.mock("$env/static/public", () => ({
	PUBLIC_BASE_URL: "",
	PUBLIC_APP_NAME: "",
	PUBLIC_APP_YEAR: "",
	PUBLIC_EVENT_DATE: "",
	PUBLIC_ENABLE_DEMO_MODE: "true",
	PUBLIC_SUPABASE_URL: "",
	PUBLIC_SUPABASE_ANON_KEY: "",
	PUBLIC_ADMIN_PIN: "",
	PUBLIC_PANITIA_PIN: "",
	PUBLIC_JURI_PIN: "",
}));

import {
	DEFAULT_THERMAL_WIDTH,
	selectThermalWidth,
	thermalCss,
} from "../thermal";
import { buildCheckinUrl, waShare } from "../whatsapp";

describe("buildCheckinUrl", () => {
	it("menggabungkan base url + route + id ter-encode", () => {
		expect(buildCheckinUrl("A-01")).toBe("/panitia/checkin?id=A-01");
		expect(buildCheckinUrl(42)).toBe("/panitia/checkin?id=42");
		expect(buildCheckinUrl("a b/c")).toBe("/panitia/checkin?id=a%20b%2Fc");
	});
});

describe("waShare", () => {
	it("text saja; dengan url digabung newline + encoded", () => {
		expect(waShare("Tiket #42")).toBe("https://wa.me/?text=Tiket%20%2342");
		expect(waShare("Tiket", "https://x.test/t")).toBe(
			"https://wa.me/?text=Tiket%0Ahttps%3A%2F%2Fx.test%2Ft",
		);
	});
});

describe("selectThermalWidth", () => {
	it("query print=58/80; lainnya default 80", () => {
		expect(selectThermalWidth(new URLSearchParams("print=58"))).toBe(58);
		expect(selectThermalWidth(new URLSearchParams("print=80"))).toBe(80);
		expect(selectThermalWidth(new URLSearchParams(""))).toBe(
			DEFAULT_THERMAL_WIDTH,
		);
		expect(selectThermalWidth(new URLSearchParams("print=100"))).toBe(80);
	});
});

describe("thermalCss", () => {
	it("dua ukuran → ukuran @page berbeda", () => {
		expect(thermalCss(58)).toContain("size: 58mm auto");
		expect(thermalCss(80)).toContain("size: 80mm auto");
		expect(thermalCss(58)).not.toContain("80mm");
	});
});
