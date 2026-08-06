import "fake-indexeddb/auto";
import { cleanup, render } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import LeaderboardBoard from "$lib/components/LeaderboardBoard.svelte";
import type { Competition, LeaderboardRow } from "$lib/db/queries";

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

afterEach(cleanup);

const comp = (scoringMode: Competition["scoringMode"]): Competition =>
	({
		id: "c1",
		name: "Kompetisi",
		scoringMode,
	}) as Competition;

const row = (
	participantId: string,
	name: string,
	extra: Record<string, unknown>,
): LeaderboardRow => ({
	id: `s-${participantId}`,
	receivedAt: new Date("2026-08-17T08:00:00Z"),
	competitionId: "c1",
	participantId,
	participants: { name, lapak_number: participantId },
	...extra,
});

describe("LeaderboardBoard", () => {
	it("terberat: urutan dari berat tertinggi, format kg", () => {
		const { container } = render(LeaderboardBoard, {
			competition: comp("terberat"),
			rows: [
				row("a", "Amin", {
					weight: 2000,
					fishWeightGram: 2000,
					isJackpot: false,
				}),
				row("b", "Budi", {
					weight: 3500,
					fishWeightGram: 3500,
					isJackpot: false,
				}),
			],
		});
		const text = container.textContent ?? "";
		expect(text.indexOf("Budi")).toBeLessThan(text.indexOf("Amin"));
		expect(text).toContain("3,5 kg");
		expect(text).toContain("2 kg");
	});

	it("kumulatif: jumlah semua skor", () => {
		const { container } = render(LeaderboardBoard, {
			competition: comp("kumulatif"),
			rows: [
				row("a", "Amin", {
					weight: 1000,
					fishWeightGram: 1000,
					isJackpot: false,
				}),
				row("a", "Amin", {
					weight: 2500,
					fishWeightGram: 2500,
					isJackpot: false,
					receivedAt: new Date("2026-08-17T09:00:00Z"),
				}),
				row("b", "Budi", {
					weight: 3000,
					fishWeightGram: 3000,
					isJackpot: false,
				}),
			],
		});
		const text = container.textContent ?? "";
		expect(text).toContain("3,5 kg");
		expect(text).toContain("2 skor");
		expect(text.indexOf("Amin")).toBeLessThan(text.indexOf("Budi"));
	});

	it("layangan aduan: hitung kemenangan (menang)", () => {
		const { container } = render(LeaderboardBoard, {
			competition: comp("layangan_aduan"),
			rows: [
				row("a", "Amin", { status: "menang" }),
				row("a", "Amin", {
					status: "menang",
					receivedAt: new Date("2026-08-17T09:00:00Z"),
				}),
				row("b", "Budi", { status: "putus" }),
			],
		});
		const text = container.textContent ?? "";
		expect(text).toContain("2 menang");
		expect(text.indexOf("Amin")).toBeLessThan(text.indexOf("Budi"));
	});

	it("hias: total berbobot + tie-break received_at", () => {
		const { container } = render(LeaderboardBoard, {
			competition: comp("layangan_hias"),
			rows: [
				row("a", "Amin", {
					aesthetic: 100,
					stability: 100,
					creativity: 100,
					total_weighted: 100,
					receivedAt: new Date("2026-08-17T10:00:00Z"),
				}),
				row("b", "Budi", {
					aesthetic: 100,
					stability: 100,
					creativity: 100,
					total_weighted: 100,
					receivedAt: new Date("2026-08-17T08:00:00Z"),
				}),
			],
		});
		const text = container.textContent ?? "";
		expect(text).toContain("100.0 poin");
		expect(text.indexOf("Budi")).toBeLessThan(text.indexOf("Amin"));
	});

	it("kosong: pesan belum ada skor", () => {
		const { container } = render(LeaderboardBoard, {
			competition: comp("terberat"),
			rows: [],
		});
		expect(container.textContent ?? "").toContain("Belum ada skor");
	});
});
