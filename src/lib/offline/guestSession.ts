export interface GuestSession {
	phone: string;
}

const STORAGE_KEY = "rawerantas.guest-session";

const isGuestSession = (value: unknown): value is GuestSession => {
	if (!value || typeof value !== "object") {
		return false;
	}
	const candidate = value as Partial<GuestSession>;
	return typeof candidate.phone === "string" && candidate.phone.length > 0;
};

export function loadGuestSession(): GuestSession | null {
	if (typeof localStorage === "undefined") {
		return null;
	}
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return null;
		const parsed: unknown = JSON.parse(raw);
		return isGuestSession(parsed) ? parsed : null;
	} catch {
		return null;
	}
}

export function saveGuestSession(session: GuestSession): void {
	if (typeof localStorage === "undefined") return;
	localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearGuestSession(): void {
	if (typeof localStorage === "undefined") return;
	localStorage.removeItem(STORAGE_KEY);
}
