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
	PUBLIC_ADMIN_PIN: "1234",
	PUBLIC_JURI_PIN: "1234",
}));

import AdminPanel from "$lib/components/AdminPanel.svelte";
import { resetDemoAdminState } from "$lib/db/admin";
import { getCompetitions } from "$lib/db/queries";
import { demoCompetitions } from "$lib/demo/generator";
import { setDemoMode } from "$lib/demo/store";

function must<T>(v: T | undefined | null, msg = "nilai wajib ada"): T {
	if (v == null) {
		throw new Error(msg);
	}
	return v;
}

const aduan = demoCompetitions()[1];
const mancing = demoCompetitions()[0];

async function clickTab(container: HTMLElement, label: string) {
	await waitFor(
		() => {
			const btn = Array.from(container.querySelectorAll("button")).find((b) =>
				(b.textContent ?? "").includes(label),
			);
			expect(btn).toBeDefined();
		},
		{ timeout: 5000 },
	);
	const btn = must(
		Array.from(container.querySelectorAll("button")).find((b) =>
			(b.textContent ?? "").includes(label),
		),
		`tab ${label} tidak ada`,
	);
	fireEvent.click(btn);
	await waitFor(() => {
		expect(container.textContent ?? "").toContain(label);
	});
}

afterEach(cleanup);

describe("AdminPanel", () => {
	beforeEach(async () => {
		await setDemoMode(true);
		await resetDemoAdminState();
	});

	it("menampilkan daftar kompetisi + metode pembayaran via tab", async () => {
		const { container } = render(AdminPanel);
		await clickTab(container, "Kompetisi");
		await waitFor(() => {
			expect(container.textContent ?? "").toContain(aduan.name);
		});
		expect(container.textContent ?? "").toContain(mancing.name);
		await clickTab(container, "Metode Pembayaran");
		await waitFor(() => {
			expect(container.textContent ?? "").toContain("bank_transfer");
		});
		expect(container.textContent ?? "").toContain("qris");
	});

	it("advance round aduan → toast + babak naik; tombol non-aduan disabled", async () => {
		const { container } = render(AdminPanel);
		await clickTab(container, "Kompetisi");
		await waitFor(() => {
			expect(container.textContent ?? "").toContain(aduan.name);
		});
		const advanceButtons = Array.from(
			container.querySelectorAll("button"),
		).filter((b) => (b.textContent ?? "").includes("Advance Round"));
		expect(advanceButtons).toHaveLength(3);
		const disabled = advanceButtons.filter(
			(b) => b.hasAttribute("disabled") || (b as HTMLButtonElement).disabled,
		);
		expect(disabled.length).toBe(2);
		const enabled = advanceButtons.find(
			(b) => !(b as HTMLButtonElement).disabled,
		) as Element;
		fireEvent.click(enabled);
		await waitFor(
			() => {
				expect(
					get(toasts).some((t) => t.message.includes("maju ke ronde")),
				).toBe(true);
			},
			{ timeout: 5000 },
		);
		const comps = await getCompetitions(false);
		expect(comps.find((c) => c.id === aduan.id)?.currentRound).toBe(
			aduan.currentRound + 1,
		);
	});

	it("simpan perubahan fee → toast + terlihat di getCompetitions", async () => {
		const { container } = render(AdminPanel);
		await clickTab(container, "Kompetisi");
		await waitFor(() => {
			expect(container.textContent ?? "").toContain(mancing.name);
		});
		const feeInput = Array.from(
			container.querySelectorAll('input[type="number"]'),
		)[0] as HTMLInputElement;
		fireEvent.input(feeInput, { target: { value: "80000" } });
		fireEvent.change(feeInput, { target: { value: "80000" } });
		const saveButtons = Array.from(container.querySelectorAll("button")).filter(
			(b) => (b.textContent ?? "").includes("Simpan"),
		);
		fireEvent.click(saveButtons[0]);
		await waitFor(
			() => {
				expect(get(toasts).some((t) => t.message.includes("tersimpan"))).toBe(
					true,
				);
			},
			{ timeout: 5000 },
		);
		const comps = await getCompetitions(false);
		expect(comps.find((c) => c.id === mancing.id)?.fee).toBe(80000);
	});

	it("tab verifikasi: daftar payment unverified + verifikasi via UI", async () => {
		const { registerParticipant } = await import("$lib/db/register");
		const { submitPayment } = await import("$lib/db/payment");
		const res = await registerParticipant({
			competitionId: mancing.id,
			name: "Eka Verifikasi UI",
			phone: "081255566677",
		});
		await submitPayment(
			{
				participantId: res.participantId,
				competitionId: mancing.id,
				method: "qris",
				amount: 25000,
				proofBlob: null,
				isCash: false,
			},
			"dp",
			mancing,
		);
		const { container } = render(AdminPanel);
		await waitFor(
			() => {
				expect(container.textContent ?? "").toContain("Eka Verifikasi UI");
			},
			{ timeout: 5000 },
		);
		const verifyButtons = Array.from(
			container.querySelectorAll("button"),
		).filter((b) => (b.textContent ?? "").trim() === "Verifikasi");
		fireEvent.click(verifyButtons[0]);
		await waitFor(
			() => {
				expect(
					get(toasts).some((t) => t.message.includes("terverifikasi")),
				).toBe(true);
			},
			{ timeout: 5000 },
		);
		const { getPayments } = await import("$lib/db/queries");
		const payments = await getPayments(res.participantId);
		expect(payments.some((p) => p.isVerified)).toBe(true);
	}, 30000);

	it("tab verifikasi: tolak wajib alasan + tercatat rejectReason", async () => {
		const { registerParticipant } = await import("$lib/db/register");
		const { submitPayment } = await import("$lib/db/payment");
		const res = await registerParticipant({
			competitionId: mancing.id,
			name: "Fani Ditolak UI",
			phone: "081244433322",
		});
		await submitPayment(
			{
				participantId: res.participantId,
				competitionId: mancing.id,
				method: "bank_transfer",
				amount: 25000,
				proofBlob: null,
				isCash: false,
			},
			"dp",
			mancing,
		);
		const { container } = render(AdminPanel);
		await waitFor(
			() => {
				expect(container.textContent ?? "").toContain("Fani Ditolak UI");
			},
			{ timeout: 5000 },
		);
		const buttons = () =>
			Array.from(container.querySelectorAll("button")).map((b) => ({
				el: b,
				text: b.textContent ?? "",
			}));
		const tolak = buttons().find((b) => b.text.includes("Tolak"));
		expect(tolak).toBeDefined();
		fireEvent.click(must(tolak).el);
		await waitFor(() => {
			expect(container.textContent ?? "").toContain("Alasan penolakan");
		});
		const input = Array.from(container.querySelectorAll("input")).find((i) =>
			i.className.includes("input"),
		) as HTMLInputElement | null;
		expect(input).toBeDefined();
		fireEvent.input(must(input), { target: { value: "Bukti buram" } });
		const confirm = buttons().find((b) => b.text.includes("Konfirmasi Tolak"));
		fireEvent.click(must(confirm).el);
		await waitFor(
			() => {
				expect(get(toasts).some((t) => t.message.includes("ditolak"))).toBe(
					true,
				);
			},
			{ timeout: 5000 },
		);
		const { getMergedPayments } = await import("$lib/db/admin");
		const all = await getMergedPayments();
		const rejected = all.find((p) => p.participantId === res.participantId);
		expect(rejected?.rejectReason).toBe("Bukti buram");
	}, 30000);
});
