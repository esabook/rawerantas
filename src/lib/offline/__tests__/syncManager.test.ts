import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";

const runSyncOnce = vi.fn(async () => ({ synced: 0, failed: 0, dead: 0 }));
vi.mock("../sync", () => ({ runSyncOnce: () => runSyncOnce() }));
vi.mock("../executor", () => ({ executeQueueEntry: vi.fn() }));

const { initNetworkStore } = await import("../networkStore");

describe("syncManager wiring (R9-02)", () => {
	afterEach(() => {
		runSyncOnce.mockReset();
		runSyncOnce.mockImplementation(async () => ({
			synced: 0,
			failed: 0,
			dead: 0,
		}));
		vi.restoreAllMocks();
	});

	it("event 'online' memicu drain, in-flight guard cegah overlap, lalu reset setelah selesai", async () => {
		let resolveFirst: (() => void) | undefined;
		runSyncOnce.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					resolveFirst = () => resolve({ synced: 0, failed: 0, dead: 0 });
				}),
		);
		vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);

		initNetworkStore();
		window.dispatchEvent(new Event("online"));
		await vi.waitFor(() => expect(runSyncOnce).toHaveBeenCalledTimes(1));

		// drain pertama masih in-flight (belum di-resolve) — dispatch kedua tak boleh overlap.
		window.dispatchEvent(new Event("online"));
		expect(runSyncOnce).toHaveBeenCalledTimes(1);

		resolveFirst?.();
		await vi.waitFor(() => Promise.resolve());

		// setelah drain pertama selesai, guard lepas — dispatch berikutnya memicu drain baru.
		window.dispatchEvent(new Event("online"));
		await vi.waitFor(() => expect(runSyncOnce).toHaveBeenCalledTimes(2));
	});
});
