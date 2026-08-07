import { get } from "svelte/store";
import { demoCompetitions, demoPaymentConfigs } from "$lib/demo/generator";
import { demoMode } from "$lib/demo/store";
import { localClear, localGetAll, localPut, localStores } from "./localStore";
import type { Competition, PaymentConfig } from "./queries";

const COMP_STORE = localStores.competitions;
const CONFIG_STORE = localStores.paymentConfigs;

/** Override kompetisi dari penyimpanan lokal admin (demo). */
export async function getLocalCompetitions(): Promise<
	Map<string, Competition>
> {
	const rows = await localGetAll<Competition>(COMP_STORE);
	return new Map(rows.map((c) => [c.id, c]));
}

export async function getLocalPaymentConfigs(): Promise<
	Map<string, PaymentConfig>
> {
	const rows = await localGetAll<PaymentConfig>(CONFIG_STORE);
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
	return activeOnly ? merged.filter((c) => c.isActive) : merged;
}

export async function getMergedPaymentConfigs(
	activeOnly = true,
): Promise<PaymentConfig[]> {
	const [local, seed] = await Promise.all([
		getLocalPaymentConfigs(),
		Promise.resolve(demoPaymentConfigs()),
	]);
	const merged = seed.map((c) => local.get(c.id) ?? c);
	return activeOnly ? merged.filter((c) => c.isActive) : merged;
}

export async function saveCompetition(competition: Competition): Promise<void> {
	if (get(demoMode)) {
		await localPut(COMP_STORE, competition);
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
		throw new Error(`saveCompetition: ${error.message}`);
	}
}

export async function savePaymentConfig(config: PaymentConfig): Promise<void> {
	if (get(demoMode)) {
		await localPut(CONFIG_STORE, config);
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
		throw new Error(`savePaymentConfig: ${error.message}`);
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
	await saveCompetition(next);
	return { ok: true, round: next.currentRound };
}

export async function resetDemoAdminState(): Promise<void> {
	await Promise.all([localClear(COMP_STORE), localClear(CONFIG_STORE)]);
}
