import { dev } from "$app/environment";
import {
	PUBLIC_ADMIN_PIN,
	PUBLIC_APP_NAME,
	PUBLIC_APP_YEAR,
	PUBLIC_BASE_URL,
	PUBLIC_ENABLE_DEMO_MODE,
	PUBLIC_EVENT_DATE,
	PUBLIC_JURI_PIN,
	PUBLIC_PANITIA_PIN,
	PUBLIC_SUPABASE_ANON_KEY,
	PUBLIC_SUPABASE_URL,
	PUBLIC_TERMS_URL,
} from "$env/static/public";

export const env = {
	baseUrl: PUBLIC_BASE_URL,
	appName: PUBLIC_APP_NAME,
	appYear: PUBLIC_APP_YEAR,
	eventDate: PUBLIC_EVENT_DATE,
	supabaseUrl: PUBLIC_SUPABASE_URL,
	supabaseAnonKey: PUBLIC_SUPABASE_ANON_KEY,
	juriPin: PUBLIC_JURI_PIN,
	panitiaPin: PUBLIC_PANITIA_PIN,
	adminPin: PUBLIC_ADMIN_PIN,
	enableDemoMode: PUBLIC_ENABLE_DEMO_MODE,
	termsUrl: PUBLIC_TERMS_URL,
} as const;

if (
	PUBLIC_EVENT_DATE.length > 0 &&
	Number.isNaN(Date.parse(PUBLIC_EVENT_DATE))
) {
	throw new Error(
		`PUBLIC_EVENT_DATE harus ISO-8601 lengkap dengan offset (contoh: 2026-08-17T07:00:00+07:00), dapat: "${PUBLIC_EVENT_DATE}"`,
	);
}

if (!dev && PUBLIC_BASE_URL.length === 0) {
	console.warn(
		"[env] PUBLIC_BASE_URL kosong — QR e-tiket dan link wa.me akan salah. Isi di .env sebelum build rilis.",
	);
}

if (!dev && PUBLIC_ENABLE_DEMO_MODE === "true") {
	console.warn(
		"[env] PUBLIC_ENABLE_DEMO_MODE=true pada build non-dev — registrasi/pembayaran/skor hanya tersimpan lokal per perangkat dan TIDAK masuk Supabase. Set false untuk produksi (QW-3/A41/F23).",
	);
}

// B4-5/A37: cegah fallback senyap ke DEMO_PIN di produksi.
if (!dev && (PUBLIC_ADMIN_PIN || PUBLIC_PANITIA_PIN || PUBLIC_JURI_PIN)) {
	if (!PUBLIC_ADMIN_PIN || !PUBLIC_PANITIA_PIN || !PUBLIC_JURI_PIN) {
		console.warn(
			"[env] Ada PIN peran yang kosong pada build non-dev — peran itu akan jatuh ke DEMO_PIN default. Isi semua PUBLIC_*_PIN untuk produksi (A37).",
		);
	}
}
