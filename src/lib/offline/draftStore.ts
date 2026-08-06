export interface RegistrationDraft {
	name: string;
	phone: string;
	competitionId: string;
	payment: "dp" | "full";
	savedAt: number;
}

const KEY = "rawerantas:registration-draft";

export function saveDraft(draft: RegistrationDraft): void {
	try {
		localStorage.setItem(KEY, JSON.stringify(draft));
	} catch {
		// storage penuh/tak tersedia — abaikan, draft opsional
	}
}

export function loadDraft(): RegistrationDraft | null {
	try {
		const raw = localStorage.getItem(KEY);
		if (!raw) {
			return null;
		}
		const parsed = JSON.parse(raw) as RegistrationDraft;
		if (typeof parsed.name !== "string" || typeof parsed.phone !== "string") {
			return null;
		}
		return parsed;
	} catch {
		return null;
	}
}

export function clearDraft(): void {
	try {
		localStorage.removeItem(KEY);
	} catch {
		// abaikan
	}
}
