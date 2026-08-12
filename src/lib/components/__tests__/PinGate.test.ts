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
	PUBLIC_PANITIA_PIN: "",
	PUBLIC_JURI_PIN: "",
	PUBLIC_TERMS_URL: "",
}));

import {
	clearGrant,
	clearStaffGrant,
	DEMO_PIN,
	MAX_ATTEMPTS,
	readStaffGrant,
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

const renderGate = (kind: "juri" | "panitia" | "admin" = "admin") =>
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
		await expect(verifyPin("juri", "000000")).rejects.toThrow("PIN salah");
	});

	it("lockout 5× salah → PinLockoutError", async () => {
		for (let i = 0; i < MAX_ATTEMPTS; i++) {
			await recordFailedAttempt("juri");
		}
		await expect(verifyPin("juri", DEMO_PIN)).rejects.toThrow(/Kunci|30 detik/);
	});
});

describe("PinGate (admin — PIN bersama tidak berubah)", () => {
	beforeEach(() => {
		renderGate("admin");
	});

	it("PIN benar → children render", async () => {
		await typePin(DEMO_PIN);
		await waitFor(() => expect(hasContent()).toBe(true));
	});

	it("PIN salah → error tampil, children tidak render", async () => {
		await typePin("000000");
		await waitFor(() =>
			expect(
				(screen.getByRole("alert").textContent ?? "").includes("PIN salah"),
			).toBe(true),
		);
		expect(hasContent()).toBe(false);
	});

	it("5× salah → lockout message + keypad hilang", async () => {
		for (let i = 0; i < MAX_ATTEMPTS; i++) {
			await typePin("000000");
			await waitFor(() => expect(screen.queryByRole("alert")).toBeTruthy());
		}
		await waitFor(() =>
			expect(screen.queryByRole("button", { name: "1" })).toBeNull(),
		);
		expect(screen.getAllByText(/Kunci|Coba lagi/i).length).toBeGreaterThan(0);
	});

	it("grant session valid → children langsung render tanpa PIN", () => {
		cleanup();
		writeGrant("admin");
		renderGate("admin");
		expect(hasContent()).toBe(true);
	});

	it("grant kedaluwarsa/absent → gate tetap (children tidak render)", () => {
		cleanup();
		clearGrant("admin");
		renderGate("admin");
		expect(hasContent()).toBe(false);
	});
});

describe("PinGate (panitia/juri — login roster via 6 digit HP)", () => {
	beforeEach(() => {
		clearStaffGrant("juri");
		clearStaffGrant("panitia");
	});

	it("6 digit HP terdaftar & aktif (roster demo) → children render + grant tersimpan", async () => {
		renderGate("juri");
		// Demo seed: "Dewi Juri" +62812444444 (aktif).
		await typePin("444444");
		await waitFor(() => expect(hasContent()).toBe(true));
		const grant = readStaffGrant("juri");
		expect(grant?.name).toBe("Dewi Juri");
	});

	it("6 digit HP tidak dikenal → pesan not_found, children tidak render", async () => {
		renderGate("panitia");
		await typePin("999999");
		await waitFor(() =>
			expect(
				(screen.getByRole("alert").textContent ?? "").includes(
					"tidak ditemukan",
				),
			).toBe(true),
		);
		expect(hasContent()).toBe(false);
	});

	it("anggota nonaktif → diperlakukan sama seperti tidak ditemukan", async () => {
		renderGate("juri");
		// Demo seed: "Nita Juri" +62812666666 (nonaktif).
		await typePin("666666");
		await waitFor(() =>
			expect(
				(screen.getByRole("alert").textContent ?? "").includes(
					"tidak ditemukan",
				),
			).toBe(true),
		);
		expect(hasContent()).toBe(false);
	});

	it("5× salah → lockout", async () => {
		renderGate("juri");
		for (let i = 0; i < MAX_ATTEMPTS; i++) {
			await typePin("999999");
			await waitFor(() => expect(screen.queryByRole("alert")).toBeTruthy());
		}
		await waitFor(() =>
			expect(screen.queryByRole("button", { name: "1" })).toBeNull(),
		);
		expect(screen.getAllByText(/Kunci|Coba lagi/i).length).toBeGreaterThan(0);
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
