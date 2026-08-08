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
}));

vi.mock("$lib/db/supabaseClient", () => ({
	supabase: {
		from: (table: string) => ({
			insert: (row: Record<string, unknown>) => {
				captured.inserts.push({ table, row });
				return { error: null };
			},
		}),
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
