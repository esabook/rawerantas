import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

import {
	clearGrant,
	DEMO_PIN,
	MAX_ATTEMPTS,
	recordFailedAttempt,
	sha256Hex,
	verifyPin,
	writeGrant,
} from "$lib/security/pin";
import PinGateHarness from "./PinGateHarness.svelte";

afterEach(() => {
	cleanup();
	sessionStorage.clear();
});

const renderGate = (kind: "juri" | "admin" = "juri") =>
	render(PinGateHarness, { kind });

const typePin = async (pin: string) => {
	for (const digit of pin) {
		const btn = await screen.findByRole("button", { name: digit });
		await fireEvent.click(btn);
	}
};

const hasContent = () => screen.queryByTestId("content") !== null;

describe("verifyPin", () => {
	it("PIN benar → grant ditulis; salah → error", async () => {
		const grant = await verifyPin("juri", DEMO_PIN);
		expect(grant.kind).toBe("juri");
		await expect(verifyPin("juri", "0000")).rejects.toThrow("PIN salah");
	});

	it("lockout 5× salah → PinLockoutError", async () => {
		for (let i = 0; i < MAX_ATTEMPTS; i++) {
			await recordFailedAttempt("juri");
		}
		await expect(verifyPin("juri", DEMO_PIN)).rejects.toThrow(/Kunci|30 detik/);
	});
});

describe("PinGate", () => {
	beforeEach(() => {
		renderGate("juri");
	});

	it("PIN benar → children render", async () => {
		await typePin(DEMO_PIN);
		await waitFor(() => expect(hasContent()).toBe(true));
	});

	it("PIN salah → error tampil, children tidak render", async () => {
		await typePin("0000");
		await waitFor(() =>
			expect(
				(screen.getByRole("alert").textContent ?? "").includes("PIN salah"),
			).toBe(true),
		);
		expect(hasContent()).toBe(false);
	});

	it("5× salah → lockout message + keypad hilang", async () => {
		for (let i = 0; i < MAX_ATTEMPTS; i++) {
			await typePin("0000");
			await waitFor(() => expect(screen.queryByRole("alert")).toBeTruthy());
		}
		await waitFor(() =>
			expect(screen.queryByRole("button", { name: "1" })).toBeNull(),
		);
		expect(screen.getAllByText(/Kunci|Coba lagi/i).length).toBeGreaterThan(0);
	});

	it("grant session valid → children langsung render tanpa PIN", () => {
		cleanup();
		writeGrant("juri");
		renderGate("juri");
		expect(hasContent()).toBe(true);
	});

	it("grant kedaluwarsa/absent → gate tetap (children tidak render)", () => {
		cleanup();
		clearGrant("juri");
		renderGate("juri");
		expect(hasContent()).toBe(false);
	});
});

describe("sha256Hex", () => {
	it("menghasilkan 64 char hex deterministik", async () => {
		const a = await sha256Hex("1234");
		const b = await sha256Hex("1234");
		expect(a).toHaveLength(64);
		expect(a).toBe(b);
		expect(a).not.toBe(await sha256Hex("1235"));
	});
});
