import { cleanup, fireEvent, render, waitFor } from "@testing-library/svelte";
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
	PUBLIC_TERMS_URL: "",
}));

const decodeCallbacks: Array<(text: string) => void> = [];
const mockStart = vi.fn(
	async (_config: unknown, _opts: unknown, onDecode: (t: string) => void) => {
		decodeCallbacks.push(onDecode);
	},
);
const mockStop = vi.fn(async () => {});
const mockClear = vi.fn(async () => {});

class MockHtml5Qrcode {
	start = mockStart;
	stop = mockStop;
	clear = mockClear;
}

vi.mock("html5-qrcode", () => ({
	Html5Qrcode: MockHtml5Qrcode,
}));

import CheckinScanner from "$lib/components/CheckinScanner.svelte";
import { getCheckinStats, resetDemoCheckins } from "$lib/db/checkin";
import { demoCompetitions, demoParticipants } from "$lib/demo/generator";
import { setDemoMode } from "$lib/demo/store";

const fullyPaid = demoParticipants().find((p) => p.status === "fully_paid");
if (!fullyPaid) {
	throw new Error("peserta fully_paid demo tidak ditemukan");
}

afterEach(cleanup);

describe("CheckinScanner", () => {
	beforeEach(async () => {
		await setDemoMode(true);
		await resetDemoCheckins();
		decodeCallbacks.length = 0;
		mockStart.mockClear();
		mockStop.mockClear();
		mockClear.mockClear();
	});

	it("menampilkan jumlah terdaftar dan sisa yang belum check-in", async () => {
		const { container } = render(CheckinScanner);

		await waitFor(() => {
			expect(container.textContent ?? "").toContain("Jumlah terdaftar");
		});

		const stats = container.querySelector('[aria-label="Statistik check-in"]');
		expect(stats?.textContent ?? "").toContain("Jumlah terdaftar");
		expect(stats?.textContent ?? "").toContain("Sisa belum check-in");
		expect(stats?.textContent ?? "").toContain("50");
		expect(stats?.textContent ?? "").toContain("42");
	});

	it("klik pindai → kamera start; decode QR ?id= → card peserta", async () => {
		const { container } = render(CheckinScanner);
		fireEvent.click(
			Array.from(container.querySelectorAll("button")).find((b) =>
				(b.textContent ?? "").includes("Pindai QR"),
			) as Element,
		);
		await waitFor(
			() => {
				expect(mockStart).toHaveBeenCalled();
			},
			{ timeout: 5000 },
		);
		expect(container.textContent ?? "").toContain("Memindai");
		expect(decodeCallbacks.length).toBeGreaterThan(0);
		decodeCallbacks[0](`https://rawe.test/panitia/checkin?id=${fullyPaid.id}`);
		await waitFor(
			() => {
				expect(container.textContent ?? "").toContain(fullyPaid.name);
			},
			{ timeout: 5000 },
		);
	});

	it("hentikan pemindaian → dapat memindai lagi", async () => {
		const { container } = render(CheckinScanner);
		const scanButton = () =>
			Array.from(container.querySelectorAll("button")).find((b) =>
				(b.textContent ?? "").includes("Pindai QR"),
			) as Element;

		fireEvent.click(scanButton());
		await waitFor(() => expect(mockStart).toHaveBeenCalledTimes(1));
		fireEvent.click(
			Array.from(container.querySelectorAll("button")).find((b) =>
				(b.textContent ?? "").includes("Hentikan Pemindaian"),
			) as Element,
		);
		await waitFor(() => expect(scanButton()).toBeTruthy());

		fireEvent.click(scanButton());
		await waitFor(() => expect(mockStart).toHaveBeenCalledTimes(2));
	});

	it("filter lomba membatasi statistik dan hasil pencarian", async () => {
		const competition = demoCompetitions()[0];
		const otherParticipant = demoParticipants().find(
			(p) => p.competitionId !== competition.id && p.status === "fully_paid",
		);
		if (!otherParticipant) {
			throw new Error("peserta lomba lain tidak ditemukan");
		}
		const expectedStats = await getCheckinStats(competition.id);
		const { container } = render(CheckinScanner);
		const select = container.querySelector(
			"#checkin-competition",
		) as HTMLSelectElement;

		await waitFor(() => {
			expect(
				select.querySelector(`option[value="${competition.id}"]`),
			).not.toBeNull();
		});
		fireEvent.change(select, { target: { value: competition.id } });
		await waitFor(() => {
			const stats = container.querySelector(
				'[aria-label="Statistik check-in"]',
			);
			expect(stats?.textContent ?? "").toContain(
				String(expectedStats.registered),
			);
		});

		const input = container.querySelector(
			'input[type="text"]',
		) as HTMLInputElement;
		fireEvent.input(input, {
			target: { value: otherParticipant.ticketNumber },
		});
		fireEvent.click(
			Array.from(container.querySelectorAll("button")).find((b) =>
				(b.textContent ?? "").includes("Cari"),
			) as Element,
		);
		await waitFor(() => {
			expect(container.textContent ?? "").toContain(
				`tidak ditemukan di lomba ${competition.name}`,
			);
		});
	});

	it("QR tanpa id → error", async () => {
		const { container } = render(CheckinScanner);
		fireEvent.click(
			Array.from(container.querySelectorAll("button")).find((b) =>
				(b.textContent ?? "").includes("Pindai QR"),
			) as Element,
		);
		await waitFor(() => {
			expect(decodeCallbacks.length).toBeGreaterThan(0);
		});
		decodeCallbacks[0]("https://example.com/plain");
		await waitFor(() => {
			expect(container.textContent ?? "").toContain("QR tidak dikenal");
		});
	});

	it("manual entry nomor tiket tanpa kamera → card peserta", async () => {
		const { container } = render(CheckinScanner);
		const input = container.querySelector(
			'input[type="text"]',
		) as HTMLInputElement;
		fireEvent.input(input, { target: { value: fullyPaid.ticketNumber } });
		fireEvent.click(
			Array.from(container.querySelectorAll("button")).find((b) =>
				(b.textContent ?? "").includes("Cari"),
			) as Element,
		);
		await waitFor(
			() => {
				expect(container.textContent ?? "").toContain(fullyPaid.name);
			},
			{ timeout: 5000 },
		);
	});

	it("manual entry tiket tak dikenal → error", async () => {
		const { container } = render(CheckinScanner);
		const input = container.querySelector(
			'input[type="text"]',
		) as HTMLInputElement;
		fireEvent.input(input, { target: { value: "RA-2026-999" } });
		fireEvent.click(
			Array.from(container.querySelectorAll("button")).find((b) =>
				(b.textContent ?? "").includes("Cari"),
			) as Element,
		);
		await waitFor(() => {
			expect(container.textContent ?? "").toContain("tidak ditemukan");
		});
	});
});
