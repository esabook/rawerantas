import { get } from "svelte/store";
import { demoStaff } from "$lib/demo/generator";
import { demoMode } from "$lib/demo/store";
import { localClear, localGetAll, localPut, localStores } from "./localStore";
import { getSupabase } from "./queries";
import { isValidPhone, normalizePhone } from "./register";
import type { StaffRole } from "./schema";

export interface StaffMember {
	id: string;
	role: StaffRole;
	name: string;
	phone: string;
	isActive: boolean;
	createdAt: Date | string;
}

export type StaffLoginResult =
	| { ok: true; staffId: string; name: string }
	| { ok: false; reason: "not_found" | "ambiguous" | "invalid_last6" };

const STORE = localStores.staff;
const OVERRIDE_ID = "__staff_override__";
type StaffOverride = { id: typeof OVERRIDE_ID; createdAt: Date };

const sortStaff = (items: StaffMember[]) =>
	[...items].sort(
		(a, b) => a.role.localeCompare(b.role) || a.name.localeCompare(b.name),
	);

/** Peserta roster panitia/juri — gabungan seed demo + override lokal (admin). */
export async function listStaffMembers(): Promise<StaffMember[]> {
	if (get(demoMode)) {
		const local = await localGetAll<StaffMember | StaffOverride>(STORE);
		if (local.some((item) => item.id === OVERRIDE_ID)) {
			return sortStaff(
				local.filter((item): item is StaffMember => item.id !== OVERRIDE_ID),
			);
		}
		return sortStaff(
			demoStaff().map(({ phoneLast6: _phoneLast6, ...rest }) => rest),
		);
	}
	const { supabase } = await getSupabase();
	const { data, error } = await supabase.rpc("list_staff_members");
	if (error) {
		throw new Error(`listStaffMembers: ${error.message}`);
	}
	return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
		id: row.id as string,
		role: row.role as StaffRole,
		name: row.name as string,
		phone: row.phone as string,
		isActive: (row.isActive ?? row.is_active) as boolean,
		createdAt: (row.createdAt ?? row.created_at) as string,
	}));
}

async function saveLocalStaff(items: StaffMember[]): Promise<void> {
	await localClear(STORE);
	await localPut(STORE, { id: OVERRIDE_ID, createdAt: new Date() });
	for (const item of items) {
		await localPut(STORE, item);
	}
}

/** Pesan ramah utk reason penolakan RPC roster panitia/juri. */
function staffReasonMessage(reason: string | undefined): string {
	switch (reason) {
		case "invalid_role":
			return "Peran tidak valid.";
		case "invalid_name":
			return "Nama tidak valid.";
		case "invalid_phone":
			return "Nomor HP tidak valid.";
		case "not_found":
			return "Anggota tidak ditemukan.";
		case "locked":
			return "Data terkunci setelah acara selesai.";
		default:
			return "Gagal menyimpan. Coba lagi.";
	}
}

/** Tambah anggota baru (tanpa id) atau ubah yang sudah ada (dengan id). */
export async function upsertStaffMember(input: {
	id?: string;
	role: StaffRole;
	name: string;
	phone: string;
}): Promise<StaffMember> {
	const name = input.name.trim();
	if (name.length < 2) {
		throw new Error("Nama minimal 2 karakter.");
	}
	if (!isValidPhone(input.phone)) {
		throw new Error("Nomor HP tidak valid.");
	}
	const phone = normalizePhone(input.phone);

	if (get(demoMode)) {
		const current = await listStaffMembers();
		const existing = input.id
			? current.find((m) => m.id === input.id)
			: undefined;
		const member: StaffMember = {
			id: input.id ?? crypto.randomUUID(),
			role: input.role,
			name,
			phone,
			isActive: existing?.isActive ?? true,
			createdAt: existing?.createdAt ?? new Date(),
		};
		const next = existing
			? current.map((m) => (m.id === member.id ? member : m))
			: [...current, member];
		await saveLocalStaff(next);
		return member;
	}

	const { supabase } = await getSupabase();
	const { data, error } = await supabase.rpc("upsert_staff_member", {
		p_id: input.id ?? null,
		p_role: input.role,
		p_name: name,
		p_phone: phone,
	});
	if (error) {
		throw new Error(`upsertStaffMember: ${error.message}`);
	}
	const result = data as
		| { ok?: boolean; id?: string; reason?: string }
		| undefined;
	if (!result?.ok) {
		throw new Error(staffReasonMessage(result?.reason));
	}
	return {
		id: result.id ?? input.id ?? "",
		role: input.role,
		name,
		phone,
		isActive: true,
		createdAt: new Date(),
	};
}

/** Aktifkan/nonaktifkan anggota roster — soft delete, histori atribusi tetap terbaca. */
export async function setStaffActive(
	id: string,
	active: boolean,
): Promise<void> {
	if (get(demoMode)) {
		const current = await listStaffMembers();
		await saveLocalStaff(
			current.map((m) => (m.id === id ? { ...m, isActive: active } : m)),
		);
		return;
	}
	const { supabase } = await getSupabase();
	const { data, error } = await supabase.rpc("set_staff_active", {
		p_id: id,
		p_active: active,
	});
	if (error) {
		throw new Error(`setStaffActive: ${error.message}`);
	}
	const result = data as { ok?: boolean; reason?: string } | undefined;
	if (!result?.ok) {
		throw new Error(staffReasonMessage(result?.reason));
	}
}

/**
 * Login panitia/juri via 6 digit terakhir HP — dicocokkan ke roster aktif
 * per role. 0 match -> not_found, >1 match -> ambiguous (jangan pernah
 * menebak salah satu, minta hubungi admin).
 */
export async function staffLogin(
	role: StaffRole,
	last6: string,
): Promise<StaffLoginResult> {
	if (!/^\d{6}$/.test(last6)) {
		return { ok: false, reason: "invalid_last6" };
	}
	if (get(demoMode)) {
		const all = await listStaffMembers();
		const matches = all.filter(
			(m) =>
				m.role === role &&
				m.isActive &&
				m.phone.replace(/\D/g, "").slice(-6) === last6,
		);
		if (matches.length === 0) {
			return { ok: false, reason: "not_found" };
		}
		if (matches.length > 1) {
			return { ok: false, reason: "ambiguous" };
		}
		const match = matches[0];
		return { ok: true, staffId: match.id, name: match.name };
	}
	const { supabase } = await getSupabase();
	const { data, error } = await supabase.rpc("staff_login", {
		p_role: role,
		p_last6: last6,
	});
	if (error) {
		throw new Error(`staffLogin: ${error.message}`);
	}
	const result = data as
		| { ok?: boolean; staffId?: string; name?: string; reason?: string }
		| undefined;
	if (!result?.ok) {
		const reason = result?.reason;
		return {
			ok: false,
			reason:
				reason === "ambiguous" || reason === "invalid_last6"
					? reason
					: "not_found",
		};
	}
	return { ok: true, staffId: result.staffId ?? "", name: result.name ?? "" };
}

/** String identitas yang ditulis ke recordedBy/registeredBy/actorHash. */
export function formatStaffActor(staff: { id: string; name: string }): string {
	return `${staff.id}:${staff.name}`;
}
