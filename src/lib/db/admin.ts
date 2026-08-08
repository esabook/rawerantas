import { get } from "svelte/store";
import {
	demoCompetitions,
	demoPaymentConfigs,
	demoPayments,
} from "$lib/demo/generator";
import { demoMode } from "$lib/demo/store";
import { sha256Hex } from "$lib/security/pin";
import { localClear, localGetAll, localPut, localStores } from "./localStore";
import type {
	Competition,
	Participant,
	ParticipantPayment,
	PaymentConfig,
} from "./queries";

const COMP_STORE = localStores.competitions;
const CONFIG_STORE = localStores.paymentConfigs;
const SPONSOR_STORE = localStores.sponsors;
const PAYMENT_STORE = localStores.payments;
const AUDIT_STORE = localStores.auditLogs;

export interface AuditRecord {
	id: string;
	action: string;
	entityType: string;
	entityId: string;
	actorHash: string;
	payload: Record<string, unknown> | null;
	idempotencyKey: string;
	createdAt: Date | string;
}

export interface PaymentWithMeta extends ParticipantPayment {
	participantName: string;
	competitionName: string;
}

/** Override kompetisi dari penyimpanan lokal admin (demo). */
export async function getLocalCompetitions(): Promise<
	Map<string, Competition>
> {
	const rows = await localGetAll<Competition>(COMP_STORE);
	return new Map(rows.map((c) => [c.id, c]));
}

export async function getLocalPaymentConfigs(): Promise<
	Map<string, PaymentConfig>
> {
	const rows = await localGetAll<PaymentConfig>(CONFIG_STORE);
	return new Map(rows.map((c) => [c.id, c]));
}

/** Gabungan seed + override lokal — dipakai admin DAN panel lain (round advance harus terlihat juri). */
export async function getMergedCompetitions(
	activeOnly = true,
): Promise<Competition[]> {
	const [local, seed] = await Promise.all([
		getLocalCompetitions(),
		Promise.resolve(demoCompetitions()),
	]);
	const merged = seed.map((c) => local.get(c.id) ?? c);
	return activeOnly ? merged.filter((c) => c.isActive) : merged;
}

export async function getMergedPaymentConfigs(
	activeOnly = true,
): Promise<PaymentConfig[]> {
	const [local, seed] = await Promise.all([
		getLocalPaymentConfigs(),
		Promise.resolve(demoPaymentConfigs()),
	]);
	const merged = seed.map((c) => local.get(c.id) ?? c);
	return activeOnly ? merged.filter((c) => c.isActive) : merged;
}

export async function saveCompetition(
	competition: Competition,
	actorHash: string,
): Promise<void> {
	if (get(demoMode)) {
		await localPut(COMP_STORE, competition);
		await audit("save_competition", "competitions", competition.id, actorHash, {
			name: competition.name,
			isActive: competition.isActive,
			currentRound: competition.currentRound,
		});
		return;
	}
	const { supabase } = await import("./supabaseClient");
	const { error } = await supabase
		.from("competitions")
		.update({
			name: competition.name,
			fee: competition.fee,
			total_quota: competition.totalQuota,
			scoring_mode: competition.scoringMode,
			is_active: competition.isActive,
			current_round: competition.currentRound,
		})
		.eq("id", competition.id);
	if (error) {
		throw new Error(`saveCompetition: ${error.message}`);
	}
	await audit("save_competition", "competitions", competition.id, actorHash, {
		name: competition.name,
		isActive: competition.isActive,
		currentRound: competition.currentRound,
	});
}

export async function savePaymentConfig(
	config: PaymentConfig,
	actorHash: string,
): Promise<void> {
	if (get(demoMode)) {
		await localPut(CONFIG_STORE, config);
		await audit(
			"save_payment_config",
			"payment_configs",
			config.id,
			actorHash,
			{
				method: config.method,
				isActive: config.isActive,
			},
		);
		return;
	}
	const { supabase } = await import("./supabaseClient");
	const { error } = await supabase
		.from("payment_configs")
		.update({
			account_name: config.accountName,
			account_number: config.accountNumber,
			qris_image_url: config.qrisImageUrl,
			instructions: config.instructions,
			is_active: config.isActive,
		})
		.eq("id", config.id);
	if (error) {
		throw new Error(`savePaymentConfig: ${error.message}`);
	}
	await audit("save_payment_config", "payment_configs", config.id, actorHash, {
		method: config.method,
		isActive: config.isActive,
	});
}

/**
 * Advance round: hanya untuk mode `layangan_aduan`. Board layangan reset
 * otomatis karena panel juri membaca `current_round` kompetisi.
 */
export async function advanceRound(
	competitionId: string,
	actorHash: string,
): Promise<{ ok: boolean; round: number }> {
	const merged = await getMergedCompetitions(false);
	const competition = merged.find((c) => c.id === competitionId);
	if (!competition) {
		throw new Error("Kompetisi tidak ditemukan.");
	}
	if (competition.scoringMode !== "layangan_aduan") {
		throw new Error("Advance round hanya untuk mode aduan layangan.");
	}
	const next = {
		...competition,
		currentRound: competition.currentRound + 1,
	};
	await saveCompetition(next, actorHash);
	return { ok: true, round: next.currentRound };
}

export async function resetDemoAdminState(): Promise<void> {
	await Promise.all([
		localClear(COMP_STORE),
		localClear(CONFIG_STORE),
		localClear(SPONSOR_STORE),
	]);
}

/** Hash PIN admin sebagai actor hash untuk audit (`verified_by`/`recorded_by`). */
export async function adminActorHash(): Promise<string> {
	const { pinForKind } = await import("$lib/security/pin");
	return sha256Hex(pinForKind("admin"));
}

async function audit(
	action: string,
	entityType: string,
	entityId: string,
	actorHash: string,
	payload: Record<string, unknown> | null,
): Promise<void> {
	const record: AuditRecord = {
		id: crypto.randomUUID(),
		action,
		entityType,
		entityId,
		actorHash,
		payload,
		idempotencyKey: crypto.randomUUID(),
		createdAt: new Date(),
	};
	if (get(demoMode)) {
		await localPut(AUDIT_STORE, record);
		return;
	}
	const { supabase } = await import("./supabaseClient");
	const { error } = await supabase.from("audit_logs").insert({
		action,
		entity_type: entityType,
		entity_id: entityId,
		actor_hash: actorHash,
		payload,
		idempotency_key: record.idempotencyKey,
	});
	if (error) {
		throw new Error(`audit: ${error.message}`);
	}
}

/** Semua audit lokal (demo) — urutan terbaru dulu. */
export async function demoAuditLogs(): Promise<AuditRecord[]> {
	const rows = await localGetAll<AuditRecord>(AUDIT_STORE);
	return rows.sort(
		(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
	);
}

/** Gabungan payment seed + lokal (demo), diperkaya nama peserta & lomba. */
export async function getMergedPayments(): Promise<PaymentWithMeta[]> {
	if (!get(demoMode)) {
		const { getCompetitions, getParticipants, getPayments } = await import(
			"./queries"
		);
		const [payments, participants, competitions] = await Promise.all([
			getPayments(),
			getParticipants(),
			getCompetitions(false),
		]);
		const participantMap = new Map(participants.map((p) => [p.id, p]));
		return payments.map((payment) => {
			const participant = participantMap.get(payment.participantId);
			return {
				...payment,
				participantName: participant?.name ?? "-",
				competitionName:
					competitions.find((c) => c.id === participant?.competitionId)?.name ??
					"-",
			};
		});
	}
	const [local, seed, localParticipants, seedParticipants, competitions] =
		await Promise.all([
			localGetAll<ParticipantPayment>(PAYMENT_STORE),
			Promise.resolve(demoPayments()),
			import("./register").then(({ demoLocalParticipants }) =>
				demoLocalParticipants(),
			),
			import("./queries").then(({ getParticipants }) => getParticipants()),
			getMergedCompetitions(false),
		]);
	const participants = [...localParticipants, ...seedParticipants].reduce<
		Map<string, Participant>
	>((acc, p) => {
		acc.set(p.id, p);
		return acc;
	}, new Map());
	const merged = [...local, ...seed].reduce<Map<string, ParticipantPayment>>(
		(acc, p) => {
			acc.set(p.id, p);
			return acc;
		},
		new Map(),
	);
	return [...merged.values()].map((p) => {
		const participant = participants.get(p.participantId);
		return {
			...p,
			participantName: participant?.name ?? "—",
			competitionName:
				competitions.find((c) => c.id === participant?.competitionId)?.name ??
				"—",
		};
	});
}

/** Payment belum diverifikasi — untuk dashboard admin. */
export async function getUnverifiedPayments(): Promise<PaymentWithMeta[]> {
	const all = await getMergedPayments();
	return all.filter((p) => !p.isVerified);
}

export interface PanitiaParticipant {
	participant: Participant;
	competitionName: string;
	totalPaid: number;
	paidStatus: "none" | "dp" | "full";
	paymentMethods: string[];
	checkedIn: boolean;
	checkedInAt: Date | null;
}

/** Peserta + info pembayaran & check-in untuk tab panitia di admin. */
export async function getPanitiaParticipants(): Promise<PanitiaParticipant[]> {
	const isDemo = get(demoMode);
	const { getCompetitions, getParticipants, getPayments } = await import(
		"./queries"
	);
	const [participants, payments, competitions] = await Promise.all([
		getParticipants(),
		getPayments(),
		getCompetitions(false),
	]);
	const checkedInIds = new Set<string>();
	if (isDemo) {
		const { localGetAll, localStores } = await import("./localStore");
		const checkins = await localGetAll<{ participantId: string }>(
			localStores.checkins,
		);
		for (const c of checkins) {
			checkedInIds.add(c.participantId);
		}
	}
	const competitionNameMap = new Map(competitions.map((c) => [c.id, c.name]));
	const paymentsByParticipant = new Map<string, ParticipantPayment[]>();
	for (const p of payments) {
		const list = paymentsByParticipant.get(p.participantId) ?? [];
		list.push(p);
		paymentsByParticipant.set(p.participantId, list);
	}
	return participants.map((participant) => {
		const participantPayments = paymentsByParticipant.get(participant.id) ?? [];
		const verified = participantPayments.filter(
			(p) => p.isVerified && !p.rejectReason?.trim(),
		);
		const totalPaid = verified.reduce((sum, p) => sum + Number(p.amount), 0);
		const methods = [
			...new Set(participantPayments.map((p) => p.paymentMethod)),
		];
		const competition = participant.competitionId
			? competitionNameMap.get(participant.competitionId)
			: undefined;
		// status lunas: pakai status peserta (dp_paid/fully_paid)
		const paidStatus: "none" | "dp" | "full" =
			participant.status === "fully_paid"
				? "full"
				: participant.status === "dp_paid"
					? "dp"
					: "none";
		const checkedIn =
			participant.status === "checked_in" || checkedInIds.has(participant.id);
		return {
			participant,
			competitionName: competition ?? "—",
			totalPaid,
			paidStatus,
			paymentMethods: methods,
			checkedIn,
			checkedInAt: participant.checkedInAt ?? null,
		};
	});
}

/** Undo check-in panitia (set kembali ke dp_paid/fully_paid). */
export async function undoCheckIn(participantId: string): Promise<void> {
	if (get(demoMode)) {
		const { localDelete, localStores } = await import("./localStore");
		await localDelete(localStores.checkins, participantId);
		return;
	}
	const { getSupabase } = await import("./queries");
	const { supabase } = await getSupabase();
	const { error } = await supabase
		.from("participants")
		.update({ status: "dp_paid", checked_in_at: null })
		.eq("id", participantId);
	if (error) {
		throw new Error(`undoCheckIn: ${error.message}`);
	}
}

async function recalcParticipantStatus(participantId: string): Promise<void> {
	const { getPayments } = await import("./queries");
	const { demoLocalParticipants } = await import("./register");
	const [payments, local] = await Promise.all([
		getPayments(participantId),
		demoLocalParticipants(),
	]);
	const verifiedTotal = payments
		.filter((p) => p.isVerified)
		.reduce((sum, p) => sum + Number(p.amount), 0);
	const participant = local.find((p) => p.id === participantId);
	if (!participant) {
		return;
	}
	const { getCompetitions } = await import("./queries");
	const competitions = await getCompetitions(false);
	const fee =
		competitions.find((c) => c.id === participant.competitionId)?.fee ?? 0;
	const minDp =
		competitions.find((c) => c.id === participant.competitionId)?.minDp ?? 0;
	const nextStatus =
		participant.status === "disqualified" || participant.status === "checked_in"
			? participant.status
			: verifiedTotal >= fee
				? "fully_paid"
				: verifiedTotal >= minDp
					? "dp_paid"
					: "registered";
	const next: Participant = {
		...participant,
		status: nextStatus,
	};
	await localPut(localStores.registrations, next);
}

/**
 * Verifikasi pembayaran (demo + live). Demo: update payment lokal +
 * status peserta (lunas → fully_paid) + catat audit.
 */
export async function verifyPayment(
	paymentId: string,
	actorHash: string,
): Promise<{ ok: boolean; status: string }> {
	if (get(demoMode)) {
		const payments = await localGetAll<ParticipantPayment>(PAYMENT_STORE);
		const payment = payments.find((p) => p.id === paymentId);
		if (!payment) {
			throw new Error("Pembayaran tidak ditemukan.");
		}
		const updated = {
			...payment,
			isVerified: true,
			verifiedBy: actorHash,
			rejectReason: null,
		};
		await localPut(PAYMENT_STORE, updated);
		await recalcParticipantStatus(payment.participantId);
		await audit(
			"verify_payment",
			"participant_payments",
			paymentId,
			actorHash,
			{ participantId: payment.participantId, amount: payment.amount },
		);
		return { ok: true, status: "verified" };
	}
	const { supabase } = await import("./supabaseClient");
	const { error } = await supabase
		.from("participant_payments")
		.update({ is_verified: true, verified_by: actorHash, reject_reason: null })
		.eq("id", paymentId);
	if (error) {
		throw new Error(`verifyPayment: ${error.message}`);
	}
	await audit("verify_payment", "participant_payments", paymentId, actorHash, {
		actorHash,
	});
	return { ok: true, status: "verified" };
}

/** Tolak pembayaran dengan alasan (demo + live). */
export async function rejectPayment(
	paymentId: string,
	actorHash: string,
	reason: string,
): Promise<{ ok: boolean; status: string }> {
	if (get(demoMode)) {
		const payments = await localGetAll<ParticipantPayment>(PAYMENT_STORE);
		const payment = payments.find((p) => p.id === paymentId);
		if (!payment) {
			throw new Error("Pembayaran tidak ditemukan.");
		}
		await localPut(PAYMENT_STORE, {
			...payment,
			isVerified: false,
			verifiedBy: null,
			rejectReason: reason,
		});
		await recalcParticipantStatus(payment.participantId);
		await audit(
			"reject_payment",
			"participant_payments",
			paymentId,
			actorHash,
			{ participantId: payment.participantId, reason },
		);
		return { ok: true, status: "rejected" };
	}
	const { supabase } = await import("./supabaseClient");
	const { error } = await supabase
		.from("participant_payments")
		.update({ is_verified: false, verified_by: null, reject_reason: reason })
		.eq("id", paymentId);
	if (error) {
		throw new Error(`rejectPayment: ${error.message}`);
	}
	await audit("reject_payment", "participant_payments", paymentId, actorHash, {
		reason,
	});
	return { ok: true, status: "rejected" };
}
