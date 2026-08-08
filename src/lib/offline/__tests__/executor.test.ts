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
}));

const captured = vi.hoisted(() => ({
	inserts: [] as Array<{ table: string; row: Record<string, unknown> }>,
	deletes: [] as Array<{ table: string; column: string; value: unknown }>,
	updates: [] as Array<{ table: string; row: Record<string, unknown> }>,
	uploads: [] as string[],
	uploadError: null as Error | null,
}));

vi.mock("$lib/db/supabaseClient", () => ({
	supabase: {
		from: (table: string) => ({
			insert: (row: Record<string, unknown>) => {
				captured.inserts.push({ table, row });
				return {
					error: null,
					select: () => ({
						single: async () => ({ data: { id: "row-uuid-1" }, error: null }),
					}),
				};
			},
			update: (row: Record<string, unknown>) => ({
				eq: () => {
					captured.updates.push({ table, row });
					return { error: null };
				},
			}),
			delete: () => ({
				eq: (column: string, value: unknown) => {
					captured.deletes.push({ table, column, value });
					return { error: null };
				},
			}),
		}),
		storage: {
			from: () => ({
				upload: (path: string) => {
					captured.uploads.push(path);
					return { error: captured.uploadError };
				},
				getPublicUrl: (path: string) => ({
					data: { publicUrl: `https://cdn.test/${path}` },
				}),
			}),
		},
	},
}));

import { executeQueueEntry } from "$lib/offline/executor";
import type { QueueEntry } from "$lib/offline/queue";

function layanganEntry(payload: Record<string, unknown>): QueueEntry {
	return {
		idempotencyKey: "score-layangan:comp-aduan:participant-1:1",
		endpoint: "/rest/scores/layangan",
		payload,
		timestamp: 1,
		retries: 0,
		status: "pending",
	};
}

const PAYLOAD = {
	competitionId: "comp-aduan",
	participantId: "participant-1",
	round: 2,
	status: "menang",
	flightDurationMs: 84_250,
	recordedBy: "hash-juri",
	idempotencyKey: "idem-uuid-1",
};

describe("executor offline — skor layangan (QW-1/A26)", () => {
	beforeEach(() => {
		captured.inserts.length = 0;
		captured.deletes.length = 0;
	});

	it("drain antrean menulis flight_duration_ms ke scores_layangan", async () => {
		const result = await executeQueueEntry(layanganEntry(PAYLOAD));
		expect(result).toBe("ok");
		expect(captured.inserts).toHaveLength(1);
		expect(captured.inserts[0]).toEqual({
			table: "scores_layangan",
			row: {
				competition_id: "comp-aduan",
				participant_id: "participant-1",
				round: 2,
				status: "menang",
				flight_duration_ms: 84_250,
				recorded_by: "hash-juri",
				idempotency_key: "idem-uuid-1",
			},
		});
	});

	it("durasi null tetap ditulis null (tie-break konsisten dgn jalur live)", async () => {
		const result = await executeQueueEntry(
			layanganEntry({ ...PAYLOAD, flightDurationMs: null }),
		);
		expect(result).toBe("ok");
		expect(captured.inserts[0]?.row).toHaveProperty(
			"flight_duration_ms",
			null,
		);
	});
});

function deleteEntry(
	endpoint: string,
	payload: Record<string, unknown>,
): QueueEntry {
	return {
		idempotencyKey: `score-delete:${JSON.stringify(payload)}`,
		endpoint,
		payload,
		timestamp: 2,
		retries: 0,
		status: "pending",
	};
}

describe("executor offline — delete skor (QW-2/A25)", () => {
	beforeEach(() => {
		captured.inserts.length = 0;
		captured.deletes.length = 0;
	});

	it("tombstone dgn idempotencyKey → delete via kolom idempotency_key (mancing)", async () => {
		const result = await executeQueueEntry(
			deleteEntry("/rest/scores/mancing/delete", {
				idempotencyKey: "uuid-idem-1",
			}),
		);
		expect(result).toBe("ok");
		expect(captured.deletes).toEqual([
			{ table: "scores_mancing", column: "idempotency_key", value: "uuid-idem-1" },
		]);
	});

	it("tombstone dgn scoreId → delete via kolom id (mancing)", async () => {
		const result = await executeQueueEntry(
			deleteEntry("/rest/scores/mancing/delete", { scoreId: "db-uuid-9" }),
		);
		expect(result).toBe("ok");
		expect(captured.deletes).toEqual([
			{ table: "scores_mancing", column: "id", value: "db-uuid-9" },
		]);
	});

	it("tombstone dgn idempotencyKey → delete via kolom idempotency_key (layangan)", async () => {
		const result = await executeQueueEntry(
			deleteEntry("/rest/scores/layangan/delete", {
				idempotencyKey: "uuid-idem-2",
			}),
		);
		expect(result).toBe("ok");
		expect(captured.deletes).toEqual([
			{ table: "scores_layangan", column: "idempotency_key", value: "uuid-idem-2" },
		]);
	});

	it("tombstone dgn scoreId → delete via kolom id (layangan)", async () => {
		const result = await executeQueueEntry(
			deleteEntry("/rest/scores/layangan/delete", { scoreId: "db-uuid-8" }),
		);
		expect(result).toBe("ok");
		expect(captured.deletes).toEqual([
			{ table: "scores_layangan", column: "id", value: "db-uuid-8" },
		]);
	});
});


function paymentEntry(payload: Record<string, unknown>): QueueEntry {
	return {
		idempotencyKey: "payment:p-live-1:dp:1",
		endpoint: "/rest/payments",
		payload,
		timestamp: 3,
		retries: 0,
		status: "pending",
	};
}

const PAYMENT_PAYLOAD = {
	participantId: "p-live-1",
	competitionId: "c-1",
	method: "qris",
	amount: 25000,
	mode: "dp",
	isCash: false,
	proof: new Uint8Array([1, 2, 3]).buffer,
	proofMime: "image/jpeg",
};

describe("executor offline — pembayaran (QW-6/F15/A20)", () => {
	beforeEach(() => {
		captured.inserts.length = 0;
		captured.updates.length = 0;
		captured.uploads.length = 0;
		captured.uploadError = null;
	});

	it("gagal upload bukti → error (retry), tanpa insert pembayaran", async () => {
		captured.uploadError = new Error("storage gangguan");
		const result = await executeQueueEntry(paymentEntry(PAYMENT_PAYLOAD));
		expect(result).toBe("error");
		expect(captured.uploads).toHaveLength(1);
		expect(captured.inserts).toHaveLength(0);
	});

	it("upload sukses → insert dgn proof_image_url + update status peserta", async () => {
		const result = await executeQueueEntry(paymentEntry(PAYMENT_PAYLOAD));
		expect(result).toBe("ok");
		expect(captured.inserts).toHaveLength(1);
		expect(captured.inserts[0]?.table).toBe("participant_payments");
		expect(captured.inserts[0]?.row.proof_image_url).toContain(
			"https://cdn.test/proofs/p-live-1/",
		);
		expect(captured.updates).toHaveLength(1);
		expect(captured.updates[0]).toEqual({
			table: "participants",
			row: { status: "dp_paid" },
		});
	});

	it("pembayaran tunai → tanpa upload, insert verified tanpa bukti", async () => {
		const result = await executeQueueEntry(
			paymentEntry({
				...PAYMENT_PAYLOAD,
				method: "cash",
				isCash: true,
				proof: null,
				mode: "full",
			}),
		);
		expect(result).toBe("ok");
		expect(captured.uploads).toHaveLength(0);
		expect(captured.inserts[0]?.row).toMatchObject({
			proof_image_url: null,
			is_verified: true,
		});
		expect(captured.updates[0]?.row).toEqual({ status: "fully_paid" });
	});
});
