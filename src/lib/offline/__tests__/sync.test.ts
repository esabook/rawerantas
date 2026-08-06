import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearQueue, countByStatus, enqueue } from "../queue";
import {
	applyTombstones,
	checkDraftRestore,
	type ExecuteOp,
	runSyncOnce,
	type ScoreRowLite,
} from "../sync";

describe("runSyncOnce", () => {
	beforeEach(async () => {
		await clearQueue();
	});

	const seeded = async (keys: string[]) => {
		for (const [i, key] of keys.entries()) {
			await enqueue(key, "/rest/v1/scores", { w: i }, i);
		}
	};

	it("ok & conflict → synced; error → failed; urutan FIFO dipertahankan", async () => {
		await seeded(["a", "b", "c"]);
		const order: string[] = [];
		const execute = vi.fn<ExecuteOp>(async (entry) => {
			order.push(entry.idempotencyKey);
			return entry.idempotencyKey === "c" ? "error" : "ok";
		});

		const outcome = await runSyncOnce(execute);

		expect(order).toEqual(["a", "b", "c"]);
		expect(outcome).toEqual({ synced: 2, failed: 1, dead: 0 });
		expect(await countByStatus("synced")).toBe(2);
		expect(await countByStatus("pending")).toBe(1);
	});

	it("conflict (ON CONFLICT DO NOTHING) dihitung sukses, bukan retry", async () => {
		await seeded(["a"]);
		const execute = vi.fn<ExecuteOp>(async () => "conflict");
		const outcome = await runSyncOnce(execute);
		expect(outcome.synced).toBe(1);
		expect(await countByStatus("synced")).toBe(1);
	});

	it("submit ganda: entry kedua tak pernah dijalankan lagi setelah synced", async () => {
		await seeded(["a"]);
		const execute = vi.fn<ExecuteOp>(async () => "ok");
		await runSyncOnce(execute);
		expect(execute).toHaveBeenCalledTimes(1);
		await runSyncOnce(execute);
		expect(execute).toHaveBeenCalledTimes(1);
	});

	it("exception satu op tidak memblokir op berikutnya (isolasi)", async () => {
		await seeded(["a", "b"]);
		const execute = vi.fn<ExecuteOp>(async (entry) => {
			if (entry.idempotencyKey === "a") {
				throw new Error("network down");
			}
			return "ok";
		});
		const outcome = await runSyncOnce(execute);
		expect(outcome).toEqual({ synced: 1, failed: 1, dead: 0 });
		expect(await countByStatus("synced")).toBe(1);
		expect(await countByStatus("pending")).toBe(1);
	});

	it("dead setelah retries cap", async () => {
		await seeded(["a"]);
		const execute = vi.fn<ExecuteOp>(async () => "error");
		for (let i = 0; i < 10; i += 1) {
			await runSyncOnce(execute);
		}
		expect(await countByStatus("dead")).toBe(1);
		expect(await countByStatus("pending")).toBe(0);
	});
});

describe("applyTombstones (undo-after-sync)", () => {
	it("hapus skor tombstone + recompute running_total benar", () => {
		const rows: ScoreRowLite[] = [
			{
				id: "s1",
				participantId: "A",
				weight: 5,
				receivedAt: 1,
				runningTotal: 5,
			},
			{
				id: "s2",
				participantId: "A",
				weight: 3,
				receivedAt: 2,
				runningTotal: 8,
			},
			{
				id: "s3",
				participantId: "A",
				weight: 7,
				receivedAt: 3,
				runningTotal: 15,
			},
			{
				id: "s4",
				participantId: "B",
				weight: 10,
				receivedAt: 2,
				runningTotal: 10,
			},
		];
		const result = applyTombstones(rows, [
			{ targetId: "s2", participantId: "A", weightRemoved: 3 },
		]);
		const a = result.filter((r) => r.participantId === "A");
		expect(a.map((r) => r.id)).toEqual(["s1", "s3"]);
		expect(a.map((r) => r.runningTotal)).toEqual([5, 12]);
		expect(result.filter((r) => r.participantId === "B")[0].runningTotal).toBe(
			10,
		);
	});

	it("tombstone tak dikenal → tidak mengubah apa pun", () => {
		const rows: ScoreRowLite[] = [
			{
				id: "s1",
				participantId: "A",
				weight: 5,
				receivedAt: 1,
				runningTotal: 5,
			},
		];
		const result = applyTombstones(rows, [
			{ targetId: "ghost", participantId: "A", weightRemoved: 5 },
		]);
		expect(result).toHaveLength(1);
		expect(result[0].runningTotal).toBe(5);
	});
});

describe("checkDraftRestore", () => {
	it("ticket sudah ada utk phone → true (jangan submit ulang)", async () => {
		const entry = {
			idempotencyKey: "k1",
			endpoint: "/rest/v1/participants",
			payload: { phone: "6281234567890" },
			timestamp: 1,
			retries: 0,
			status: "pending" as const,
		};
		const lookup = vi.fn(async () => ({
			exists: true,
			ticketNumber: "RA-001",
		}));
		expect(await checkDraftRestore(entry, lookup)).toBe(true);
		expect(lookup).toHaveBeenCalledWith("6281234567890");
	});

	it("phone tidak ada / bukan string → false tanpa lookup", async () => {
		const lookup = vi.fn(async () => ({ exists: false, ticketNumber: null }));
		expect(
			await checkDraftRestore(
				{
					idempotencyKey: "k",
					endpoint: "/x",
					payload: {},
					timestamp: 1,
					retries: 0,
					status: "pending",
				},
				lookup,
			),
		).toBe(false);
		expect(lookup).not.toHaveBeenCalled();
	});
});
