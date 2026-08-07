import { cleanup, render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("$env/static/public", () => ({
	PUBLIC_BASE_URL: "",
	PUBLIC_APP_NAME: "",
	PUBLIC_APP_YEAR: "",
	PUBLIC_EVENT_DATE: "",
	PUBLIC_ENABLE_DEMO_MODE: "true",
	PUBLIC_SUPABASE_URL: "",
	PUBLIC_SUPABASE_ANON_KEY: "",
	PUBLIC_ADMIN_PIN: "",
	PUBLIC_JURI_PIN: "",
}));

import QRCode from "$lib/components/QRCode.svelte";

afterEach(cleanup);

describe("QRCode", () => {
	it("base url kosong → placeholder + warning, tanpa gambar", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		render(QRCode, { id: "T-1" });
		expect(screen.getByRole("alert").textContent).toContain(
			"QR tidak tersedia",
		);
		expect(screen.queryByRole("img")).toBeNull();
		warn.mockRestore();
	});
});
