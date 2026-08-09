import { describe, expect, it } from "vitest";
import { calculateHiasTotal, computeRanking, type ScoreRow } from "../engine";

const row = (
	overrides: Partial<ScoreRow> & { id: string; receivedAt: string },
): ScoreRow => ({
	participantId: null,
	lapakNumber: null,
	weight: null,
	runningTotal: null,
	isJackpot: false,
	aesthetic: null,
	stability: null,
	creativity: null,
	totalWeighted: null,
	status: null,
	...overrides,
});

describe("engine — kumulatif", () => {
	it("menjumlahkan berat per peserta", () => {
		const rows = [
			row({
				id: "a1",
				participantId: "A",
				weight: 5,
				receivedAt: "2026-08-01T10:00:00Z",
			}),
			row({
				id: "a2",
				participantId: "A",
				weight: 3,
				receivedAt: "2026-08-01T10:02:00Z",
			}),
			row({
				id: "b1",
				participantId: "B",
				weight: 4,
				receivedAt: "2026-08-01T10:01:00Z",
			}),
			row({
				id: "b2",
				participantId: "B",
				weight: 4,
				receivedAt: "2026-08-01T10:03:00Z",
			}),
		];
		const ranking = computeRanking(rows, "kumulatif");
		expect(ranking[0].key).toBe("A");
		expect(ranking[0].score).toBe(8);
		expect(ranking[1].key).toBe("B");
		expect(ranking[1].score).toBe(8);
	});
});

describe("engine — terberat", () => {
	it("skor = berat maksimum; tie-break received_at ASC (capai skor lebih dulu)", () => {
		const rows = [
			row({
				id: "a1",
				participantId: "A",
				weight: 5,
				receivedAt: "2026-08-01T10:00:00Z",
			}),
			row({
				id: "a2",
				participantId: "A",
				weight: 7,
				receivedAt: "2026-08-01T10:03:00Z",
			}),
			row({
				id: "b1",
				participantId: "B",
				weight: 7,
				receivedAt: "2026-08-01T10:02:00Z",
			}),
		];
		const ranking = computeRanking(rows, "terberat");
		expect(ranking[0].key).toBe("B");
		expect(ranking[0].score).toBe(7);
		expect(ranking[1].key).toBe("A");
		expect(ranking[1].score).toBe(7);
	});
});

describe("engine — jackpot_pita", () => {
	it("jackpot dirangking oleh berat (bukan otomatis #1); subScore menandai jackpot (A4)", () => {
		const rows = [
			row({
				id: "a1",
				participantId: "A",
				weight: 5,
				isJackpot: true,
				receivedAt: "2026-08-01T10:00:00Z",
			}),
			row({
				id: "b1",
				participantId: "B",
				weight: 8,
				receivedAt: "2026-08-01T10:01:00Z",
			}),
		];
		const ranking = computeRanking(rows, "jackpot_pita");
		// B lebih berat → #1; A (jackpot) #2, ditandai subScore=1.
		expect(ranking[0].key).toBe("B");
		expect(ranking[0].score).toBe(8);
		expect(ranking[1].key).toBe("A");
		expect(ranking[1].score).toBe(5);
		expect(ranking[1].subScore).toBe(1);
	});

	it("tanpa jackpot: berat terbesar, tie-break received_at", () => {
		const rows = [
			row({
				id: "a1",
				participantId: "A",
				weight: 5,
				receivedAt: "2026-08-01T10:00:00Z",
			}),
			row({
				id: "b1",
				participantId: "B",
				weight: 5,
				receivedAt: "2026-08-01T10:01:00Z",
			}),
		];
		const ranking = computeRanking(rows, "jackpot_pita");
		expect(ranking[0].key).toBe("A");
		expect(ranking[1].key).toBe("B");
	});
});

describe("engine — layangan_hias", () => {
	it("total_weighted = a*0.4 + s*0.4 + k*0.2; skor terbaik per peserta", () => {
		expect(calculateHiasTotal(100, 50, 0)).toBe(60);
		expect(calculateHiasTotal(50, 50, 50)).toBe(50);
		const rows = [
			row({
				id: "a1",
				participantId: "A",
				aesthetic: 100,
				stability: 50,
				creativity: 0,
				receivedAt: "2026-08-01T10:00:00Z",
			}),
			row({
				id: "a2",
				participantId: "A",
				aesthetic: 50,
				stability: 50,
				creativity: 50,
				receivedAt: "2026-08-01T10:02:00Z",
			}),
			row({
				id: "b1",
				participantId: "B",
				aesthetic: 50,
				stability: 50,
				creativity: 50,
				receivedAt: "2026-08-01T10:01:00Z",
			}),
		];
		const ranking = computeRanking(rows, "layangan_hias");
		expect(ranking[0].key).toBe("A");
		expect(ranking[0].score).toBe(60);
		expect(ranking[1].key).toBe("B");
		expect(ranking[1].score).toBe(50);
	});

	it("memakai totalWeighted dari DB bila ada", () => {
		const rows = [
			row({
				id: "a1",
				participantId: "A",
				totalWeighted: 99,
				aesthetic: 0,
				stability: 0,
				creativity: 0,
				receivedAt: "2026-08-01T10:00:00Z",
			}),
		];
		const ranking = computeRanking(rows, "layangan_hias");
		expect(ranking[0].score).toBe(99);
	});
});

describe("engine — layangan_aduan", () => {
	it("skor = jumlah menang", () => {
		const rows = [
			row({
				id: "a1",
				participantId: "A",
				status: "menang",
				receivedAt: "2026-08-01T10:00:00Z",
			}),
			row({
				id: "a2",
				participantId: "A",
				status: "menang",
				receivedAt: "2026-08-01T10:01:00Z",
			}),
			row({
				id: "a3",
				participantId: "A",
				status: "mudun",
				receivedAt: "2026-08-01T10:02:00Z",
			}),
			row({
				id: "b1",
				participantId: "B",
				status: "menang",
				receivedAt: "2026-08-01T10:03:00Z",
			}),
		];
		const ranking = computeRanking(rows, "layangan_aduan");
		expect(ranking[0].key).toBe("A");
		expect(ranking[0].score).toBe(2);
		expect(ranking[1].key).toBe("B");
		expect(ranking[1].score).toBe(1);
	});
});

describe("engine — clock-skew & determinisme", () => {
	it("input received_at tidak berurutan → hasil sama dgn input terurut", () => {
		const shuffled = [
			row({
				id: "b1",
				participantId: "B",
				weight: 5,
				receivedAt: "2026-08-01T10:05:00Z",
			}),
			row({
				id: "a1",
				participantId: "A",
				weight: 9,
				receivedAt: "2026-08-01T10:01:00Z",
			}),
			row({
				id: "c1",
				participantId: "C",
				weight: 7,
				receivedAt: "2026-08-01T10:03:00Z",
			}),
		];
		const sorted = [...shuffled].sort(
			(a, b) =>
				new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime(),
		);
		const fromShuffled = computeRanking(shuffled, "terberat").map((r) => r.key);
		const fromSorted = computeRanking(sorted, "terberat").map((r) => r.key);
		expect(fromShuffled).toEqual(fromSorted);
		expect(fromShuffled).toEqual(["A", "C", "B"]);
	});

	it("tie penuh → urutan deterministik (key asc)", () => {
		const rows = [
			row({
				id: "b1",
				participantId: "B",
				weight: 4,
				receivedAt: "2026-08-01T10:00:00Z",
			}),
			row({
				id: "a1",
				participantId: "A",
				weight: 4,
				receivedAt: "2026-08-01T10:00:00Z",
			}),
		];
		const ranking = computeRanking(rows, "terberat");
		expect(ranking.map((r) => r.key)).toEqual(["A", "B"]);
	});
});
