import "fake-indexeddb/auto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getParticipantById } from "$lib/db/queries";
import { registerParticipant, resetDemoRegistrations } from "$lib/db/register";
import { demoCompetitions } from "$lib/demo/generator";
import { setDemoMode } from "$lib/demo/store";
import { clearQueue, peekBatch } from "$lib/offline/queue";

/** Supabase tiruan utk jalur live register (B1-4). */
const sb = vi.hoisted(() => ({
	rpcResult: {
		ok: true,
		participantId: "p-live-1",
		ticketNumber: "T-000123",
		duplicated: false,
	} as Record<string, unknown>,
	rpcError: null as Error | null,
	rpcs: [] as Array<{ fn: string; args: Record<string, unknown> }>,
}));

vi.mock("$lib/db/supabaseClient", () => ({
	supabase: {
		removeAllChannels: () => {},
		rpc: (fn: string, args: Record<string, unknown>) => {
			sb.rpcs.push({ fn, args });
			if (sb.rpcError) throw sb.rpcError;
			return { data: sb.rpcResult, error: null };
		},
	},
}));

describe("getParticipantById (demo)", () => {
	beforeEach(async () => {
		await setDemoMode(true);
		await resetDemoRegistrations();
	});
	it("menemukan peserta seed", async () => {
		const seeded = demoCompetitions();
		expect(seeded.length).toBeGreaterThan(0);
		const { getParticipants } = await import("$lib/db/queries");
		const all = await getParticipants();
		expect(all.length).toBeGreaterThan(0);
		const p = await getParticipantById(all[0].id);
		expect(p?.id).toBe(all[0].id);
	});

	it("menemukan peserta yang baru didaftarkan", async () => {
		const res = await registerParticipant({
			competitionId: demoCompetitions()[0].id,
			name: "Cicak",
			phone: "081234567890",
		});
		const p = await getParticipantById(res.participantId);
		expect(p?.name).toBe("Cicak");
		expect(p?.ticketNumber).toBe(res.ticketNumber);
	});

	it("mengembalikan null untuk id tak dikenal", async () => {
		expect(await getParticipantById("tidak-ada")).toBeNull();
	});
});

describe("registerParticipant live via RPC (B1-4)", () => {
	beforeEach(async () => {
		sb.rpcResult = {
			ok: true,
			participantId: "p-live-1",
			ticketNumber: "T-000123",
			duplicated: false,
		};
		sb.rpcError = null;
		sb.rpcs.length = 0;
		await clearQueue();
		await setDemoMode(false);
	});

	afterAll(async () => {
		await clearQueue();
		await setDemoMode(true);
	});

	it("RPC register_participant dipanggil dgn phone ternormalisasi + idempotency", async () => {
		const res = await registerParticipant({
			competitionId: "c-1",
			name: "Ana Live",
			phone: "081234567890",
		});
		expect(res).toEqual({
			participantId: "p-live-1",
			ticketNumber: "T-000123",
			duplicated: false,
			queued: false,
		});
		expect(sb.rpcs.at(-1)?.fn).toBe("register_participant");
		expect(sb.rpcs.at(-1)?.args).toMatchObject({
			p_competition: "c-1",
			p_name: "Ana Live",
			p_phone: "+6281234567890",
		});
		expect(sb.rpcs.at(-1)?.args.p_idempotency_key).toBeTruthy();
	});

	it("RPC duplicated true → return duplicated tanpa antrean", async () => {
		sb.rpcResult = {
			ok: true,
			participantId: "p-live-1",
			ticketNumber: "T-000123",
			duplicated: true,
		};
		const res = await registerParticipant({
			competitionId: "c-1",
			name: "Ana Live",
			phone: "081234567890",
		});
		expect(res.duplicated).toBe(true);
		expect(res.queued).toBe(false);
	});

	it("RPC quota_full → QuotaFullError dilempar", async () => {
		sb.rpcResult = { ok: false, reason: "quota_full" };
		await expect(
			registerParticipant({
				competitionId: "c-1",
				name: "Ana Live",
				phone: "081234567890",
			}),
		).rejects.toThrow("Kuota");
	});

	it("RPC gagal offline → antrean; kunci antrean == idempotency RPC", async () => {
		sb.rpcError = new TypeError("Failed to fetch");
		const res = await registerParticipant({
			competitionId: "c-1",
			name: "Ana Live",
			phone: "081234567890",
		});
		expect(res.queued).toBe(true);
		const entries = await peekBatch(10);
		expect(entries).toHaveLength(1);
		expect(entries[0]?.endpoint).toBe("/rest/participants");
		expect(entries[0]?.idempotencyKey).toBe(sb.rpcs[0]?.args.p_idempotency_key);
	});
});
