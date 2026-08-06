import { writable } from "svelte/store";

const STORAGE_KEY = "rawerantas:tts-enabled";
export const MAX_QUEUE = 8;

export const ttsEnabled = writable<boolean>(false);
export const ttsSpeaking = writable<boolean>(false);
export const ttsAvailable = writable<boolean>(
	typeof window !== "undefined" && "speechSynthesis" in window,
);

const queue: string[] = [];
let speaking = false;
const idleCallbacks: (() => void)[] = [];
let cachedEnabled = false;
ttsEnabled.subscribe((v) => {
	cachedEnabled = v;
});

export function getSpeechSynthesis(): SpeechSynthesis | null {
	if (typeof window === "undefined" || !("speechSynthesis" in window)) {
		return null;
	}
	return window.speechSynthesis;
}

export function pickVoice(
	voices: SpeechSynthesisVoice[],
): SpeechSynthesisVoice | null {
	return (
		voices.find((v) => v.lang === "id-ID") ??
		voices.find((v) => v.lang.startsWith("id")) ??
		null
	);
}

export function unlockTts(): void {
	const synth = getSpeechSynthesis();
	if (!synth) {
		return;
	}
	synth.resume();
}

export function setTtsEnabled(enabled: boolean): void {
	ttsEnabled.set(enabled);
	if (enabled) {
		unlockTts();
	} else {
		clearQueue();
	}
	try {
		localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
	} catch {
		// storage tak tersedia — abaikan
	}
}

export function loadTtsPreference(): void {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw === "1") {
			ttsEnabled.set(true);
		}
	} catch {
		// abaikan
	}
}

export function clearQueue(): void {
	queue.length = 0;
}

export function announce(text: string): void {
	const synth = getSpeechSynthesis();
	if (!synth || !cachedEnabled) {
		return;
	}
	if (queue.length >= MAX_QUEUE) {
		queue.shift();
	}
	queue.push(text);
	void drainQueue();
}

function drainQueue(): void {
	const synth = getSpeechSynthesis();
	if (!synth || speaking || queue.length === 0) {
		return;
	}
	speaking = true;
	ttsSpeaking.set(true);
	const text = queue.shift() as string;
	const utterance = new SpeechSynthesisUtterance(text);
	utterance.lang = "id-ID";
	const voices = synth.getVoices();
	const voice = pickVoice(voices);
	if (voice) {
		utterance.voice = voice;
	}
	utterance.onend = () => {
		speaking = false;
		ttsSpeaking.set(false);
		const next = idleCallbacks.shift();
		next?.();
		void drainQueue();
	};
	utterance.onerror = (event) => {
		speaking = false;
		ttsSpeaking.set(false);
		if (event.error === "not-allowed" || event.error === "interrupted") {
			setTtsEnabled(false);
			queue.length = 0;
			return;
		}
		const next = idleCallbacks.shift();
		next?.();
		void drainQueue();
	};
	synth.speak(utterance);
}

export function waitForIdle(timeoutMs = 3000): Promise<void> {
	if (!speaking) {
		return Promise.resolve();
	}
	return new Promise((resolve) => {
		const timer = setTimeout(() => {
			const index = idleCallbacks.indexOf(handler);
			if (index !== -1) {
				idleCallbacks.splice(index, 1);
			}
			resolve();
		}, timeoutMs);
		const handler = () => {
			clearTimeout(timer);
			resolve();
		};
		idleCallbacks.push(handler);
	});
}
