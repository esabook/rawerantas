import { createClient } from "@supabase/supabase-js";
import { env } from "$lib/env";

if (env.supabaseUrl.length === 0 || env.supabaseAnonKey.length === 0) {
	throw new Error(
		"[db] PUBLIC_SUPABASE_URL / PUBLIC_SUPABASE_ANON_KEY kosong — isi .env sebelum memakai Supabase.",
	);
}

export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey);

if (import.meta.hot) {
	import.meta.hot.dispose(() => {
		supabase.removeAllChannels();
	});
}
