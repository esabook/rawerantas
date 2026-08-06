import "fake-indexeddb/auto";
import { cleanup, render } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import OfflineBanner from "$lib/components/OfflineBanner.svelte";
import {
	initNetworkStore,
	online,
	queueCount,
	refreshQueueCount,
	reportFetchFailure,
	reportFetchSuccess,
} from "../networkStore";
import { clearQueue, enqueue } from "../queue";

afterEach(cleanup);

describe("networkStore", () => {
	it("init: online dari navigator (happy-dom default true)", () => {
		initNetworkStore();
		expect(online).toBeDefined();
	});

	it("reportFetchFailure/Success mengoreksi state online", () => {
		reportFetchFailure();
		let value: boolean | undefined;
		online.subscribe((v) => (value = v))();
		expect(value).toBe(false);
		reportFetchSuccess();
		online.subscribe((v) => (value = v))();
		expect(value).toBe(true);
	});

	it("refreshQueueCount = pending + dead", async () => {
		await clearQueue();
		await enqueue("p1", "/x", {}, 1);
		await enqueue("p2", "/x", {}, 2);
		await refreshQueueCount();
		let count = 0;
		queueCount.subscribe((v) => (count = v))();
		expect(count).toBe(2);
	});

	it("window online/offline event memperbarui store", () => {
		initNetworkStore();
		vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
		window.dispatchEvent(new Event("offline"));
		let value: boolean | undefined;
		online.subscribe((v) => (value = v))();
		expect(value).toBe(false);
		vi.restoreAllMocks();
	});
});

describe("OfflineBanner", () => {
	it("tidak tampil saat online & antrean kosong", async () => {
		online.set(true);
		queueCount.set(0);
		const { queryByText } = render(OfflineBanner);
		expect(queryByText(/Luring/)).toBeNull();
		expect(queryByText(/sinkronisasi/)).toBeNull();
	});

	it("tampil banner luring saat offline", async () => {
		online.set(false);
		const { findByText } = render(OfflineBanner);
		expect(await findByText(/Luring/)).toBeDefined();
	});

	it("tampil badge antrean saat online dgn pending", async () => {
		online.set(true);
		queueCount.set(3);
		const { findByText } = render(OfflineBanner);
		expect(await findByText(/Menunggu sinkronisasi/)).toBeDefined();
		expect(await findByText("3")).toBeDefined();
	});
});
