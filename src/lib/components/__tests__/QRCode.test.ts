import { cleanup, render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
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
