import { cleanup, render, waitFor } from "@testing-library/svelte";
import { get } from "svelte/store";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("$env/static/public", () => ({
	PUBLIC_BASE_URL: "https://rawe.test",
	PUBLIC_APP_NAME: "Rawera 2026",
	PUBLIC_APP_YEAR: "2026",
	PUBLIC_EVENT_DATE: "2026-08-17T08:00:00Z",
	PUBLIC_ENABLE_DEMO_MODE: "true",
	PUBLIC_SUPABASE_URL: "",
	PUBLIC_SUPABASE_ANON_KEY: "",
	PUBLIC_ADMIN_PIN: "123456",
	PUBLIC_PANITIA_PIN: "123456",
	PUBLIC_JURI_PIN: "123456",
	PUBLIC_TERMS_URL: "",
}));

const h = vi.hoisted(() => ({ spoken: [] as string[] }));

vi.mock("$lib/tts/ttsAnnouncer", async (importOriginal) => {
	const mod = await importOriginal<typeof import("$lib/tts/ttsAnnouncer")>();
	return {
		...mod,
		announce: (text: string) => {
			if (get(mod.ttsEnabled)) {
				h.spoken.push(text);
			}
		},
	};
});

import DisplayScreen, {
	DISPLAY_CLOCK_MS,
	DISPLAY_CYCLE_MS,
	DISPLAY_POLL_MS,
} from "$lib/components/DisplayScreen.svelte";
import { resetDemoAdminState } from "$lib/db/admin";
import { demoCompetitions, mockParticipants } from "$lib/demo/generator";
import { setDemoMode } from "$lib/demo/store";
import { setTtsEnabled } from "$lib/tts/ttsAnnouncer";

describe("DisplayScreen", () => {
	beforeEach(async () => {
		vi.useFakeTimers({ shouldAdvanceTime: true });
		await setDemoMode(true);
		await resetDemoAdminState();
		localStorage.clear();
		setTtsEnabled(false);
		h.spoken.length = 0;
	});

	afterEach(() => {
		vi.useRealTimers();
		cleanup();
	});

	it("render header (nama kompetisi, jam, ronde) + papan skor", async () => {
		const { container } = render(DisplayScreen);
		await waitFor(() => {
			expect(container.textContent ?? "").toContain("Mancing Lele");
		});
		await waitFor(() => {
			expect(container.textContent ?? "").toContain("Ronde 1");
		});
		expect(container.querySelector("header p.font-mono")).not.toBeNull();
		await waitFor(() => {
			expect(container.querySelectorAll("main .grid > div")).toHaveLength(3);
		});
		expect(container.querySelectorAll("main ol li").length).toBeGreaterThan(0);
		expect(container.textContent ?? "").not.toContain("Belum ada skor");
	});

	it("jam berdetak tiap detik", async () => {
		const { container } = render(DisplayScreen);
		await waitFor(() => {
			expect(container.textContent ?? "").toContain("Mancing Lele");
		});
		const clockEl = container.querySelector("header p.font-mono") as Element;
		const t0 = clockEl.textContent ?? "";
		await vi.advanceTimersByTimeAsync(DISPLAY_CLOCK_MS + 100);
		const t1 = clockEl.textContent ?? "";
		expect(t1).not.toBe(t0);
	});

	it("siklus otomatis ganti kompetisi", async () => {
		const { container } = render(DisplayScreen);
		await waitFor(() => {
			expect(container.textContent ?? "").toContain("Mancing Lele");
		});
		await vi.advanceTimersByTimeAsync(DISPLAY_CYCLE_MS + 100);
		await waitFor(() => {
			expect(container.textContent ?? "").toContain("Aduan Layangan");
		});
		expect(container.textContent ?? "").toContain("Ronde 1");
	});

	it("TTS nyala: pemenang baru → announce memimpin", async () => {
		setTtsEnabled(true);
		const { container } = render(DisplayScreen);
		await waitFor(() => {
			expect(container.textContent ?? "").toContain("Mancing Lele");
		});
		await waitFor(() => {
			expect(h.spoken.length).toBeGreaterThan(0);
		});
		h.spoken.length = 0;

		const compId = demoCompetitions()[0].id;
		const target = [
			...mockParticipants.filter((p) => p.competitionId === compId),
		].at(-1);
		if (!target) {
			throw new Error("seed mancing kosong");
		}
		const { submitMancingScore } = await import("$lib/db/scores");
		await submitMancingScore({
			competitionId: compId,
			participantId: target.id,
			fishWeightGram: 999_999,
			isJackpot: false,
			recordedBy: "test-hash",
		});

		await vi.advanceTimersByTimeAsync(DISPLAY_POLL_MS + 100);
		await vi.waitFor(() => {
			expect(h.spoken.some((t) => t.includes("memimpin"))).toBe(true);
		});
		expect(h.spoken.some((t) => t.includes(target.name))).toBe(true);
	});

	it("TTS mati → mode hening tanpa error", async () => {
		const { container } = render(DisplayScreen);
		await waitFor(() => {
			expect(container.textContent ?? "").toContain("Mancing Lele");
		});
		expect(h.spoken).toHaveLength(0);
		await vi.advanceTimersByTimeAsync(DISPLAY_POLL_MS * 2 + 100);
		expect(h.spoken).toHaveLength(0);
	});

	it("round maju via admin → header ronde ikut update di poll", async () => {
		const { container } = render(DisplayScreen);
		await waitFor(() => {
			expect(container.textContent ?? "").toContain("Mancing Lele");
		});
		await vi.advanceTimersByTimeAsync(DISPLAY_CYCLE_MS + 100);
		await waitFor(() => {
			expect(container.textContent ?? "").toContain("Aduan Layangan");
		});
		const { advanceRound } = await import("$lib/db/admin");
		const { round } = await advanceRound(
			demoCompetitions()[1].id,
			"test-actor-hash",
			{ force: true },
		);
		expect(round).toBe(2);
		await vi.advanceTimersByTimeAsync(DISPLAY_POLL_MS + 100);
		await waitFor(() => {
			expect(container.textContent ?? "").toContain("Ronde 2");
		});
	});

	it("koneksi putus → last-known tetap tampil + banner kecil", async () => {
		const leaderboard = await import("$lib/db/leaderboard");
		const original = leaderboard.getLeaderboardRows;
		let calls = 0;
		const spy = vi
			.spyOn(leaderboard, "getLeaderboardRows")
			.mockImplementation(async (...args) => {
				calls += 1;
				if (calls >= 2) {
					throw new Error("offline");
				}
				return original(...args);
			});
		const { container } = render(DisplayScreen);
		await waitFor(() => {
			expect(container.textContent ?? "").toContain("Mancing Lele");
		});
		await waitFor(() => {
			expect(container.querySelectorAll("main .grid > div")).toHaveLength(3);
		});
		await vi.advanceTimersByTimeAsync(DISPLAY_POLL_MS + 100);
		await vi.waitFor(() => {
			expect(container.querySelector('[role="status"]')).not.toBeNull();
		});
		expect(container.textContent ?? "").toContain("data terakhir");
		expect(container.textContent ?? "").not.toContain("Belum ada skor");
		spy.mockRestore();
	});

	it("Wake Lock diminta saat mount, dilepas saat unmount", async () => {
		const release = vi.fn().mockResolvedValue(undefined);
		const request = vi.fn().mockResolvedValue({ release });
		Object.defineProperty(navigator, "wakeLock", {
			value: { request },
			configurable: true,
		});
		const { unmount } = render(DisplayScreen);
		await vi.waitFor(() => {
			expect(request).toHaveBeenCalledWith("screen");
		});
		await vi.advanceTimersByTimeAsync(10);
		await Promise.resolve();
		unmount();
		await vi.waitFor(() => {
			expect(release).toHaveBeenCalled();
		});
		// @ts-expect-error membersihkan mock global
		delete navigator.wakeLock;
	});
});
