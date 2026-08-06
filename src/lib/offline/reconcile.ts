import { type IDBPDatabase, openDB } from "idb";
import { DB_VERSION, ensureAllStores } from "./idbSchema";

export interface HighWaterRow {
	endpoint: string;
	lastReceivedAt: number;
	updatedAt: number;
}

interface ReconcileSchema {
	high_water: {
		key: string;
		value: HighWaterRow;
	};
}

const DB_NAME = "rawerantas";
const STORE = "high_water";

let dbPromise: Promise<IDBPDatabase<ReconcileSchema>> | null = null;

const getDb = (): Promise<IDBPDatabase<ReconcileSchema>> => {
	dbPromise ??= openDB<ReconcileSchema>(DB_NAME, DB_VERSION, {
		upgrade(db) {
			ensureAllStores(db);
			if (!db.objectStoreNames.contains(STORE)) {
				db.createObjectStore(STORE, { keyPath: "endpoint" });
			}
		},
	});
	return dbPromise;
};

export async function getHighWater(endpoint: string): Promise<number | null> {
	const db = await getDb();
	const row = await db.get(STORE, endpoint);
	return row?.lastReceivedAt ?? null;
}

export async function setHighWater(
	endpoint: string,
	receivedAt: number,
): Promise<void> {
	const db = await getDb();
	const tx = db.transaction(STORE, "readwrite");
	const existing = await tx.store.get(endpoint);
	if (existing && existing.lastReceivedAt >= receivedAt) {
		await tx.done;
		return;
	}
	await tx.store.put({
		endpoint,
		lastReceivedAt: receivedAt,
		updatedAt: Date.now(),
	});
	await tx.done;
}

export async function clearHighWater(endpoint?: string): Promise<void> {
	const db = await getDb();
	const tx = db.transaction(STORE, "readwrite");
	if (endpoint) {
		await tx.store.delete(endpoint);
	} else {
		await tx.store.clear();
	}
	await tx.done;
}

export interface DatedRow {
	receivedAt: number;
}

export function deltaSince<T extends DatedRow>(
	rows: T[],
	highWater: number | null,
): T[] {
	if (highWater === null) {
		return rows;
	}
	return rows.filter((row) => row.receivedAt > highWater);
}
