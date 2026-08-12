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

import LayanganPanel from "$lib/components/LayanganPanel.svelte";
import { resetLocalDemoState } from "$lib/db/localStore";
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
			expect(result.container.textContent ?? "").toContain(`Babak ${round}`);
			expect(
				result.container.querySelectorAll("ul button").length,
			).toBeGreaterThan(0);
		},
		{ timeout: 5000 },
	);
	return result;
};

const findButton = (container: HTMLElement, label: string) =>
	Array.from(container.querySelectorAll("button")).find((b) =>
		(b.textContent ?? "").includes(label),
	);

const startTheRound = async (container: HTMLElement) => {
	const btn = findButton(container, "Mulai Lomba");
	expect(btn).toBeDefined();
	await fireEvent.click(btn as Element);
	await waitFor(() => {
		expect(container.textContent ?? "").toContain("Dimulai");
	});
};

describe("LayanganPanel", () => {
	beforeEach(async () => {
		await setDemoMode(true);
		// B/A: resetLocalDemoState (bukan hanya resetDemoLayanganScores) —
		// "Mulai Lomba" menulis override lokal ke store kompetisi juga, harus
		// bersih tiap test agar round-started tidak bocor antar test.
		await resetLocalDemoState();
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

	it("card menampilkan semua peserta dengan label status", async () => {
		const { container } = await renderPanel(1);
		const cards = container.querySelectorAll("ul button");
		expect(cards.length).toBeLessThan(aduanParticipants.length);
		expect(container.textContent ?? "").toContain("BELUM DINILAI");
		const scoredTab = Array.from(
			container.querySelectorAll('[role="tab"]'),
		).find((button) => (button.textContent ?? "").includes("Sudah dinilai"));
		expect(scoredTab).toBeDefined();
		await fireEvent.click(scoredTab as Element);
		await waitFor(() => {
			expect(container.querySelectorAll("ul button").length).toBeGreaterThan(0);
			expect(container.textContent ?? "").toContain("MUDUN");
		});
		expect(
			Array.from(container.querySelectorAll("button")).filter((button) =>
				(button.textContent ?? "").includes("Catat MUDUN"),
			).length,
		).toBe(0);
	});

	it("klik card → popup konfirmasi → MUDUN tercatat", async () => {
		const { container } = await renderPanel(2);
		await startTheRound(container);
		const pendingCards = () =>
			Array.from(container.querySelectorAll("ul button")).filter((b) =>
				(b.textContent ?? "").includes("BELUM DINILAI"),
			);
		const before = pendingCards().length;
		expect(before).toBeGreaterThan(0);
		await fireEvent.click(pendingCards()[0]);
		await waitFor(() => {
			expect(container.textContent ?? "").toContain("Konfirmasi hasil");
		});
		const mudun = Array.from(container.querySelectorAll("button")).find((b) =>
			(b.textContent ?? "").includes("Catat MUDUN"),
		);
		expect(mudun).toBeDefined();
		await fireEvent.click(mudun as Element);
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
			expect(pendingCards().length).toBe(before - 1);
		});
	});

	it("undo 5 detik mengembalikan status card menjadi belum dinilai", async () => {
		const { container } = await renderPanel(2);
		await startTheRound(container);
		const pendingCards = () =>
			Array.from(container.querySelectorAll("ul button")).filter((b) =>
				(b.textContent ?? "").includes("BELUM DINILAI"),
			);
		const before = pendingCards().length;
		await fireEvent.click(pendingCards()[0]);
		await waitFor(() => {
			expect(container.textContent ?? "").toContain("Konfirmasi hasil");
		});
		const mudun = () =>
			Array.from(container.querySelectorAll("button")).find((b) =>
				(b.textContent ?? "").includes("Catat MUDUN"),
			);
		await waitFor(() => expect(mudun()).toBeDefined());
		await fireEvent.click(mudun() as Element);
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
			expect(pendingCards().length).toBe(before);
		});
	});

	it("round berubah → label babak ikut berubah", async () => {
		const { container } = await renderPanel(1);
		expect((container.textContent ?? "").includes("Babak 1")).toBe(true);
		const a = await renderPanel(2);
		expect((a.container.textContent ?? "").includes("Babak 2")).toBe(true);
		expect(container.textContent ?? "").not.toContain("Babak 2");
	});

	it("klik PUTUS mencatat status putus", async () => {
		const { container } = await renderPanel(2);
		await startTheRound(container);
		const card = container.querySelector("ul button");
		expect(card).toBeDefined();
		await fireEvent.click(card as Element);
		await waitFor(() => {
			expect(container.textContent ?? "").toContain("Konfirmasi hasil");
		});
		const putus = Array.from(container.querySelectorAll("button")).find((b) =>
			(b.textContent ?? "").includes("Catat PUTUS"),
		);
		expect(putus).toBeDefined();
		await fireEvent.click(putus as Element);
		await waitFor(
			() => {
				expect(get(toasts).some((t) => t.message.includes("PUTUS"))).toBe(true);
			},
			{ timeout: 5000 },
		);
	});

	it("mencari nomor peserta memfilter card", async () => {
		const { container } = await renderPanel(2);
		const search = container.querySelector('input[type="search"]');
		expect(search).toBeDefined();
		await fireEvent.input(search as HTMLInputElement, {
			target: { value: aduanParticipants[0].ticketNumber },
		});
		await waitFor(() => {
			expect(container.querySelectorAll("ul button").length).toBe(1);
			expect(container.textContent ?? "").toContain(
				aduanParticipants[0].ticketNumber,
			);
		});
	});

	it("babak belum dimulai: MUDUN/PUTUS nonaktif, DQ tetap bisa dicatat", async () => {
		const { container } = await renderPanel(2);
		const card = container.querySelector("ul button");
		expect(card).toBeDefined();
		await fireEvent.click(card as Element);
		await waitFor(() => {
			expect(container.textContent ?? "").toContain("Konfirmasi hasil");
		});
		expect(container.textContent ?? "").toContain("Babak belum dimulai");
		const mudun = findButton(container, "Catat MUDUN") as
			| HTMLButtonElement
			| undefined;
		const putus = findButton(container, "Catat PUTUS") as
			| HTMLButtonElement
			| undefined;
		const dq = findButton(container, "Catat DQ") as
			| HTMLButtonElement
			| undefined;
		expect(mudun?.disabled).toBe(true);
		expect(putus?.disabled).toBe(true);
		expect(dq?.disabled).toBe(false);
		await fireEvent.click(dq as Element);
		await waitFor(() => {
			expect(get(toasts).some((t) => t.message.includes("DQ"))).toBe(true);
		});
	});

	it('"Mulai Lomba" mengubah panel ke state berjalan dgn timer bersama', async () => {
		const { container } = await renderPanel(2);
		expect(findButton(container, "Mulai Lomba")).toBeDefined();
		await startTheRound(container);
		expect(findButton(container, "Mulai Lomba")).toBeUndefined();
		expect(container.textContent ?? "").toContain("Dimulai");
		const card = container.querySelector("ul button");
		await fireEvent.click(card as Element);
		await waitFor(() => {
			expect(container.textContent ?? "").toContain("Konfirmasi hasil");
		});
		const mudun = findButton(container, "Catat MUDUN") as
			| HTMLButtonElement
			| undefined;
		expect(mudun?.disabled).toBe(false);
	});

	it('tombol "Ulangi" perlu konfirmasi dua langkah sebelum mulai ulang', async () => {
		const { container } = await renderPanel(2);
		await startTheRound(container);
		const ulangi = findButton(container, "Ulangi");
		expect(ulangi).toBeDefined();
		await fireEvent.click(ulangi as Element);
		await waitFor(() => {
			expect(container.textContent ?? "").toContain("Mulai ulang?");
		});
		await fireEvent.click(findButton(container, "Batal") as Element);
		await waitFor(() => {
			expect(container.textContent ?? "").not.toContain("Mulai ulang?");
			expect(container.textContent ?? "").toContain("Dimulai");
		});
		await fireEvent.click(findButton(container, "Ulangi") as Element);
		await waitFor(() =>
			expect(container.textContent ?? "").toContain("Mulai ulang?"),
		);
		await fireEvent.click(findButton(container, "Ya, mulai ulang") as Element);
		await waitFor(() => {
			expect(container.textContent ?? "").not.toContain("Mulai ulang?");
			expect(container.textContent ?? "").toContain("Dimulai");
		});
	});

	it('"Selesai Babak" (2 langkah) menutup timer — MUDUN/PUTUS nonaktif lagi, DQ tetap aktif', async () => {
		const { container } = await renderPanel(2);
		await startTheRound(container);
		const selesai = findButton(container, "Selesai Babak");
		expect(selesai).toBeDefined();
		await fireEvent.click(selesai as Element);
		await waitFor(() => {
			expect(container.textContent ?? "").toContain("Tutup timer babak ini?");
		});
		// Batal → timer tetap jalan.
		await fireEvent.click(findButton(container, "Batal") as Element);
		await waitFor(() => {
			expect(container.textContent ?? "").not.toContain(
				"Tutup timer babak ini?",
			);
			expect(container.textContent ?? "").toContain("Dimulai");
		});
		// Selesai Babak lagi → konfirmasi → beneran tutup.
		await fireEvent.click(findButton(container, "Selesai Babak") as Element);
		await waitFor(() =>
			expect(container.textContent ?? "").toContain("Tutup timer babak ini?"),
		);
		await fireEvent.click(
			findButton(container, "Ya, selesai babak") as Element,
		);
		await waitFor(() => {
			expect(findButton(container, "Mulai Lomba")).toBeDefined();
		});
		const card = container.querySelector("ul button");
		await fireEvent.click(card as Element);
		await waitFor(() => {
			expect(container.textContent ?? "").toContain("Konfirmasi hasil");
		});
		const mudun = findButton(container, "Catat MUDUN") as
			| HTMLButtonElement
			| undefined;
		const dq = findButton(container, "Catat DQ") as
			| HTMLButtonElement
			| undefined;
		expect(mudun?.disabled).toBe(true);
		expect(dq?.disabled).toBe(false);
	});
});
