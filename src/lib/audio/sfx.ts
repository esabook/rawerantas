import { get, writable } from "svelte/store";

const STORAGE_KEY = "rawerantas:sfx-enabled";

export const sfxEnabled = writable(true);

export function setSfxEnabled(value: boolean): void {
	sfxEnabled.set(value);
	try {
		localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
	} catch {
		// storage tak tersedia (private mode) — abaikan
	}
}

export function loadSfxPreference(): void {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw !== null) {
			sfxEnabled.set(raw !== "0");
		}
	} catch {
		// storage tak tersedia — pakai default
	}
}

let ctx: AudioContext | null = null;

function audioCtx(): AudioContext | null {
	if (typeof window === "undefined") {
		return null;
	}
	const AC =
		window.AudioContext ??
		(window as unknown as { webkitAudioContext?: typeof AudioContext })
			.webkitAudioContext;
	if (!AC) {
		return null;
	}
	if (!ctx) {
		ctx = new AC();
	}
	if (ctx.state === "suspended") {
		void ctx.resume();
	}
	return ctx;
}

interface ToneOptions {
	frequency: number;
	duration: number;
	volume?: number;
	delayMs?: number;
	type?: OscillatorType;
	slideTo?: number;
}

function tone({
	frequency,
	duration,
	volume = 0.08,
	delayMs = 0,
	type = "square",
	slideTo,
}: ToneOptions): void {
	const ac = audioCtx();
	if (!ac) {
		return;
	}
	const osc = ac.createOscillator();
	const gain = ac.createGain();
	const t0 = ac.currentTime + delayMs / 1000;
	osc.type = type;
	osc.frequency.setValueAtTime(frequency, t0);
	if (slideTo !== undefined) {
		osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + duration);
	}
	gain.gain.setValueAtTime(0.0001, t0);
	gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.008);
	gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
	osc.connect(gain).connect(ac.destination);
	osc.start(t0);
	osc.stop(t0 + duration + 0.02);
}

function isEnabled(): boolean {
	return get(sfxEnabled);
}

/** Klik sentuh singkat — tiap keypress numpad/button. */
function tap(): void {
	if (!isEnabled()) {
		return;
	}
	tone({ frequency: 880, duration: 0.045, volume: 0.06 });
}

/** Backspace / aksi batal — nada turun pendek. */
function backspace(): void {
	if (!isEnabled()) {
		return;
	}
	tone({ frequency: 620, duration: 0.05, volume: 0.06 });
}

/** Koin Mario — sukses menyimpan skor/pembayaran/PIN benar. */
function coin(): void {
	if (!isEnabled()) {
		return;
	}
	tone({ frequency: 987.77, duration: 0.07, volume: 0.09, type: "square" });
	tone({
		frequency: 1318.51,
		duration: 0.22,
		volume: 0.09,
		delayMs: 75,
		type: "square",
	});
}

/** Fanfare kemenangan — MUDUN, round advance, jackpot. */
function fanfare(): void {
	if (!isEnabled()) {
		return;
	}
	const notes = [523.25, 659.25, 783.99, 1046.5];
	notes.forEach((f, i) => {
		tone({ frequency: f, duration: 0.12, volume: 0.08, delayMs: i * 85 });
	});
}

/** Hasil tercatat (PUTUS) — dua nada turun, tegas tapi positif. */
function confirm(): void {
	if (!isEnabled()) {
		return;
	}
	tone({ frequency: 660, duration: 0.09, volume: 0.08 });
	tone({ frequency: 440, duration: 0.14, volume: 0.08, delayMs: 80 });
}

/** Kegagalan / ditolak — buzz rendah slide ke bawah. */
function error(): void {
	if (!isEnabled()) {
		return;
	}
	tone({
		frequency: 200,
		duration: 0.28,
		volume: 0.09,
		type: "sawtooth",
		slideTo: 110,
	});
	tone({ frequency: 100, duration: 0.28, volume: 0.07, delayMs: 30 });
}

/** Tick halus — slider hias. */
function slider(): void {
	if (!isEnabled()) {
		return;
	}
	tone({ frequency: 1245, duration: 0.025, volume: 0.03, type: "triangle" });
}

export const sfx = { tap, backspace, coin, fanfare, confirm, error, slider };

/** Getaran haptic (Android) — tak ada efek di iOS/desktop. */
export function vibrate(pattern: number | number[]): void {
	if (typeof navigator !== "undefined" && "vibrate" in navigator) {
		try {
			navigator.vibrate(pattern);
		} catch {
			// haptic tak didukung — abaikan
		}
	}
}
