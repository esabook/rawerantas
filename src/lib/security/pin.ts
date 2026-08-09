import { env } from "$lib/env";

const STORAGE_KEY = "rawerantas:pin-granted";
const MAX_ATTEMPTS = 5;
export const PIN_LENGTH = 6;

export { MAX_ATTEMPTS };

const LOCKOUT_MS = 30_000;
const SESSION_LIFETIME_MS = 12 * 60 * 60 * 1000;
export const DEMO_PIN = "123456";
export const STORAGE_LIFETIME = SESSION_LIFETIME_MS;

export type PinKind = "juri" | "panitia" | "admin";

export interface GrantInfo {
	kind: PinKind;
	at: number;
	officer?: string;
}

const textEncoder = new TextEncoder();

export async function sha256Hex(input: string): Promise<string> {
	const cryptoApi = globalThis.crypto as Crypto | undefined;
	if (!cryptoApi?.subtle) {
		throw new Error(
			"WebCrypto tidak tersedia di browser ini (butuh HTTPS/localhost).",
		);
	}
	const digest = await cryptoApi.subtle.digest(
		"SHA-256",
		textEncoder.encode(input),
	);
	return Array.from(new Uint8Array(digest))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

export function pinForKind(kind: PinKind): string {
	if (kind === "admin") return env.adminPin;
	if (kind === "panitia") return env.panitiaPin;
	return env.juriPin;
}

export function isValidPin(pin: string): boolean {
	return new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin);
}

export function demoPinHash(): Promise<string> {
	return sha256Hex(DEMO_PIN);
}

export function grantStorageKey(kind: PinKind): string {
	return `${STORAGE_KEY}:${kind}`;
}

export function readGrant(kind: PinKind): GrantInfo | null {
	if (typeof sessionStorage === "undefined") {
		return null;
	}
	const raw = sessionStorage.getItem(grantStorageKey(kind));
	if (!raw) {
		return null;
	}
	try {
		const parsed = JSON.parse(raw) as GrantInfo;
		if (parsed.kind !== kind || typeof parsed.at !== "number") {
			return null;
		}
		return parsed;
	} catch {
		return null;
	}
}

export function writeGrant(kind: PinKind, officer?: string): void {
	if (typeof sessionStorage === "undefined") {
		return;
	}
	const grant: GrantInfo = { kind, at: Date.now(), officer };
	sessionStorage.setItem(grantStorageKey(kind), JSON.stringify(grant));
}

/** B4-6/A14: nama/ID petugas yang tercatat di grant (utk recordedBy). */
export function readOfficer(kind: PinKind): string {
	const grant = readGrant(kind);
	return grant?.officer?.trim() ?? "";
}

export function clearGrant(kind: PinKind): void {
	if (typeof sessionStorage === "undefined") {
		return;
	}
	sessionStorage.removeItem(grantStorageKey(kind));
}

export function grantStillValid(grant: GrantInfo | null): boolean {
	if (!grant) {
		return false;
	}
	return Date.now() - grant.at < SESSION_LIFETIME_MS;
}

export class PinLockoutError extends Error {}

export interface PinState {
	attempts: number;
	lockedUntil: number;
}

export function pinStateFromStorage(kind: PinKind): PinState {
	if (typeof sessionStorage === "undefined") {
		return { attempts: 0, lockedUntil: 0 };
	}
	const raw = sessionStorage.getItem(`${STORAGE_KEY}:${kind}:lockout`);
	if (!raw) {
		return { attempts: 0, lockedUntil: 0 };
	}
	try {
		return JSON.parse(raw) as PinState;
	} catch {
		return { attempts: 0, lockedUntil: 0 };
	}
}

export function writePinState(kind: PinKind, state: PinState): void {
	if (typeof sessionStorage === "undefined") {
		return;
	}
	sessionStorage.setItem(
		`${STORAGE_KEY}:${kind}:lockout`,
		JSON.stringify(state),
	);
}

export async function isLockedOut(
	kind: PinKind,
): Promise<{ locked: boolean; remainingMs: number }> {
	const state = pinStateFromStorage(kind);
	const remainingMs = state.lockedUntil - Date.now();
	return { locked: remainingMs > 0, remainingMs: Math.max(0, remainingMs) };
}

export async function recordFailedAttempt(kind: PinKind): Promise<PinState> {
	const state = pinStateFromStorage(kind);
	const attempts = state.attempts + 1;
	let next: PinState = { attempts, lockedUntil: 0 };
	if (attempts >= MAX_ATTEMPTS) {
		next = { attempts: 0, lockedUntil: Date.now() + LOCKOUT_MS };
	}
	writePinState(kind, next);
	return next;
}

export async function verifyPin(
	kind: PinKind,
	pin: string,
	officer?: string,
): Promise<GrantInfo> {
	if (!isValidPin(pin)) {
		throw new Error(`PIN harus ${PIN_LENGTH} digit.`);
	}
	const { locked } = await isLockedOut(kind);
	if (locked) {
		throw new PinLockoutError(
			`Terlalu banyak percobaan. Coba lagi dalam 30 detik.`,
		);
	}
	const configured = pinForKind(kind);
	if (configured && !isValidPin(configured)) {
		throw new Error(`Konfigurasi PIN ${kind} harus ${PIN_LENGTH} digit.`);
	}
	const expectedHash = configured
		? await sha256Hex(configured)
		: await demoPinHash();
	if (!configured) {
		// B4-5/A37: fallback ke DEMO_PIN bukan diam-diam — peringatkan.
		console.warn(
			`[pin] PIN ${kind} tidak dikonfigurasi — memakai DEMO_PIN default. Set PUBLIC_${kind.toUpperCase()}_PIN untuk produksi.`,
		);
	}
	const actualHash = await sha256Hex(pin);
	if (actualHash !== expectedHash) {
		const next = await recordFailedAttempt(kind);
		if (next.lockedUntil > 0) {
			throw new PinLockoutError(`5× salah PIN. Kunci 30 detik.`);
		}
		throw new Error(`PIN salah (${next.attempts}/${MAX_ATTEMPTS}).`);
	}
	const grant: GrantInfo = { kind, at: Date.now(), officer };
	writePinState(kind, { attempts: 0, lockedUntil: 0 });
	writeGrant(kind, officer);
	return grant;
}
