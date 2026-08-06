import { cleanup, fireEvent, render, screen } from "@testing-library/svelte";
import { tick } from "svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SoundToggle from "$lib/components/SoundToggle.svelte";
import {
	announce,
	clearQueue,
	setTtsEnabled,
	ttsAvailable,
	ttsEnabled,
	ttsSpeaking,
	waitForIdle,
} from "../ttsAnnouncer";

class FakeSynthesis {
	spoken: string[] = [];
	cancelled = 0;
	onend: (() => void) | null = null;
	onerror: ((e: { error: string }) => void) | null = null;
	voices: SpeechSynthesisVoice[] = [];

	constructor() {
		this.voices = [
			{
				lang: "id-ID",
				name: "Ida",
				localService: true,
				default: false,
				voiceURI: "ida",
			},
			{
				lang: "en-US",
				name: "Zira",
				localService: true,
				default: true,
				voiceURI: "zira",
			},
		] as SpeechSynthesisVoice[];
	}

	speak(utterance: SpeechSynthesisUtterance): void {
		this.spoken.push(utterance.text);
		this.onend = utterance.onend as (() => void) | null;
		this.onerror = utterance.onerror as ((e: { error: string }) => void) | null;
		Object.defineProperty(utterance, "voice", { value: this.voices[0] });
	}

	finish(): void {
		this.onend?.();
	}

	fail(error: string): void {
		this.onerror?.({ error } as SpeechSynthesisErrorEvent);
	}

	resume(): void {}
	cancel(): void {
		this.cancelled++;
	}
	getVoices(): SpeechSynthesisVoice[] {
		return this.voices;
	}
}

let synth: FakeSynthesis | null = null;

const stubSynthesis = () => {
	synth = new FakeSynthesis();
	vi.stubGlobal("speechSynthesis", synth);
	vi.stubGlobal(
		"SpeechSynthesisUtterance",
		class {
			text: string;
			lang = "";
			voice: SpeechSynthesisVoice | null = null;
			onend: (() => void) | null = null;
			onerror: ((e: { error: string }) => void) | null = null;
			constructor(text: string) {
				this.text = text;
			}
		},
	);
};

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	synth = null;
	clearQueue();
	ttsEnabled.set(false);
	ttsSpeaking.set(false);
	localStorage.clear();
});

describe("ttsAnnouncer", () => {
	beforeEach(() => {
		stubSynthesis();
	});

	it("enqueue → ucapan berurutan (pertama selesai baru kedua)", async () => {
		setTtsEnabled(true);
		announce("Skor 10");
		announce("Skor 20");
		expect(synth?.spoken).toEqual(["Skor 10"]);
		synth?.finish();
		await waitForIdle(200);
		expect(synth?.spoken).toEqual(["Skor 10", "Skor 20"]);
		synth?.finish();
		await waitForIdle(200);
	});

	it("mode mati → announce no-op", () => {
		announce("Halo");
		expect(synth?.spoken).toEqual([]);
	});

	it("speechSynthesis null → announce no-op tanpa crash (fallback diam)", () => {
		vi.unstubAllGlobals();
		setTtsEnabled(true);
		expect(() => announce("Halo")).not.toThrow();
	});

	it("gesture-required (not-allowed) → enabled off + queue dibuang", async () => {
		setTtsEnabled(true);
		announce("Satu");
		announce("Dua");
		synth?.fail("not-allowed");
		let enabled = true;
		ttsEnabled.subscribe((v) => (enabled = v))();
		expect(enabled).toBe(false);
		announce("Tiga");
		expect(synth?.spoken).toEqual(["Satu"]);
	});

	it("queue cap: overflow → teks tertua di-drop", () => {
		setTtsEnabled(true);
		for (let i = 0; i < 12; i++) {
			announce(`Teks ${i}`);
		}
		expect(synth?.spoken).toEqual(["Teks 0"]);
	});

	it("voice id-ID dipilih", async () => {
		setTtsEnabled(true);
		announce("Halo");
		expect(synth?.voices[0].lang).toBe("id-ID");
	});
});

describe("SoundToggle", () => {
	it("toggle nyala/mati + aria-pressed; disabled saat API tak ada", async () => {
		stubSynthesis();
		ttsAvailable.set(true);
		render(SoundToggle);
		expect(screen.getByRole("button", { name: /suara: mati/i })).toBeTruthy();
		await fireEvent.click(screen.getByRole("button"));
		expect(screen.getByRole("button", { name: /suara: nyala/i })).toBeTruthy();
		expect(screen.getByRole("button").getAttribute("aria-pressed")).toBe(
			"true",
		);

		vi.unstubAllGlobals();
		ttsAvailable.set(false);
		await tick();
		expect(screen.getByRole("button").getAttribute("disabled")).not.toBeNull();
	});
});
