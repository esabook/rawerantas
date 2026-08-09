import { cleanup, fireEvent, render } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import TermsDialog from "$lib/components/TermsDialog.svelte";

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
	PUBLIC_TERMS_URL: "https://cdn.test/terms/{slug}.md",
}));

afterEach(cleanup);

const genericMark = /Pendaftaran dilakukan melalui aplikasi ini/;

describe("TermsDialog — file lokal", () => {
	it("tidak merender apa pun saat tertutup", () => {
		const { queryByText } = render(TermsDialog, {
			props: { open: false, title: "Syarat & Ketentuan", onclose: () => {} },
		});
		expect(queryByText(genericMark)).toBeNull();
	});

	it("tanpa competition: memakai terms.md generik", () => {
		const { getByText } = render(TermsDialog, {
			props: { open: true, title: "Syarat & Ketentuan", onclose: () => {} },
		});
		expect(getByText(genericMark)).toBeTruthy();
	});

	it("competition tanpa file per-lomba: jatuh ke terms.md generik", async () => {
		vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
		const { findByText } = render(TermsDialog, {
			props: {
				open: true,
				title: "Syarat & Ketentuan",
				onclose: () => {},
				competition: { id: "uuid-1", name: "Lomba Fiktif" },
			},
		});
		expect(await findByText(genericMark)).toBeTruthy();
		vi.unstubAllGlobals();
	});

	it("subtitle menampilkan nama lomba saat competition diberikan", () => {
		const { getByText } = render(TermsDialog, {
			props: {
				open: true,
				title: "Syarat & Ketentuan",
				onclose: () => {},
				competition: { id: "uuid-1", name: "Epekan Bebek" },
			},
		});
		expect(getByText("Epekan Bebek")).toBeTruthy();
	});

	it("tutup via tombol X", async () => {
		const onclose = vi.fn();
		const { getByRole } = render(TermsDialog, {
			props: { open: true, title: "Syarat & Ketentuan", onclose },
		});
		await fireEvent.click(
			getByRole("button", { name: "Tutup syarat dan ketentuan" }),
		);
		expect(onclose).toHaveBeenCalledOnce();
	});
});

describe("TermsDialog — PUBLIC_TERMS_URL remote", () => {
	const remoteCompetition = { id: "uuid-1", name: "Epekan Bebek" };

	it("fetch gagal: jatuh ke file lokal (per-lomba)", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockRejectedValue(new Error("offline")),
		);
		const { findByText } = render(TermsDialog, {
			props: {
				open: true,
				title: "Syarat & Ketentuan",
				onclose: () => {},
				competition: remoteCompetition,
			},
		});
		expect(
			await findByText("Hanya untuk arena Epekan Bebek."),
		).toBeTruthy();
		vi.unstubAllGlobals();
	});

	it("fetch sukses: menampilkan konten remote", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				status: 200,
				text: async () => "## Ketentuan Remote\n\n- Konten dari URL.",
			}),
		);
		const { findByText } = render(TermsDialog, {
			props: {
				open: true,
				title: "Syarat & Ketentuan",
				onclose: () => {},
				competition: remoteCompetition,
			},
		});
		expect(await findByText("Konten dari URL.")).toBeTruthy();
		expect(fetch).toHaveBeenCalledWith(
			"https://cdn.test/terms/epekan-bebek.md",
			{ cache: "no-store" },
		);
		vi.unstubAllGlobals();
	});
});
