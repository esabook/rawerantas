import Database from "better-sqlite3";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { drizzle as drizzleBetterSqlite3 } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./localSchema";

export { localKv } from "./localSchema";

export type LocalDb = BetterSQLite3Database<typeof schema>;

let dbPromise: Promise<LocalDb> | null = null;

/**
 * Koneksi drizzle lokal (mode sqlite) untuk runtime node (server/tests).
 * Browser tidak pernah mengimpor modul ini (lihat `localStore.ts`).
 * File `:memory:` → database fresh per proses (cocok untuk test).
 */
export function getLocalDb(): Promise<LocalDb> {
	dbPromise ??= createLocalDb();
	return dbPromise;
}

export async function createLocalDb(file = ":memory:"): Promise<LocalDb> {
	const driver = new Database(file);
	migrate(drizzleBetterSqlite3(driver, { schema }), {
		migrationsFolder: "drizzle",
	});
	return drizzleBetterSqlite3(driver, { schema });
}

export async function resetLocalDb(): Promise<void> {
	const db = await getLocalDb();
	await db.delete(schema.localKv);
}
