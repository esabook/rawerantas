import { get, writable } from "svelte/store";
import { env } from "$lib/env";

export const demoMode = writable(env.enableDemoMode === "true");

export async function teardownRealtime(): Promise<void> {
	if (env.supabaseUrl.length === 0 || env.supabaseAnonKey.length === 0) {
		return;
	}
	const { supabase } = await import("../db/supabaseClient");
	supabase.removeAllChannels();
}

export async function setDemoMode(enabled: boolean): Promise<void> {
	if (get(demoMode) !== enabled) {
		demoMode.set(enabled);
		await teardownRealtime();
	}
}

export async function toggleDemoMode(): Promise<void> {
	await setDemoMode(!get(demoMode));
}
