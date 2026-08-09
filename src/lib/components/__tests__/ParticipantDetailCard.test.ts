import { cleanup, fireEvent, render, waitFor } from "@testing-library/svelte";
import { get } from "svelte/store";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toasts } from "$lib/components/toast/toastStore";

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
}));

import ParticipantDetailCard from "$lib/components/ParticipantDetailCard.svelte";
import { resetDemoCheckins } from "$lib/db/checkin";
import { demoParticipants } from "$lib/demo/generator";
import { setDemoMode } from "$lib/demo/store";

const dpPaid = demoParticipants().find((p) => p.status === "dp_paid");
const registered = demoParticipants().find((p) => p.status === "registered");
if (!dpPaid || !registered) {
	throw new Error("peserta demo tidak ditemukan");
}

afterEach(cleanup);

describe("ParticipantDetailCard", () => {
	beforeEach(async () => {
		await setDemoMode(true);
		await resetDemoCheckins();
	});

	it("menampilkan nama, tiket, status, sisa bayar", async () => {
		const { container } = render(ParticipantDetailCard, {
			participantId: dpPaid.id,
			onDone: () => {},
		});
		await waitFor(() => {
			expect(container.textContent ?? "").toContain(dpPaid.name);
		});
		const text = container.textContent ?? "";
		expect(text).toContain("DP lunas");
		expect(text).toContain(dpPaid.ticketNumber);
		expect(text).toContain("Sisa bayar");
	});

	it("klik check-in → toast sukses + badge berubah", async () => {
		const { container } = render(ParticipantDetailCard, {
			participantId: dpPaid.id,
			onDone: () => {},
		});
		await waitFor(() => {
			expect(container.textContent ?? "").toContain("Check-in Peserta");
		});
		fireEvent.click(
			Array.from(container.querySelectorAll("button")).find((b) =>
				(b.textContent ?? "").includes("Check-in"),
			) as Element,
		);
		await waitFor(
			() => {
				expect(
					get(toasts).some((t) => t.message.includes("Check-in berhasil")),
				).toBe(true);
			},
			{ timeout: 5000 },
		);
		await waitFor(() => {
			expect(container.textContent ?? "").toContain("Sudah check-in");
		});
	});

	it("peserta registered → tombol check-in nonaktif + alasan tampil tanpa klik (QW-4/A10)", async () => {
		const { container } = render(ParticipantDetailCard, {
			participantId: registered.id,
			onDone: () => {},
		});
		await waitFor(() => {
			expect(container.textContent ?? "").toContain("Terdaftar");
		});
		// Alasan langsung tampil; tombol check-in ada tetapi dinonaktifkan.
		await waitFor(() => {
			expect(container.textContent ?? "").toContain("minimal DP");
		});
		const btn = Array.from(container.querySelectorAll("button")).find((b) =>
			(b.textContent ?? "").includes("Check-in"),
		) as HTMLButtonElement | undefined;
		expect(btn).toBeTruthy();
		expect(btn?.disabled).toBe(true);
	});

	it("peserta sudah check-in → info, tanpa tombol", async () => {
		const { container } = render(ParticipantDetailCard, {
			participantId: dpPaid.id,
			onDone: () => {},
		});
		await waitFor(() => {
			expect(container.textContent ?? "").toContain("Check-in Peserta");
		});
		fireEvent.click(
			Array.from(container.querySelectorAll("button")).find((b) =>
				(b.textContent ?? "").includes("Check-in"),
			) as Element,
		);
		await waitFor(
			() => {
				expect(container.textContent ?? "").toContain("Sudah check-in");
			},
			{ timeout: 5000 },
		);
		const buttons = Array.from(container.querySelectorAll("button")).filter(
			(b) => (b.textContent ?? "").includes("Check-in"),
		);
		expect(buttons.length).toBe(0);
	});

	it("check-in offline (queued) → badge menunggu sinkron (B2-4/F16)", async () => {
		const checkin = await import("$lib/db/checkin");
		type CheckinResult = Awaited<
			ReturnType<(typeof checkin)["checkInParticipant"]>
		>;
		const spy = vi
			.spyOn(checkin, "checkInParticipant")
			.mockResolvedValue({
				eligibility: "ok",
				queued: true,
				summary: undefined,
			} as unknown as CheckinResult);
		try {
			const { container } = render(ParticipantDetailCard, {
				participantId: dpPaid.id,
				onDone: () => {},
			});
			await waitFor(() => {
				expect(container.textContent ?? "").toContain("Check-in Peserta");
			});
			fireEvent.click(
				Array.from(container.querySelectorAll("button")).find((b) =>
					(b.textContent ?? "").includes("Check-in"),
				) as Element,
			);
			await waitFor(
				() => {
					expect(container.textContent ?? "").toContain("Menunggu sinkron");
				},
				{ timeout: 5000 },
			);
		} finally {
			spy.mockRestore();
		}
	});
});
