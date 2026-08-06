import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import {
	clearQueue,
	countByStatus,
	enqueue,
	markFailed,
	markSynced,
	peekBatch,
	RETRIES_CAP,
} from "../queue";

describe("sync_queue", () => {
	beforeEach(async () => {
		await clearQueue();
	});

	it("enqueue → peekBatch FIFO (timestamp asc)", async () => {
		await enqueue("a", "/api/scores", { w: 5 }, 1_000);
		await enqueue("b", "/api/scores", { w: 3 }, 2_000);
		await enqueue("c", "/api/scores", { w: 7 }, 3_000);

		const batch = await peekBatch();

		expect(batch.map((e) => e.idempotencyKey)).toEqual(["a", "b", "c"]);
		expect(batch.every((e) => e.status === "pending")).toBe(true);
	});

	it("lifecycle enqueue → synced menghilang dari antrean", async () => {
		await enqueue("a", "/api/scores", { w: 5 }, 1_000);
		await markSynced("a");

		const batch = await peekBatch();
		expect(batch).toHaveLength(0);
		expect(await countByStatus("synced")).toBe(1);
	});

	it("markSynced pada key yang belum pernah ada → aman (no-op)", async () => {
		await markSynced("ghost");
		expect(await countByStatus("synced")).toBe(0);
	});

	it("enqueue ulang key pending → 1 row, timestamp asli dipertahankan", async () => {
		await enqueue("a", "/api/scores", { w: 5 }, 1_000);
		await enqueue("a", "/api/scores", { w: 9 }, 9_000);

		const batch = await peekBatch();
		expect(batch).toHaveLength(1);
		expect(batch[0].idempotencyKey).toBe("a");
		expect(batch[0].payload).toEqual({ w: 9 });
		expect(batch[0].timestamp).toBe(1_000);
	});

	it("enqueue setelah synced → tetap synced (tidak re-pending)", async () => {
		await enqueue("a", "/api/scores", { w: 5 }, 1_000);
		await markSynced("a");
		await enqueue("a", "/api/scores", { w: 9 }, 9_000);

		expect(await countByStatus("synced")).toBe(1);
		expect(await countByStatus("pending")).toBe(0);
	});

	it("markFailed menambah retries; cap → dead", async () => {
		await enqueue("a", "/api/scores", { w: 5 }, 1_000);
		let status = "pending";
		for (let i = 0; i < RETRIES_CAP; i += 1) {
			status = await markFailed("a");
		}
		expect(status).toBe("dead");
		expect(await countByStatus("dead")).toBe(1);
		expect(await countByStatus("pending")).toBe(0);
	});

	it("peekBatch limit", async () => {
		for (let i = 0; i < 5; i += 1) {
			await enqueue(`k${i}`, "/api/scores", { i }, i);
		}
		const batch = await peekBatch(3);
		expect(batch).toHaveLength(3);
		expect(batch.map((e) => e.idempotencyKey)).toEqual(["k0", "k1", "k2"]);
	});
});
