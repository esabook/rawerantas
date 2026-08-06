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

import HiasPanel from "$lib/components/HiasPanel.svelte";
import { resetDemoHiasScores } from "$lib/db/hias";
import { demoCompetitions, demoParticipants } from "$lib/demo/generator";
import { setDemoMode } from "$lib/demo/store";

const competitionId = demoCompetitions()[2].id;
const hiasParticipants = demoParticipants().filter(
	(p) => p.competitionId === competitionId,
);

afterEach(cleanup);

const renderPanel = async () => {
	const result = render(HiasPanel, {
		competitionId,
		competitionName: "Layangan Hias",
		recordedBy: "hash-juri",
	});
	await waitFor(
		() => {
			expect(result.container.textContent ?? "").toContain("belum diskor");
		},
		{ timeout: 5000 },
	);
	return result;
};

describe("HiasPanel", () => {
	beforeEach(async () => {
		await setDemoMode(true);
		await resetDemoHiasScores();
	});

	it("menampilkan daftar peserta + badge offline", async () => {
		await renderPanel();
		expect(hiasParticipants.length).toBeGreaterThan(0);
		const { online } = await import("$lib/offline/networkStore");
		online.set(false);
		const result = render(HiasPanel, {
			competitionId,
			competitionName: "Layangan Hias",
			recordedBy: "hash-juri",
		});
		await waitFor(() => {
			expect(result.container.textContent ?? "").toContain("Offline — antrean");
		});
		online.set(true);
	});

	it("pilih peserta → preview total live mengikuti slider", async () => {
		const { container } = await renderPanel();
		fireEvent.click(
			Array.from(container.querySelectorAll("button")).find((b) =>
				(b.textContent ?? "").includes(hiasParticipants[8].name),
			) as Element,
		);
		await waitFor(() => {
			expect(
				container.querySelector('[aria-label="Total berbobot"]'),
			).not.toBeNull();
		});
		const ranges = Array.from(
			container.querySelectorAll('input[type="range"]'),
		) as HTMLInputElement[];
		expect(ranges).toHaveLength(3);
		fireEvent.input(ranges[0], { target: { value: "100" } });
		fireEvent.input(ranges[1], { target: { value: "100" } });
		fireEvent.input(ranges[2], { target: { value: "100" } });
		await waitFor(() => {
			expect(
				container.querySelector('[aria-label="Total berbobot"]')?.textContent,
			).toBe("100");
		});
	});

	it("simpan → toast tersimpan, badge poin muncul", async () => {
		const { container } = await renderPanel();
		const btn = Array.from(container.querySelectorAll("button")).find((b) =>
			(b.textContent ?? "").includes(hiasParticipants[8].name),
		) as Element;
		fireEvent.click(btn);
		await waitFor(() => {
			expect(container.textContent ?? "").toContain("Total berbobot");
		});
		fireEvent.click(
			Array.from(container.querySelectorAll("button")).find((b) =>
				(b.textContent ?? "").includes("Simpan Skor"),
			) as Element,
		);
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
			expect(container.textContent ?? "").toContain("poin");
		});
	});

	it("peserta dengan skor lama (window lewat) tidak bisa rescore", async () => {
		const stale = hiasParticipants[8];
		const { saveLocal } = await import("$lib/db/hias");
		await saveLocal({
			participantId: stale.id,
			competitionId,
			aesthetic: 50,
			stability: 50,
			creativity: 50,
			totalWeighted: 50,
			recordedBy: "hash-juri",
			idempotencyKey: crypto.randomUUID(),
			receivedAt: new Date(Date.now() - 6 * 60 * 1000),
			editedAt: new Date(Date.now() - 6 * 60 * 1000),
		});
		const { container } = await renderPanel();
		fireEvent.click(
			Array.from(container.querySelectorAll("button")).find((b) =>
				(b.textContent ?? "").includes(stale.name),
			) as Element,
		);
		await waitFor(() => {
			expect(
				container.querySelector('[aria-label="Total berbobot"]'),
			).not.toBeNull();
		});
		fireEvent.click(
			Array.from(container.querySelectorAll("button")).find((b) =>
				(b.textContent ?? "").includes("Simpan"),
			) as Element,
		);
		await waitFor(
			() => {
				expect(
					(container.textContent ?? "").includes("Jendela edit 5 menit"),
				).toBe(true);
			},
			{ timeout: 5000 },
		);
	});
});
