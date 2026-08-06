import { type IDBPDatabase, openDB } from "idb";

export type QueueStatus = "pending" | "syncing" | "synced" | "dead";

export interface QueueEntry {
	idempotencyKey: string;
	endpoint: string;
	payload: unknown;
	timestamp: number;
	retries: number;
	status: QueueStatus;
}

export const RETRIES_CAP = 10;
export const PEEK_BATCH_DEFAULT = 10;

interface QueueSchema {
	sync_queue: {
		key: string;
		value: QueueEntry;
		indexes: { by_status_ts: [QueueStatus, number] };
	};
}

const DB_NAME = "rawerantas";
const STORE = "sync_queue";
const INDEX = "by_status_ts";

let dbPromise: Promise<IDBPDatabase<QueueSchema>> | null = null;

const getDb = (): Promise<IDBPDatabase<QueueSchema>> => {
	dbPromise ??= openDB<QueueSchema>(DB_NAME, 1, {
		upgrade(db) {
			const store = db.createObjectStore(STORE, { keyPath: "idempotencyKey" });
			store.createIndex(INDEX, ["status", "timestamp"]);
		},
	});
	return dbPromise;
};

export async function enqueue(
	idempotencyKey: string,
	endpoint: string,
	payload: unknown,
	now: number = Date.now(),
): Promise<void> {
	const db = await getDb();
	const tx = db.transaction(STORE, "readwrite");
	const existing = await tx.store.get(idempotencyKey);
	if (existing && existing.status === "synced") {
		await tx.done;
		return;
	}
	const entry: QueueEntry = {
		idempotencyKey,
		endpoint,
		payload,
		timestamp: existing?.timestamp ?? now,
		retries: existing?.retries ?? 0,
		status: "pending",
	};
	await tx.store.put(entry);
	await tx.done;
}

export async function peekBatch(
	limit: number = PEEK_BATCH_DEFAULT,
): Promise<QueueEntry[]> {
	const db = await getDb();
	const entries = await db.getAllFromIndex(
		STORE,
		INDEX,
		IDBKeyRange.bound(["pending", -Infinity], ["pending", Infinity]),
	);
	return entries.slice(0, limit);
}

export async function markSynced(idempotencyKey: string): Promise<void> {
	const db = await getDb();
	const tx = db.transaction(STORE, "readwrite");
	const entry = await tx.store.get(idempotencyKey);
	if (entry && entry.status !== "synced") {
		await tx.store.put({ ...entry, status: "synced", retries: entry.retries });
	}
	await tx.done;
}

export async function markFailed(idempotencyKey: string): Promise<QueueStatus> {
	const db = await getDb();
	const tx = db.transaction(STORE, "readwrite");
	const entry = await tx.store.get(idempotencyKey);
	if (!entry) {
		await tx.done;
		return "pending";
	}
	const retries = entry.retries + 1;
	const status: QueueStatus = retries >= RETRIES_CAP ? "dead" : "pending";
	await tx.store.put({ ...entry, retries, status });
	await tx.done;
	return status;
}

export async function countByStatus(status: QueueStatus): Promise<number> {
	const db = await getDb();
	return db.countFromIndex(
		STORE,
		INDEX,
		IDBKeyRange.bound([status, -Infinity], [status, Infinity]),
	);
}

export async function clearQueue(): Promise<void> {
	const db = await getDb();
	const tx = db.transaction(STORE, "readwrite");
	await tx.store.clear();
	await tx.done;
}
