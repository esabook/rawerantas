import { primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Penyimpanan lokal demo/offline perangkat — pengganti IndexedDB untuk
 * runtime node (server/SSR/tests). Semantik identik dengan object store
 * idb: key-value per store, value disimpan sebagai JSON (round-trip
 * `JSON.parse(JSON.stringify(...))` sama persis dengan perilaku idb).
 *
 * Browser tetap memakai IndexedDB (lihat `localStore.ts`) karena
 * `node:sqlite` tidak tersedia di JS engine browser.
 */
export const localKv = sqliteTable(
	"local_kv",
	{
		store: text("store").notNull(),
		key: text("key").notNull(),
		value: text("value").notNull(),
	},
	(table) => [primaryKey({ columns: [table.store, table.key] })],
);

export type LocalKvRow = typeof localKv.$inferSelect;
