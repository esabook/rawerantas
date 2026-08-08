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
			expect(container.textContent ?? "").toContain("Transfer bank");
		});
		expect(container.textContent ?? "").toContain("QRIS");
	});

	it("babak berikutnya memakai konfirmasi → toast + babak naik; tombol non-aduan disabled", async () => {
		const { container } = render(AdminPanel);
		await clickTab(container, "Kompetisi");
		await waitFor(() => {
			expect(container.textContent ?? "").toContain(aduan.name);
		});
		const advanceButtons = Array.from(
			container.querySelectorAll("button"),
		).filter((b) => (b.textContent ?? "").includes("Babak berikutnya"));
		expect(advanceButtons).toHaveLength(3);
		const disabled = advanceButtons.filter(
			(b) => b.hasAttribute("disabled") || (b as HTMLButtonElement).disabled,
		);
		expect(disabled.length).toBe(2);
		const enabled = advanceButtons.find(
			(b) => !(b as HTMLButtonElement).disabled,
		) as Element;
		fireEvent.click(enabled);
		await waitFor(() => {
			expect(container.textContent ?? "").toContain("Mulai babak");
		});
		const confirm = Array.from(container.querySelectorAll("button")).find((b) =>
			(b.textContent ?? "").includes("Ya, mulai babak"),
		);
		expect(confirm).toBeDefined();
		fireEvent.click(must(confirm));
		await waitFor(
			() => {
				expect(
					get(toasts).some((t) =>
						t.message.includes("sekarang memasuki ronde"),
					),
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
		const columnButton = Array.from(container.querySelectorAll("button")).find(
			(button) => (button.textContent ?? "").includes("Kolom"),
		);
		expect(columnButton).toBeDefined();
		fireEvent.click(must(columnButton));
		await waitFor(() => {
			expect(container.textContent ?? "").toContain("Tampilkan kolom");
		});
		const amountToggle = Array.from(container.querySelectorAll("label"))
			.find((label) => (label.textContent ?? "").includes("Nominal"))
			?.querySelector("input[type='checkbox']") as HTMLInputElement | null;
		expect(amountToggle).toBeDefined();
		fireEvent.click(must(amountToggle));
		await waitFor(() => {
			expect(
				Array.from(container.querySelectorAll("th")).some((th) =>
					(th.textContent ?? "").includes("Nominal"),
				),
			).toBe(false);
		});
		fireEvent.click(must(amountToggle));
		const paymentRow = Array.from(container.querySelectorAll("tr")).find(
			(row) => (row.textContent ?? "").includes("Eka Verifikasi UI"),
		);
		expect(paymentRow).toBeDefined();
		const verifyButton = Array.from(
			must(paymentRow).querySelectorAll("button"),
		).find((b) => (b.textContent ?? "").trim() === "Verifikasi");
		expect(verifyButton).toBeDefined();
		fireEvent.click(must(verifyButton));
		await waitFor(() => {
			expect(container.textContent ?? "").toContain("Konfirmasi verifikasi");
		});
		const confirmVerify = Array.from(container.querySelectorAll("button")).find(
			(b) => (b.textContent ?? "").includes("Konfirmasi verifikasi"),
		);
		fireEvent.click(must(confirmVerify));
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
		const paymentRow = Array.from(container.querySelectorAll("tr")).find(
			(row) => (row.textContent ?? "").includes("Fani Ditolak UI"),
		);
		expect(paymentRow).toBeDefined();
		const tolak = Array.from(must(paymentRow).querySelectorAll("button"))
			.map((el) => ({ el, text: el.textContent ?? "" }))
			.find((b) => b.text.includes("Tolak"));
		expect(tolak).toBeDefined();
		fireEvent.click(must(tolak).el);
		await waitFor(() => {
			expect(container.textContent ?? "").toContain("Alasan penolakan");
		});
		const input = container.querySelector(
			"textarea.input",
		) as HTMLTextAreaElement | null;
		expect(input).toBeDefined();
		fireEvent.input(must(input), { target: { value: "Bukti buram" } });
		const confirm = buttons().find((b) =>
			b.text.includes("Konfirmasi penolakan"),
		);
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

	it("wizard import peserta CSV menampilkan panduan dan pratinjau", async () => {
		const { container } = render(AdminPanel);
		const importButton = await waitFor(() => {
			const button = Array.from(container.querySelectorAll("button")).find(
				(item) => (item.textContent ?? "").includes("Import peserta CSV"),
			);
			expect(button).toBeDefined();
			return must(button);
		});
		fireEvent.click(importButton);
		await waitFor(() => {
			expect(container.textContent ?? "").toContain("Panduan edge case");
		});
		fireEvent.click(
			must(
				Array.from(container.querySelectorAll("button")).find((button) =>
					(button.textContent ?? "").includes("Lanjut pilih file"),
				),
			),
		);
		const file = new File(
			[`nama,no_wa,lomba\nCSV UI,081298765498,${mancing.name}`],
			"peserta.csv",
			{ type: "text/csv" },
		);
		const fileInput = await waitFor(
			() =>
				must(container.querySelector('input[type="file"]')) as HTMLInputElement,
		);
		fireEvent.change(fileInput, { target: { files: [file] } });
		const readButton = await waitFor(() =>
			must(
				Array.from(container.querySelectorAll("button")).find((button) =>
					(button.textContent ?? "").includes("Baca dan validasi CSV"),
				),
			),
		);
		fireEvent.click(readButton);
		await waitFor(() => {
			expect(container.textContent ?? "").toContain("Siap import");
			expect(container.textContent ?? "").toContain("CSV UI");
		});
	});

	it("detail pembayaran menyediakan tombol Lunas untuk sisa tunai", async () => {
		const { registerParticipant } = await import("$lib/db/register");
		const { submitPayment } = await import("$lib/db/payment");
		const { adminActorHash, verifyPayment } = await import("$lib/db/admin");
		const { getPayments } = await import("$lib/db/queries");
		const res = await registerParticipant({
			competitionId: mancing.id,
			name: "Gita Tombol Lunas",
			phone: "081298765499",
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
		const dp = (await getPayments(res.participantId))[0];
		if (!dp) throw new Error("DP test tidak ditemukan");
		await verifyPayment(dp.id, await adminActorHash());

		const { container } = render(AdminPanel);
		await waitFor(
			() => expect(container.textContent ?? "").toContain("Gita Tombol Lunas"),
			{ timeout: 5000 },
		);
		const paymentRow = Array.from(container.querySelectorAll("tr")).find(
			(row) => (row.textContent ?? "").includes("Gita Tombol Lunas"),
		);
		const settleButton = Array.from(
			must(paymentRow).querySelectorAll("button"),
		).find((button) => (button.textContent ?? "").trim() === "Lunas");
		expect(settleButton).toBeDefined();
		fireEvent.click(must(settleButton));
		await waitFor(() =>
			expect(container.textContent ?? "").toContain("Konfirmasi lunas tunai"),
		);
		fireEvent.click(
			must(
				Array.from(container.querySelectorAll("button")).find((button) =>
					(button.textContent ?? "").includes("Konfirmasi lunas tunai"),
				),
			),
		);
		await waitFor(
			() =>
				expect(
					get(toasts).some((toast) => toast.message.includes("sekarang lunas")),
				).toBe(true),
			{ timeout: 5000 },
		);
		const payments = await getPayments(res.participantId);
		expect(
			payments.some(
				(payment) => payment.paymentMethod === "cash" && payment.isVerified,
			),
		).toBe(true);
	}, 30000);
});
