import { and, eq } from "drizzle-orm";
import { DB_VERSION, ensureAllStores } from "$lib/offline/idbSchema";

type LocalDbModule = typeof import("./localDb");

/**
 * Penyimpanan lokal perangkat (mode demo / offline).
 *
 * Dua backend:
 * - **node runtime** (server, SSR, vitest): SQLite via Drizzle
 *   (`node:sqlite` — lihat `localDb.ts`). Pengujian db memakai database
 *   sqlite asli, bukan polyfill IndexedDB.
 * - **browser**: IndexedDB (store `rawerantas`) — `node:sqlite` tidak
 *   tersedia di JS engine browser.
 *
 * Semantik identik dengan object store idb: key-value per store; nilai
 * di-serialisasi JSON (round-trip sama seperti `JSON.parse(JSON.stringify)`
 * yang sebelumnya dipakai admin.ts sebelum `put`).
 */
export const useLocalSqlite =
	typeof window === "undefined" || import.meta.env.MODE === "test";

const DB_NAME = "rawerantas";

let dbPromise: Promise<IDBDatabase> | null = null;

const getIdb = (): Promise<IDBDatabase> => {
	dbPromise ??= new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, DB_VERSION);
		req.onupgradeneeded = () => {
			ensureAllStores(req.result);
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
	return dbPromise;
};

function keyOf(value: unknown): string {
	const v = value as { id?: unknown; participantId?: unknown };
	return typeof v.id === "string"
		? v.id
		: typeof v.participantId === "string"
			? v.participantId
			: String(v.id ?? v.participantId ?? "");
}

const sqlite = (): Promise<LocalDbModule> => import("./localDb");

async function sqliteGetAll<T>(store: string): Promise<T[]> {
	const { getLocalDb, localKv } = await sqlite();
	const db = await getLocalDb();
	const rows = await db
		.select({ value: localKv.value })
		.from(localKv)
		.where(eq(localKv.store, store));
	return rows.map((r) => JSON.parse(r.value) as T);
}

async function sqlitePut(store: string, value: unknown): Promise<void> {
	const { getLocalDb, localKv } = await sqlite();
	const db = await getLocalDb();
	const plain = JSON.parse(JSON.stringify(value));
	await db
		.insert(localKv)
		.values({ store, key: keyOf(plain), value: JSON.stringify(plain) })
		.onConflictDoUpdate({
			target: [localKv.store, localKv.key],
			set: { value: JSON.stringify(plain) },
		});
}

async function sqliteDelete(store: string, key: string): Promise<void> {
	const { getLocalDb, localKv } = await sqlite();
	const db = await getLocalDb();
	await db
		.delete(localKv)
		.where(and(eq(localKv.store, store), eq(localKv.key, key)));
}

async function sqliteClear(store: string): Promise<void> {
	const { getLocalDb, localKv } = await sqlite();
	const db = await getLocalDb();
	await db.delete(localKv).where(eq(localKv.store, store));
}

async function idbOp<T>(
	stores: string[],
	mode: IDBTransactionMode,
	run: (tx: IDBTransaction) => T,
): Promise<T> {
	const db = await getIdb();
	return new Promise<T>((resolve, reject) => {
		const tx = db.transaction(stores, mode);
		const result = run(tx);
		tx.oncomplete = () => resolve(result);
		tx.onerror = () => reject(tx.error);
		tx.onabort = () => reject(tx.error);
	});
}

async function idbGetAll<T>(store: string): Promise<T[]> {
	const db = await getIdb();
	return new Promise<T[]>((resolve, reject) => {
		const tx = db.transaction([store], "readonly");
		const req = tx.objectStore(store).getAll();
		let rows: T[] = [];
		req.onsuccess = () => {
			rows = req.result as T[];
		};
		req.onerror = () => reject(req.error);
		tx.oncomplete = () => resolve(rows);
		tx.onerror = () => reject(tx.error);
		tx.onabort = () => reject(tx.error);
	});
}

async function idbPut(store: string, value: unknown): Promise<void> {
	const plain = JSON.parse(JSON.stringify(value));
	await idbOp([store], "readwrite", (tx) => {
		tx.objectStore(store).put(plain);
	});
}

async function idbDelete(store: string, key: string): Promise<void> {
	await idbOp([store], "readwrite", (tx) => {
		tx.objectStore(store).delete(key);
	});
}

async function idbClear(store: string): Promise<void> {
	await idbOp([store], "readwrite", (tx) => {
		tx.objectStore(store).clear();
	});
}

export async function localGetAll<T>(store: string): Promise<T[]> {
	return useLocalSqlite ? sqliteGetAll<T>(store) : idbGetAll<T>(store);
}

export async function localPut(store: string, value: unknown): Promise<void> {
	return useLocalSqlite ? sqlitePut(store, value) : idbPut(store, value);
}

export async function localDelete(store: string, key: string): Promise<void> {
	return useLocalSqlite ? sqliteDelete(store, key) : idbDelete(store, key);
}

export async function localClear(store: string): Promise<void> {
	return useLocalSqlite ? sqliteClear(store) : idbClear(store);
}

export const localStores = {
	registrations: "demo_registrations",
	payments: "demo_payments",
	scoresMancing: "demo_scores_mancing",
	scoresLayangan: "demo_scores_layangan",
	scoresHias: "demo_scores_hias",
	checkins: "demo_checkins",
	competitions: "demo_competitions",
	paymentConfigs: "demo_payment_configs",
	sponsors: "demo_sponsors",
	auditLogs: "demo_audit_logs",
	dataLock: "demo_data_lock",
} as const;

/** Bersihkan semua store lokal demo (backend aktif). */
export async function resetLocalDemoState(): Promise<void> {
	if (useLocalSqlite) {
		const { resetLocalDb } = await sqlite();
		await resetLocalDb();
		return;
	}
	await idbOp([...new Set(Object.values(localStores))], "readwrite", (tx) => {
		for (const store of Object.values(localStores)) {
			tx.objectStore(store).clear();
		}
	});
}
