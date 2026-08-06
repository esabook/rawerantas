import { get, writable } from "svelte/store";
import { supabase } from "$lib/db/supabaseClient";
import { env } from "$lib/env";

export const demoMode = writable(env.enableDemoMode === "true");

export function teardownRealtime(): void {
	supabase.removeAllChannels();
}

export function setDemoMode(enabled: boolean): void {
	if (get(demoMode) !== enabled) {
		demoMode.set(enabled);
		teardownRealtime();
	}
}

export function toggleDemoMode(): void {
	setDemoMode(!get(demoMode));
}
