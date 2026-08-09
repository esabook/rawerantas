import { cleanup, fireEvent, render, waitFor } from "@testing-library/svelte";
import { get } from "svelte/store";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toasts } from "$lib/components/toast/toastStore";

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
	PUBLIC_TERMS_URL: "",
}));

import MancingPanel from "$lib/components/MancingPanel.svelte";
import { resetDemoMancingScores } from "$lib/db/scores";
import { demoCompetitions } from "$lib/demo/generator";
import { setDemoMode } from "$lib/demo/store";

const competitionId = demoCompetitions()[0].id;

afterEach(cleanup);

const renderPanel = async () => {
	const result = render(MancingPanel, {
		competitionId,
		competitionName: "Mancing Lele",
		recordedBy: "hash-juri",
	});
	await waitFor(
		() => {
			expect(result.container.querySelector("select")).not.toBeNull();
		},
		{ timeout: 5000 },
	);
	return result;
};

describe("MancingPanel", () => {
	beforeEach(async () => {
		await setDemoMode(true);
		await resetDemoMancingScores();
	});

	it("menonaktifkan submit saat timbangan kosong atau 0", async () => {
		const { container } = await renderPanel();
		const submit = container.querySelector('button[type="button"]:has(svg)');
		expect(submit).not.toBeNull();
		expect(submit?.hasAttribute("disabled")).toBe(true);
	});

	it("timbangan ≤ 0 ditolak (numpad 0 tidak bisa ditambah lagi)", async () => {
		const { container } = await renderPanel();
		fireEvent.click(
			container.querySelector('button[aria-label="Digit 0"]') as Element,
		);
		const display = container.querySelector('[role="status"]');
		expect(display?.textContent).toContain("0 kg");
	});

	it("menampilkan badge offline saat koneksi putus", async () => {
		const { online } = await import("$lib/offline/networkStore");
		online.set(false);
		const { container } = await renderPanel();
		await waitFor(() => {
			expect(container.textContent ?? "").toContain("Offline — antrean");
		});
		online.set(true);
	});

	it("submit sukses memunculkan toast undoable", async () => {
		const { container } = await renderPanel();
		const select = container.querySelector("select") as HTMLSelectElement;
		await waitFor(
			() => {
				const opt = container.querySelector('option[value="3"]');
				expect(opt?.textContent).not.toContain("belum terdaftar");
			},
			{ timeout: 5000 },
		);
		fireEvent.change(select, { target: { value: "3" } });
		await new Promise((r) => setTimeout(r, 20));
		fireEvent.click(
			container.querySelector('button[aria-label="Digit 5"]') as Element,
		);
		await new Promise((r) => setTimeout(r, 20));
		fireEvent.click(
			container.querySelector('button[aria-label="Digit 0"]') as Element,
		);
		fireEvent.click(
			container.querySelector('button[aria-label="Digit 0"]') as Element,
		);
		await new Promise((r) => setTimeout(r, 20));
		const submit = Array.from(container.querySelectorAll("button")).find((b) =>
			(b.textContent ?? "").includes("Simpan Skor"),
		) as Element;
		fireEvent.click(submit);
		await waitFor(
			() => {
				expect(get(toasts).some((t) => t.message.includes("Tersimpan"))).toBe(
					true,
				);
			},
			{ timeout: 5000 },
		);
		toasts.set([]);
	});
});
