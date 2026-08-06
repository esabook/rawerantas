import { get } from "svelte/store";
import { demoCompetitions, demoPaymentConfigs } from "$lib/demo/generator";
import { demoMode } from "$lib/demo/store";
import { DB_VERSION, ensureAllStores } from "$lib/offline/idbSchema";
import type { Competition, PaymentConfig } from "./queries";

const DB_NAME = "rawerantas";
const COMP_STORE = "demo_competitions";
const CONFIG_STORE = "demo_payment_configs";

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

async function getAll<T>(store: string): Promise<T[]> {
	const db = await getDb();
	return new Promise((resolve, reject) => {
		const req = db.transaction(store).objectStore(store).getAll();
		req.onsuccess = () => resolve((req.result as T[]) ?? []);
		req.onerror = () => reject(req.error);
	});
}

async function put(store: string, value: unknown): Promise<void> {
	const db = await getDb();
	const plain = JSON.parse(JSON.stringify(value));
	await new Promise<void>((resolve, reject) => {
		const tx = db.transaction(store, "readwrite");
		tx.objectStore(store).put(plain);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
}

/** Override kompetisi dari penyimpanan lokal admin (demo). */
export async function getLocalCompetitions(): Promise<
	Map<string, Competition>
> {
	const rows = await getAll<Competition>(COMP_STORE);
	return new Map(rows.map((c) => [c.id, c]));
}

export async function getLocalPaymentConfigs(): Promise<
	Map<string, PaymentConfig>
> {
	const rows = await getAll<PaymentConfig>(CONFIG_STORE);
	return new Map(rows.map((c) => [c.id, c]));
}

/** Gabungan seed + override lokal — dipakai admin DAN panel lain (round advance harus terlihat juri). */
export async function getMergedCompetitions(
	activeOnly = true,
): Promise<Competition[]> {
	const [local, seed] = await Promise.all([
		getLocalCompetitions(),
		Promise.resolve(demoCompetitions()),
	]);
	const merged = seed.map((c) => local.get(c.id) ?? c);
	const localOnly = seed.length ? [] : [...local.values()];
	const all = [...localOnly, ...merged];
	return activeOnly ? all.filter((c) => c.isActive) : all;
}

export async function getMergedPaymentConfigs(
	activeOnly = true,
): Promise<PaymentConfig[]> {
	const [local, seed] = await Promise.all([
		getLocalPaymentConfigs(),
		Promise.resolve(demoPaymentConfigs()),
	]);
	const merged = seed.map((c) => local.get(c.id) ?? c);
	const localOnly = seed.length ? [] : [...local.values()];
	const all = [...localOnly, ...merged];
	return activeOnly ? all.filter((c) => c.isActive) : all;
}

export async function saveCompetitionLocal(
	competition: Competition,
): Promise<void> {
	if (get(demoMode)) {
		await put(COMP_STORE, competition);
		return;
	}
	const { supabase } = await import("./supabaseClient");
	const { error } = await supabase
		.from("competitions")
		.update({
			name: competition.name,
			fee: competition.fee,
			total_quota: competition.totalQuota,
			scoring_mode: competition.scoringMode,
			is_active: competition.isActive,
			current_round: competition.currentRound,
		})
		.eq("id", competition.id);
	if (error) {
		throw new Error(`saveCompetitionLocal: ${error.message}`);
	}
}

export async function savePaymentConfigLocal(
	config: PaymentConfig,
): Promise<void> {
	if (get(demoMode)) {
		await put(CONFIG_STORE, config);
		return;
	}
	const { supabase } = await import("./supabaseClient");
	const { error } = await supabase
		.from("payment_configs")
		.update({
			account_name: config.accountName,
			account_number: config.accountNumber,
			qris_image_url: config.qrisImageUrl,
			instructions: config.instructions,
			is_active: config.isActive,
		})
		.eq("id", config.id);
	if (error) {
		throw new Error(`savePaymentConfigLocal: ${error.message}`);
	}
}

/**
 * Advance round: hanya untuk mode `layangan_aduan`. Board layangan reset
 * otomatis karena panel juri membaca `current_round` kompetisi.
 */
export async function advanceRound(
	competitionId: string,
): Promise<{ ok: boolean; round: number }> {
	const merged = await getMergedCompetitions(false);
	const competition = merged.find((c) => c.id === competitionId);
	if (!competition) {
		throw new Error("Kompetisi tidak ditemukan.");
	}
	if (competition.scoringMode !== "layangan_aduan") {
		throw new Error("Advance round hanya untuk mode aduan layangan.");
	}
	const next = {
		...competition,
		currentRound: competition.currentRound + 1,
	};
	await saveCompetitionLocal(next);
	return { ok: true, round: next.currentRound };
}

export async function resetDemoAdminState(): Promise<void> {
	const db = await getDb();
	await new Promise<void>((resolve, reject) => {
		const tx = db.transaction([COMP_STORE, CONFIG_STORE], "readwrite");
		tx.objectStore(COMP_STORE).clear();
		tx.objectStore(CONFIG_STORE).clear();
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
}
