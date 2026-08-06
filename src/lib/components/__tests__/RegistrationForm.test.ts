import "fake-indexeddb/auto";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RegistrationForm from "$lib/components/RegistrationForm.svelte";
import {
	isValidPhone,
	normalizePhone,
	QuotaFullError,
	registerParticipant,
	resetDemoRegistrations,
} from "$lib/db/register";
import { demoCompetitions } from "$lib/demo/generator";
import { demoMode } from "$lib/demo/store";

beforeEach(() => {
	demoMode.set(true);
});

afterEach(() => {
	cleanup();
	localStorage.clear();
});

const COMPETITIONS = demoCompetitions();
const comp = COMPETITIONS[0] ?? {
	id: "c1",
	name: "Mancing Lele",
	scoringMode: "terberat",
	fee: 50000,
	minDp: 25000,
	totalQuota: 50,
	currentRound: 1,
	isActive: true,
	createdAt: new Date(),
};

const fillForm = async (overrides?: {
	name?: string;
	phone?: string;
	competitionId?: string;
}) => {
	render(RegistrationForm, { competitions: COMPETITIONS });
	await fireEvent.input(screen.getByPlaceholderText("Nama peserta"), {
		target: { value: overrides?.name ?? "Budi Santoso" },
	});
	await fireEvent.input(screen.getByPlaceholderText("08xxxxxxxxxx"), {
		target: { value: overrides?.phone ?? "081234567890" },
	});
	const select = screen.getByRole("combobox");
	await fireEvent.change(select, {
		target: { value: overrides?.competitionId ?? comp.id },
	});
};

describe("phone util", () => {
	it("normalisasi 08… / +62… → 62…; validasi", () => {
		expect(normalizePhone("081234567890")).toBe("6281234567890");
		expect(normalizePhone("+62 812-3456-7890")).toBe("6281234567890");
		expect(normalizePhone("6281234567890")).toBe("6281234567890");
		expect(isValidPhone("081234567890")).toBe(true);
		expect(isValidPhone("08123")).toBe(false);
		expect(isValidPhone("12123")).toBe(false);
	});
});

describe("registerParticipant", () => {
	it("double-submit phone sama → 1 peserta (idempotent, duplicated)", async () => {
		await resetDemoRegistrations();
		const first = await registerParticipant({
			competitionId: comp.id,
			name: "Budi",
			phone: "081234567890",
		});
		const second = await registerParticipant({
			competitionId: comp.id,
			name: "Budi",
			phone: "081234567890",
		});
		expect(second.duplicated).toBe(true);
		expect(second.participantId).toBe(first.participantId);
		expect(second.ticketNumber).toBe(first.ticketNumber);
	});

	it("kuota habis → QuotaFullError", async () => {
		await resetDemoRegistrations();
		const quota = comp.totalQuota;
		let threw = false;
		for (let i = 0; i < quota + 5; i++) {
			try {
				await registerParticipant({
					competitionId: comp.id,
					name: `P ${i}`,
					phone: `0812345${String(i).padStart(5, "0")}`,
				});
			} catch (e) {
				if (e instanceof QuotaFullError) {
					threw = true;
					break;
				}
				throw e;
			}
		}
		expect(threw).toBe(true);
	});
});

describe("RegistrationForm", () => {
	it("validasi nomor WA salah → error + submit disabled", async () => {
		await fillForm({ phone: "0812" });
		expect(screen.getByText(/format nomor WA/i)).toBeTruthy();
		expect(
			screen
				.getByRole("button", { name: /daftar sekarang/i })
				.hasAttribute("disabled"),
		).toBe(true);
	});

	it("submit sukses → tampil nomor tiket", async () => {
		await resetDemoRegistrations();
		await fillForm();
		await fireEvent.click(
			screen.getByRole("button", { name: /daftar sekarang/i }),
		);
		await waitFor(() =>
			expect(screen.getByText(/berhasil terdaftar/i)).toBeTruthy(),
		);
		expect(screen.getByText(/T-00\d+/i)).toBeTruthy();
	});

	it("warning no-refund wajib tampil", async () => {
		await fillForm();
		expect(screen.getByRole("note").textContent).toContain("No-refund");
	});
});

describe("draft restore (refresh setelah timeout)", () => {
	it("draft tersimpan saat submit → form terisi ulang + tidak double-insert", async () => {
		await resetDemoRegistrations();
		const draft = {
			name: "Sari Dewi",
			phone: "081122334455",
			competitionId: comp.id,
			payment: "full" as const,
			savedAt: Date.now(),
		};
		localStorage.setItem(
			"rawerantas:registration-draft",
			JSON.stringify(draft),
		);
		render(RegistrationForm, { competitions: COMPETITIONS });
		expect(screen.getByPlaceholderText("Nama peserta")).toHaveProperty(
			"value",
			"Sari Dewi",
		);
		expect(screen.getByPlaceholderText("08xxxxxxxxxx")).toHaveProperty(
			"value",
			"081122334455",
		);
		await fireEvent.click(
			screen.getByRole("button", { name: /daftar sekarang/i }),
		);
		await waitFor(() =>
			expect(screen.getByText(/berhasil terdaftar/i)).toBeTruthy(),
		);
		await vi.waitFor(async () => {
			const again = await registerParticipant({
				competitionId: comp.id,
				name: "Sari Dewi",
				phone: "081122334455",
			});
			expect(again.duplicated).toBe(true);
		});
	});
});
