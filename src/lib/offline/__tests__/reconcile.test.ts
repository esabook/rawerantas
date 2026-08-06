import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import {
	clearHighWater,
	deltaSince,
	getHighWater,
	setHighWater,
} from "../reconcile";

describe("high_water store", () => {
	beforeEach(async () => {
		await clearHighWater();
	});

	it("null sebelum ada data", async () => {
		expect(await getHighWater("/scores")).toBeNull();
	});

	it("set → get; nilai lebih rendah tidak menurunkan high water (monotonic)", async () => {
		await setHighWater("/scores", 500);
		expect(await getHighWater("/scores")).toBe(500);
		await setHighWater("/scores", 300);
		expect(await getHighWater("/scores")).toBe(500);
		await setHighWater("/scores", 900);
		expect(await getHighWater("/scores")).toBe(900);
	});

	it("per-endpoint terpisah", async () => {
		await setHighWater("/scores", 100);
		await setHighWater("/participants", 200);
		expect(await getHighWater("/scores")).toBe(100);
		expect(await getHighWater("/participants")).toBe(200);
	});
});

describe("deltaSince (re-sync hanya delta)", () => {
	const rows = (receivedAts: number[]) =>
		receivedAts.map((receivedAt, i) => ({ id: `r${i}`, receivedAt }));

	it("high water null → semua row", () => {
		const all = rows([10, 20, 30]);
		expect(deltaSince(all, null)).toHaveLength(3);
	});

	it("hanya row > high water, urutan input dipertahankan", () => {
		const all = rows([10, 20, 30, 40]);
		const delta = deltaSince(all, 20);
		expect(delta.map((r) => r.receivedAt)).toEqual([30, 40]);
	});

	it("tidak double-insert: setelah sync + set high water → delta kosong", async () => {
		const all = rows([100, 200, 300]);
		await setHighWater("/scores", 300);
		const secondRun = deltaSince(all, await getHighWater("/scores"));
		expect(secondRun).toHaveLength(0);
	});

	it("clock-skew: received_at tidak berurutan → delta tetap benar (max, bukan terakhir-dibaca)", async () => {
		const shuffled = rows([300, 100, 250]);
		await setHighWater("/scores", 300);
		const delta = deltaSince(shuffled, await getHighWater("/scores"));
		expect(delta).toHaveLength(0);
	});
});
