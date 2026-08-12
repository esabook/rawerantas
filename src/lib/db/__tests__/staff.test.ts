import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

import { resetLocalDemoState } from "$lib/db/localStore";
import {
	listStaffMembers,
	setStaffActive,
	staffLogin,
	upsertStaffMember,
} from "$lib/db/staff";
import { demoStaff } from "$lib/demo/generator";
import { setDemoMode } from "$lib/demo/store";

describe("staff roster (demo)", () => {
	beforeEach(async () => {
		await setDemoMode(true);
		await resetLocalDemoState();
	});

	it("listStaffMembers: sebelum ada override, kembalikan seed demo", async () => {
		const members = await listStaffMembers();
		expect(members.length).toBe(demoStaff().length);
		expect(members.some((m) => m.name === "Budi Panitia")).toBe(true);
	});

	it("login 6 digit HP terdaftar & aktif -> ok + nama benar", async () => {
		const result = await staffLogin("juri", "444444");
		expect(result.ok).toBe(true);
		expect(result.ok && result.name).toBe("Dewi Juri");
	});

	it("login 6 digit tidak dikenal -> not_found", async () => {
		const result = await staffLogin("panitia", "999999");
		expect(result).toEqual({ ok: false, reason: "not_found" });
	});

	it("login anggota nonaktif -> not_found (bukan ok)", async () => {
		const result = await staffLogin("juri", "666666");
		expect(result.ok).toBe(false);
	});

	it("login role salah (last6 milik role lain) -> not_found", async () => {
		// "444444" terdaftar sbg juri, bukan panitia.
		const result = await staffLogin("panitia", "444444");
		expect(result).toEqual({ ok: false, reason: "not_found" });
	});

	it("login format tidak valid (bukan 6 digit) -> invalid_last6", async () => {
		const result = await staffLogin("juri", "12345");
		expect(result).toEqual({ ok: false, reason: "invalid_last6" });
	});

	it("dua anggota aktif berbagi 6 digit terakhir -> ambiguous, bukan salah tebak", async () => {
		await upsertStaffMember({
			role: "panitia",
			name: "Anto Satu",
			phone: "081277000001",
		});
		await upsertStaffMember({
			role: "panitia",
			name: "Anto Dua",
			phone: "081399000001",
		});
		const result = await staffLogin("panitia", "000001");
		expect(result).toEqual({ ok: false, reason: "ambiguous" });
	});

	it("upsertStaffMember: tambah baru lalu muncul di listStaffMembers", async () => {
		const created = await upsertStaffMember({
			role: "juri",
			name: "Wawan Baru",
			phone: "081234567890",
		});
		const members = await listStaffMembers();
		expect(
			members.some((m) => m.id === created.id && m.name === "Wawan Baru"),
		).toBe(true);
	});

	it("upsertStaffMember dengan id existing -> edit di tempat, bukan duplikat", async () => {
		const created = await upsertStaffMember({
			role: "juri",
			name: "Nama Awal",
			phone: "081234567891",
		});
		await upsertStaffMember({
			id: created.id,
			role: "juri",
			name: "Nama Diubah",
			phone: "081234567891",
		});
		const members = await listStaffMembers();
		const matches = members.filter((m) => m.id === created.id);
		expect(matches).toHaveLength(1);
		expect(matches[0]?.name).toBe("Nama Diubah");
	});

	it("setStaffActive: nonaktifkan -> tidak bisa login lagi", async () => {
		const created = await upsertStaffMember({
			role: "panitia",
			name: "Akan Dinonaktifkan",
			phone: "081234500009",
		});
		expect((await staffLogin("panitia", "500009")).ok).toBe(true);
		await setStaffActive(created.id, false);
		expect((await staffLogin("panitia", "500009")).ok).toBe(false);
	});

	it("nama/telepon tidak valid ditolak", async () => {
		await expect(
			upsertStaffMember({ role: "panitia", name: "A", phone: "081234567890" }),
		).rejects.toThrow();
		await expect(
			upsertStaffMember({ role: "panitia", name: "Nama Oke", phone: "123" }),
		).rejects.toThrow();
	});
});
