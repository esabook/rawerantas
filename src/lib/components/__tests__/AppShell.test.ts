import { cleanup, render, screen } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("$env/static/public", () => ({
	PUBLIC_BASE_URL: "https://rawe.test",
	PUBLIC_APP_NAME: "Rawera 2026",
	PUBLIC_APP_YEAR: "2026",
	PUBLIC_EVENT_DATE: "2026-08-17T08:00:00Z",
	PUBLIC_ENABLE_DEMO_MODE: "true",
	PUBLIC_SUPABASE_URL: "",
	PUBLIC_SUPABASE_ANON_KEY: "",
	PUBLIC_ADMIN_PIN: "123456",
	PUBLIC_PANITIA_PIN: "123456",
	PUBLIC_JURI_PIN: "123456",
}));

// BottomNav (dirender AppShell) membaca $app/state — sediakan URL statis.
vi.mock("$app/state", () => ({
	page: { url: new URL("https://rawe.test/") },
}));

import AppShell from "$lib/components/AppShell.svelte";
import { demoMode } from "$lib/demo/store";

describe("AppShell — banner MODE DEMO (QW-3/A41/F23)", () => {
	beforeEach(() => {
		demoMode.set(true);
	});

	afterEach(() => {
		cleanup();
		demoMode.set(true);
	});

	it("demoMode aktif → banner peringatan tampil", () => {
		render(AppShell);
		const banner = screen.getByTestId("demo-banner");
		expect(banner).toBeTruthy();
		expect(banner.textContent).toMatch(/mode demo/i);
	});

	it("demoMode mati → tidak ada banner", () => {
		demoMode.set(false);
		render(AppShell);
		expect(screen.queryByTestId("demo-banner")).toBeNull();
	});
});
