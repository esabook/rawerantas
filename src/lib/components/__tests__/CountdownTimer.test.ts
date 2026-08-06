import { cleanup, render, screen } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CountdownTimer from "$lib/components/CountdownTimer.svelte";

afterEach(() => {
	cleanup();
	vi.useRealTimers();
});

const renderAt = (now: string, props?: Record<string, string>) => {
	const time = new Date(now).getTime();
	vi.useFakeTimers();
	vi.setSystemTime(time);
	render(CountdownTimer, props ?? {});
};

describe("CountdownTimer", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	it("eventDate invalid → error state + pesan (bukan NaN)", () => {
		renderAt("2026-08-07T00:00:00+07:00", { eventDate: "bukan-tanggal" });
		expect(screen.getByRole("status").textContent).toContain("belum diatur");
	});

	it("segera: countdown menampilkan d/h/m/s tersisa", () => {
		renderAt("2026-08-07T00:00:00+07:00", {
			eventDate: "2026-08-10T07:00:00+07:00",
		});
		const el = screen.getByRole("status");
		expect(el.textContent).toContain("Segera dimulai");
		expect(el.textContent).toContain("3");
		expect(el.textContent).toContain("hari");
	});

	it("countdown decrement per detik", async () => {
		renderAt("2026-08-07T00:00:00+07:00", {
			eventDate: "2026-08-07T00:00:05+07:00",
		});
		const text = () => screen.getByRole("status").textContent ?? "";
		expect(text()).toContain("5");
		await vi.advanceTimersByTimeAsync(1000);
		expect(text()).toContain("4");
	});

	it("live → highlight gold, tanpa countdown", () => {
		renderAt("2026-08-07T07:00:00+07:00", {
			eventDate: "2026-08-07T07:00:00+07:00",
		});
		const el = screen.getByRole("status");
		expect(el.textContent).toContain("Sedang berlangsung");
		expect(el.classList).toContain("border-gold");
	});

	it("habis → pesan berakhir", () => {
		renderAt("2026-08-08T00:00:00+07:00", {
			eventDate: "2026-08-07T07:00:00+07:00",
		});
		expect(screen.getByRole("status").textContent).toContain("Telah berakhir");
	});

	it("timer interval dibersihkan saat unmount", async () => {
		renderAt("2026-08-07T00:00:00+07:00", {
			eventDate: "2026-08-07T00:00:30+07:00",
		});
		const before = vi.getTimerCount();
		cleanup();
		expect(vi.getTimerCount()).toBe(before - 1);
	});
});
