import { cleanup, fireEvent, render } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import PaymentMethodSelector from "$lib/components/PaymentMethodSelector.svelte";
import type { PaymentConfig } from "$lib/db/queries";

const configs: PaymentConfig[] = [
	{
		id: "qris",
		method: "qris",
		isActive: true,
		createdAt: new Date(),
		instructions: null,
		qrisImageUrl: "https://example.com/qris.png",
		accountName: null,
		accountNumber: null,
	},
	{
		id: "bank",
		method: "bank_transfer",
		isActive: true,
		createdAt: new Date(),
		instructions: null,
		qrisImageUrl: null,
		accountName: "Panitia Rawa",
		accountNumber: "1234567890",
	},
	{
		id: "cash",
		method: "cash",
		isActive: false,
		createdAt: new Date(),
		instructions: null,
		qrisImageUrl: null,
		accountName: null,
		accountNumber: null,
	},
];

afterEach(cleanup);

describe("PaymentMethodSelector", () => {
	it("hanya menampilkan metode yang aktif", () => {
		const { container } = render(PaymentMethodSelector, { configs, value: "" });
		const radios = container.querySelectorAll('input[name="payment-method"]');
		expect(radios).toHaveLength(2);
		expect(container.textContent ?? "").toContain("Transfer Bank");
		expect(container.textContent ?? "").not.toContain("Tunai");
	});

	it("menampilkan info rekening untuk bank transfer", () => {
		const { container } = render(PaymentMethodSelector, {
			configs,
			value: "bank_transfer",
		});
		expect(container.textContent ?? "").toContain("Panitia Rawa");
		expect(container.textContent ?? "").toContain("1234567890");
	});

	it("memanggil onchange saat metode dipilih", () => {
		const onchange = vi.fn();
		const { container } = render(PaymentMethodSelector, {
			configs,
			value: "",
			onchange,
		});
		const bank = container.querySelector('input[value="bank_transfer"]');
		expect(bank).not.toBeNull();
		fireEvent.change(bank as Element);
		expect(onchange).toHaveBeenCalledWith("bank_transfer");
	});

	it("menampilkan catatan QRIS bila tanpa gambar QR", () => {
		const qrisOnly: PaymentConfig[] = [
			{
				id: "qris",
				method: "qris",
				isActive: true,
				createdAt: new Date(),
				instructions: null,
				qrisImageUrl: null,
				accountName: null,
				accountNumber: null,
			},
		];
		const { container } = render(PaymentMethodSelector, {
			configs: qrisOnly,
			value: "qris",
		});
		expect(container.textContent ?? "").toContain("QRIS belum tersedia");
	});

	it("tidak menampilkan catatan QRIS bila gambar QR tersedia", () => {
		const { container } = render(PaymentMethodSelector, {
			configs,
			value: "qris",
		});
		expect(container.textContent ?? "").not.toContain("QRIS belum tersedia");
	});

	it("menampilkan pesan bila tidak ada metode aktif", () => {
		const { container } = render(PaymentMethodSelector, {
			configs: [],
			value: "",
		});
		expect(container.textContent ?? "").toContain(
			"Belum ada metode pembayaran aktif",
		);
	});
});
