import { cleanup, render } from "@testing-library/svelte";
import { afterEach, expect, it, vi } from "vitest";
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
	PUBLIC_TERMS_URL: "",
}));

afterEach(cleanup);

it("lokal: file terms-<slug>.md dimuat per nama lomba", async () => {
	const { findByText, queryByText } = render(TermsDialog, {
		props: {
			open: true,
			title: "Syarat & Ketentuan",
			onclose: () => {},
			competition: { id: "uuid-1", name: "Epekan Bebek" },
		},
	});
	expect(await findByText("Hanya untuk arena Epekan Bebek.")).toBeTruthy();
	expect(queryByText(/Pendaftaran dilakukan melalui aplikasi ini/)).toBeNull();
});

it("lomba tanpa file: fallback terms.md generik", async () => {
	const { findByText } = render(TermsDialog, {
		props: {
			open: true,
			title: "Syarat & Ketentuan",
			onclose: () => {},
			competition: { id: "uuid-2", name: "Lomba Fiktif" },
		},
	});
	expect(await findByText(/Pendaftaran dilakukan melalui aplikasi ini/)).toBeTruthy();
});
