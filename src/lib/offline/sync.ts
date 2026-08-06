import { markFailed, markSynced, peekBatch, type QueueEntry } from "./queue";

export type SyncResult = "ok" | "conflict" | "error";
export type ExecuteOp = (entry: QueueEntry) => Promise<SyncResult>;

export interface SyncOutcome {
	synced: number;
	failed: number;
	dead: number;
}

export async function runSyncOnce(
	execute: ExecuteOp,
	limit = 10,
): Promise<SyncOutcome> {
	const batch = await peekBatch(limit);
	const outcome: SyncOutcome = { synced: 0, failed: 0, dead: 0 };
	for (const entry of batch) {
		try {
			const result = await execute(entry);
			if (result === "ok" || result === "conflict") {
				await markSynced(entry.idempotencyKey);
				outcome.synced += 1;
			} else {
				const status = await markFailed(entry.idempotencyKey);
				if (status === "dead") {
					outcome.dead += 1;
				} else {
					outcome.failed += 1;
				}
			}
		} catch {
			const status = await markFailed(entry.idempotencyKey);
			if (status === "dead") {
				outcome.dead += 1;
			} else {
				outcome.failed += 1;
			}
		}
	}
	return outcome;
}

export interface Tombstone {
	targetId: string;
	participantId: string;
	weightRemoved: number;
}

export interface ScoreRowLite {
	id: string;
	participantId: string;
	weight: number;
	receivedAt: number;
	runningTotal: number;
}

export function applyTombstones(
	rows: ScoreRowLite[],
	tombstones: Tombstone[],
): ScoreRowLite[] {
	const removed = new Set(tombstones.map((t) => t.targetId));
	const remaining = rows.filter((row) => !removed.has(row.id));

	const byParticipant = new Map<string, ScoreRowLite[]>();
	for (const row of remaining) {
		const bucket = byParticipant.get(row.participantId);
		if (bucket) {
			bucket.push(row);
		} else {
			byParticipant.set(row.participantId, [row]);
		}
	}
	for (const rowsOf of byParticipant.values()) {
		let total = 0;
		for (const row of rowsOf.sort((a, b) => a.receivedAt - b.receivedAt)) {
			total += row.weight;
			row.runningTotal = total;
		}
	}
	return remaining;
}

export interface DraftLookupResult {
	exists: boolean;
	ticketNumber: string | null;
}

export type DraftLookup = (phone: string) => Promise<DraftLookupResult>;

export async function checkDraftRestore(
	entry: QueueEntry,
	lookup: DraftLookup,
): Promise<boolean> {
	const phone = (entry.payload as { phone?: unknown } | undefined)?.phone;
	if (typeof phone !== "string" || phone.length === 0) {
		return false;
	}
	const found = await lookup(phone);
	return found.exists;
}
