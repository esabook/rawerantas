interface StoreLike {
	objectStoreNames: { contains(name: string): boolean };
	createObjectStore(name: string, options?: { keyPath?: string }): unknown;
}

/**
 * Membuat semua store yang dipakai aplikasi. Dipanggil di upgrade handler
 * tiap module pembuka DB "rawerantas" — siapa pun yang membuka versi baru
 * pertama kali menghasilkan database lengkap, sehingga urutan inisialisasi
 * module tidak berpengaruh.
 */
export function ensureAllStores(db: StoreLike): void {
	if (!db.objectStoreNames.contains("demo_registrations")) {
		db.createObjectStore("demo_registrations", { keyPath: "id" });
	}
	if (!db.objectStoreNames.contains("demo_payments")) {
		db.createObjectStore("demo_payments", { keyPath: "id" });
	}
	if (!db.objectStoreNames.contains("proof_drafts")) {
		db.createObjectStore("proof_drafts", { keyPath: "participantId" });
	}
}

export const DB_VERSION = 4;
