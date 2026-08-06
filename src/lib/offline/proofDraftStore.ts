export interface ProofDraft {
	participantId: string;
	blob: Blob;
	name: string;
	savedAt: number;
}

import { DB_VERSION, ensureAllStores } from "./idbSchema";

const DB_NAME = "rawerantas";
const STORE = "proof_drafts";

let dbPromise: Promise<IDBDatabase> | null = null;

const getDb = (): Promise<IDBDatabase> => {
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

export async function saveProofDraft(draft: ProofDraft): Promise<void> {
	const db = await getDb();
	await new Promise<void>((resolve, reject) => {
		const tx = db.transaction(STORE, "readwrite");
		tx.objectStore(STORE).put(draft);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
}

export async function loadProofDraft(
	participantId: string,
): Promise<ProofDraft | null> {
	const db = await getDb();
	return new Promise((resolve, reject) => {
		const req = db.transaction(STORE).objectStore(STORE).get(participantId);
		req.onsuccess = () =>
			resolve((req.result as ProofDraft | undefined) ?? null);
		req.onerror = () => reject(req.error);
	});
}

export async function clearProofDraft(participantId: string): Promise<void> {
	const db = await getDb();
	await new Promise<void>((resolve, reject) => {
		const tx = db.transaction(STORE, "readwrite");
		tx.objectStore(STORE).delete(participantId);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
}
