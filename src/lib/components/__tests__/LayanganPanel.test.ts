import "fake-indexeddb/auto";
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
	PUBLIC_ADMIN_PIN: "1234",
	PUBLIC_JURI_PIN: "1234",
}));

import LayanganPanel from "$lib/components/LayanganPanel.svelte";
import { resetDemoLayanganScores } from "$lib/db/layangan";
import { demoCompetitions, demoParticipants } from "$lib/demo/generator";
import { setDemoMode } from "$lib/demo/store";

const competitionId = demoCompetitions()[1].id;
const aduanParticipants = demoParticipants().filter(
	(p) => p.competitionId === competitionId,
);
const _seededRound1 = aduanParticipants.length;

afterEach(cleanup);

const renderPanel = async (round: number) => {
	const result = render(LayanganPanel, {
		competitionId,
		competitionName: "Aduan Layangan",
		round,
		recordedBy: "hash-juri",
	});
	await waitFor(
		() => {
			expect(
				result.container.querySelectorAll("button:has(svg)").length,
			).toBeGreaterThan(0);
		},
		{ timeout: 5000 },
	);
	return result;
};

describe("LayanganPanel", () => {
	beforeEach(async () => {
		await setDemoMode(true);
		await resetDemoLayanganScores();
	});

	it("menampilkan badge babak dan offline", async () => {
		const { container } = await renderPanel(1);
		expect(container.textContent ?? "").toContain("Babak 1");
		const { online } = await import("$lib/offline/networkStore");
		online.set(false);
		const result = render(LayanganPanel, {
			competitionId,
			competitionName: "Aduan Layangan",
			round: 1,
			recordedBy: "hash-juri",
		});
		await waitFor(() => {
			expect(result.container.textContent ?? "").toContain("Offline — antrean");
		});
		online.set(true);
	});

	it("peserta dengan hasil seed babak 1 tidak muncul sebagai aktif", async () => {
		const { container } = await renderPanel(1);
		const buttons = Array.from(container.querySelectorAll("button")).filter(
			(b) => (b.textContent ?? "").includes("MUDUN"),
		);
		expect(buttons.length).toBeLessThan(aduanParticipants.length);
		expect(buttons.length).toBeGreaterThan(0);
	});

	it("klik MUDUN → toast, peserta pindah ke hasil tercatat", async () => {
		const { container } = await renderPanel(2);
		const buttons = () =>
			Array.from(container.querySelectorAll("button")).filter((b) =>
				(b.textContent ?? "").includes("MUDUN"),
			);
		const before = buttons().length;
		expect(before).toBeGreaterThan(0);
		fireEvent.click(buttons()[0]);
		await waitFor(
			() => {
				expect(get(toasts).some((t) => t.message.includes("Tersimpan"))).toBe(
					true,
				);
			},
			{ timeout: 5000 },
		);
		toasts.set([]);
		await waitFor(() => {
			expect(buttons().length).toBe(before - 1);
		});
	});

	it("undo 5 detik mengembalikan peserta ke daftar aktif", async () => {
		const { container } = await renderPanel(2);
		const buttons = () =>
			Array.from(container.querySelectorAll("button")).filter((b) =>
				(b.textContent ?? "").includes("MUDUN"),
			);
		const before = buttons().length;
		fireEvent.click(buttons()[0]);
		await waitFor(
			() => {
				const t = get(toasts).find((x) => x.message.includes("Tersimpan"));
				if (!t) {
					throw new Error("toast belum muncul");
				}
				t.onUndo();
			},
			{ timeout: 5000 },
		);
		await waitFor(() => {
			expect(buttons().length).toBe(before);
		});
	});

	it("round berubah → board reset (semua peserta aktif lagi)", async () => {
		const { container } = await renderPanel(1);
		expect((container.textContent ?? "").includes("Babak 1")).toBe(true);
		const a = await renderPanel(2);
		expect((a.container.textContent ?? "").includes("Babak 2")).toBe(true);
		expect(container.textContent ?? "").not.toContain("Babak 2");
	});

	it("klik PUTUS mencatat status putus", async () => {
		const { container } = await renderPanel(2);
		const putus = Array.from(container.querySelectorAll("button")).filter((b) =>
			(b.textContent ?? "").includes("PUTUS"),
		)[0];
		expect(putus).toBeDefined();
		fireEvent.click(putus as Element);
		await waitFor(
			() => {
				expect(get(toasts).some((t) => t.message.includes("PUTUS"))).toBe(true);
			},
			{ timeout: 5000 },
		);
	});
});
