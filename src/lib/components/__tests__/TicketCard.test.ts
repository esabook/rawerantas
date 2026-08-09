import { cleanup, render } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";

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

vi.mock("qrcode", () => ({
	default: {
		toDataURL: () => Promise.resolve("data:image/png;base64,QR"),
	},
}));

import TicketCard from "$lib/components/TicketCard.svelte";
import type { Participant } from "$lib/db/queries";
import { demoCompetitions } from "$lib/demo/generator";

const competition = demoCompetitions()[0];

const participant: Participant = {
	id: "p-1",
	competitionId: competition.id,
	ticketNumber: "RA-2026-001",
	lapakNumber: "7",
	name: "Budi Santoso",
	phone: "6281234567890",
	status: "fully_paid",
	checkedInAt: null,
	createdAt: new Date(),
};

afterEach(cleanup);

describe("TicketCard", () => {
	it("menampilkan nama, lomba, nomor tiket, dan status", () => {
		const { container } = render(TicketCard, { participant, competition });
		const text = container.textContent ?? "";
		expect(text).toContain("Budi Santoso");
		expect(text).toContain(competition.name);
		expect(text).toContain("RA-2026-001");
		expect(text).toContain("Lunas");
		expect(text).toContain("BIB #7");
	});

	it("status lunas menampilkan verifikasi pembayaran", () => {
		const { container } = render(TicketCard, { participant, competition });
		expect(container.textContent ?? "").toContain(
			"Pembayaran lunas terverifikasi",
		);
	});

	it("link WhatsApp valid wa.me dengan nama peserta", () => {
		const { container } = render(TicketCard, { participant, competition });
		const link = container.querySelector('a[href^="https://wa.me/"]');
		expect(link).not.toBeNull();
		const href = link?.getAttribute("href") ?? "";
		expect(href).toContain("Budi%20Santoso");
		expect(href).toContain("RA-2026-001");
	});

	it("menyisipkan CSS print selebar printer (58mm)", () => {
		render(TicketCard, { participant, competition, printWidth: 58 });
		const style = document.querySelector(
			'style[data-ticket-print="true"]',
		) as HTMLStyleElement | null;
		expect(style?.textContent).toContain("58mm auto");
		expect(style?.textContent).toContain(".no-print");
	});

	it("menghapus CSS print saat komponen dilepas", () => {
		const { unmount } = render(TicketCard, {
			participant,
			competition,
			printWidth: 80,
		});
		expect(
			document.querySelector('style[data-ticket-print="true"]'),
		).not.toBeNull();
		unmount();
		expect(
			document.querySelector('style[data-ticket-print="true"]'),
		).toBeNull();
	});
});
