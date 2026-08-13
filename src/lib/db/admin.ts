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
const LOCK_STORE = localStores.dataLock;

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
	participantPhone: string;
	participantTicket: string;
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
			min_dp: competition.minDp,
			total_quota: competition.totalQuota,
			scoring_mode: competition.scoringMode,
			is_active: competition.isActive,
			current_round: competition.currentRound,
			event_date: competition.eventDate,
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
	opts?: { force?: boolean },
): Promise<{ ok: boolean; round: number; unjudged?: number }> {
	const merged = await getMergedCompetitions(false);
	const competition = merged.find((c) => c.id === competitionId);
	if (!competition) {
		throw new Error("Kompetisi tidak ditemukan.");
	}
	if (competition.scoringMode !== "layangan_aduan") {
		throw new Error("Advance round hanya untuk mode aduan layangan.");
	}
	// B4-1/A15: hitung peserta belum dinilai pada babak aktif.
	const { getParticipants } = await import("./queries");
	const { getAllLayanganScores } = await import("./layangan");
	const [participants, scores] = await Promise.all([
		getParticipants(competitionId),
		getAllLayanganScores(competitionId),
	]);
	const scoredIds = new Set(
		scores
			.filter((s) => s.round === competition.currentRound)
			.map((s) => s.participantId),
	);
	const unjudged = participants.filter((p) => !scoredIds.has(p.id)).length;
	if (unjudged > 0 && !opts?.force) {
		return { ok: false, round: competition.currentRound, unjudged };
	}
	const next = {
		...competition,
		currentRound: competition.currentRound + 1,
	};
	await saveCompetition(next, actorHash);
	return { ok: true, round: next.currentRound, unjudged };
}

/**
 * Timer bersama per babak: juri tekan "Mulai Lomba" sekali, semua peserta
 * babak itu baca titik mulai yang sama (bukan timer per-kartu-peserta).
 * Update 3 kolom sempit saja — TIDAK lewat saveCompetition (yg menulis
 * seluruh field admin dari snapshot in-memory pemanggil; berisiko menimpa
 * edit admin yang konkuren dalam jendela polling ~30 detik yang sama).
 */
export async function startRound(
	competitionId: string,
	round: number,
	startedBy: string,
): Promise<{ queued: boolean; startedAt: string }> {
	const startedAt = new Date().toISOString();
	if (get(demoMode)) {
		const merged = await getMergedCompetitions(false);
		const competition = merged.find((c) => c.id === competitionId);
		if (!competition) {
			throw new Error("Kompetisi tidak ditemukan.");
		}
		await localPut(COMP_STORE, {
			...competition,
			roundStartedAt: startedAt,
			roundStartedRound: round,
			roundStartedBy: startedBy,
		});
		return { queued: false, startedAt };
	}
	try {
		const { supabase } = await import("./supabaseClient");
		const { data, error } = await supabase.rpc("start_round", {
			p_competition_id: competitionId,
			p_round: round,
			p_started_at: startedAt,
			p_started_by: startedBy,
		});
		if (error) {
			throw error;
		}
		const result = data as { ok?: boolean; reason?: string } | undefined;
		if (!result?.ok) {
			throw new Error(
				result?.reason === "locked"
					? "Data terkunci — semua tulis diblokir."
					: "Kompetisi tidak ditemukan.",
			);
		}
		return { queued: false, startedAt };
	} catch (e) {
		const { isOfflineError } = await import("$lib/offline/networkStore");
		if (!isOfflineError(e)) {
			throw e;
		}
		const { enqueue } = await import("$lib/offline/queue");
		await enqueue(
			`round-start:${competitionId}:${round}:${startedAt}`,
			"/rest/competitions/start-round",
			{ competitionId, round, startedAt, startedBy },
		);
		return { queued: true, startedAt };
	}
}

/**
 * Tutup timer babak — kebalikan startRound, sengaja TIDAK dicek data_lock
 * (beres-beres timer yang sudah jalan harus selalu bisa dilakukan juri).
 */
export async function stopRound(
	competitionId: string,
): Promise<{ queued: boolean }> {
	if (get(demoMode)) {
		const merged = await getMergedCompetitions(false);
		const competition = merged.find((c) => c.id === competitionId);
		if (!competition) {
			throw new Error("Kompetisi tidak ditemukan.");
		}
		await localPut(COMP_STORE, {
			...competition,
			roundStartedAt: null,
			roundStartedRound: null,
			roundStartedBy: null,
		});
		return { queued: false };
	}
	try {
		const { supabase } = await import("./supabaseClient");
		const { data, error } = await supabase.rpc("stop_round", {
			p_competition_id: competitionId,
		});
		if (error) {
			throw error;
		}
		const result = data as { ok?: boolean; reason?: string } | undefined;
		if (!result?.ok) {
			throw new Error("Kompetisi tidak ditemukan.");
		}
		return { queued: false };
	} catch (e) {
		const { isOfflineError } = await import("$lib/offline/networkStore");
		if (!isOfflineError(e)) {
			throw e;
		}
		const { enqueue } = await import("$lib/offline/queue");
		await enqueue(
			`round-stop:${competitionId}:${Date.now()}`,
			"/rest/competitions/stop-round",
			{ competitionId },
		);
		return { queued: true };
	}
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
	// B2-7/A34: audit best-effort di jalur live — kegagalan audit TIDAK boleh
	// membatalkan mutasi utama yang sudah sukses (hindari error palsu + retry
	// ganda). Kegagalan dicatat ke konsol; audit penting (verify/reject) sudah
	// ditulis dalam transaksi RPC (B1-3).
	if (error) {
		console.warn(`[audit] ${action} gagal dicatat: ${error.message}`);
	}
}

/** Semua audit lokal (demo) — urutan terbaru dulu. */
export async function demoAuditLogs(): Promise<AuditRecord[]> {
	const rows = await localGetAll<AuditRecord>(AUDIT_STORE);
	return rows.sort(
		(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
	);
}

/**
 * Gabungan payment seed + lokal (demo), diperkaya nama peserta & lomba.
 *
 * `preloaded` (mode live saja): lewatkan participants/competitions yang
 * sudah di-fetch caller (mis. AdminPanel.load()) supaya tidak fetch ulang
 * tabel yang sama — di 5000 peserta tiap fetch ulang itu beberapa halaman
 * `.range()`.
 */
export async function getMergedPayments(preloaded?: {
	participants?: Participant[];
	competitions?: Competition[];
}): Promise<PaymentWithMeta[]> {
	if (!get(demoMode)) {
		const { getCompetitions, getParticipants, getPayments } = await import(
			"./queries"
		);
		const [payments, participants, competitions] = await Promise.all([
			getPayments(),
			preloaded?.participants ?? getParticipants(),
			preloaded?.competitions ?? getCompetitions(false),
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
				participantPhone: participant?.phone ?? "",
				participantTicket: participant?.ticketNumber ?? "",
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
			participantPhone: participant?.phone ?? "",
			participantTicket: participant?.ticketNumber ?? "",
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

/**
 * Peserta + info pembayaran & check-in untuk tab panitia di admin.
 *
 * `preloaded`: lewatkan participants/payments/competitions yang sudah
 * di-fetch caller (mis. AdminPanel.load(), yang juga memanggil
 * getMergedPayments() dengan tabel yang sama) supaya tidak fetch ulang.
 */
export async function getPanitiaParticipants(preloaded?: {
	participants?: Participant[];
	payments?: ParticipantPayment[];
	competitions?: Competition[];
}): Promise<PanitiaParticipant[]> {
	const isDemo = get(demoMode);
	const { getCompetitions, getParticipants, getPayments } = await import(
		"./queries"
	);
	const [participants, payments, competitions] = await Promise.all([
		preloaded?.participants ?? getParticipants(),
		preloaded?.payments ?? getPayments(),
		preloaded?.competitions ?? getCompetitions(false),
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

/** Undo check-in panitia (set kembali ke status bayar terverifikasi) + audit. */
export async function undoCheckIn(
	participantId: string,
	actorHash: string,
): Promise<void> {
	if (get(demoMode)) {
		const { localDelete, localStores } = await import("./localStore");
		await localDelete(localStores.checkins, participantId);
		// A21: undo check-in tidak boleh tanpa jejak — audit demo.
		await audit(
			"undo_check_in",
			"participants",
			participantId,
			actorHash,
			null,
		);
		return;
	}
	// B2-6/F11/A9: jangan hardcode dp_paid — hitung ulang status dari total
	// terverifikasi (fee vs total), seperti recalc di RPC.
	const { getSupabase, getPayments, getCompetitions, getParticipantById } =
		await import("./queries");
	const { supabase } = await getSupabase();
	const [payments, participant, competitions] = await Promise.all([
		getPayments(participantId),
		getParticipantById(participantId),
		getCompetitions(false),
	]);
	const verifiedTotal = payments
		.filter((p) => p.isVerified && !p.rejectReason?.trim())
		.reduce((s, p) => s + Number(p.amount), 0);
	const comp = competitions.find((c) => c.id === participant?.competitionId);
	const fee = comp?.fee ?? 0;
	const minDp = comp?.minDp ?? 0;
	const status =
		verifiedTotal >= fee
			? "fully_paid"
			: verifiedTotal >= minDp
				? "dp_paid"
				: "registered";
	const { error } = await supabase
		.from("participants")
		.update({ status, checked_in_at: null })
		.eq("id", participantId);
	if (error) {
		throw new Error(`undoCheckIn: ${error.message}`);
	}
	// A21: audit undo check-in (best-effort, pola audit()).
	await audit("undo_check_in", "participants", participantId, actorHash, {
		status,
	});
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
 * QW-5/A11: verifikasi non-tunai wajib punya bukti transfer. Tunai dikecualikan
 * (bukti fisik dipegang panitia; baris tunai biasanya sudah verified saat insert).
 */
function assertProofForVerify(
	paymentMethod: string | null,
	proofImageUrl: string | null,
): void {
	if (paymentMethod === "cash") return;
	if (!proofImageUrl || proofImageUrl.trim().length === 0) {
		throw new Error(
			"Verifikasi ditolak: bukti pembayaran tidak ada. Minta peserta unggah bukti atau tolak pembayaran.",
		);
	}
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
		// B1-3/A33: hanya pending/rejected yang boleh diverifikasi.
		if (payment.isVerified) {
			throw new Error("Pembayaran sudah terverifikasi.");
		}
		assertProofForVerify(payment.paymentMethod, payment.proofImageUrl);
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
	const { data: row, error: fetchError } = await supabase
		.from("participant_payments")
		.select("payment_method, proof_image_url")
		.eq("id", paymentId)
		.maybeSingle();
	if (fetchError) {
		throw new Error(`verifyPayment: ${fetchError.message}`);
	}
	if (!row) {
		throw new Error("Pembayaran tidak ditemukan.");
	}
	const liveRow = row as {
		payment_method: string | null;
		proof_image_url: string | null;
	};
	assertProofForVerify(liveRow.payment_method, liveRow.proof_image_url);
	// B1-3: verifikasi via RPC — guard state, recalc status, & audit dalam satu
	// transaksi server (F5/A2/A33/A34).
	const { data, error } = await supabase.rpc("verify_payment", {
		p_payment_id: paymentId,
		p_actor_hash: actorHash,
	});
	if (error) {
		throw new Error(`verifyPayment: ${error.message}`);
	}
	const result = data as { ok?: boolean; reason?: string } | undefined;
	if (!result?.ok) {
		throw new Error(verifyRpcMessage(result?.reason));
	}
	return { ok: true, status: "verified" };
}

/** Pesan ramah utk reason penolakan RPC `verify_payment`. */
function verifyRpcMessage(reason: string | undefined): string {
	switch (reason) {
		case "payment_not_found":
			return "Pembayaran tidak ditemukan.";
		case "already_verified":
			return "Pembayaran sudah terverifikasi.";
		case "no_proof":
			return "Verifikasi ditolak: bukti pembayaran tidak ada.";
		case "locked":
			return "Data terkunci setelah acara selesai. Verifikasi ditutup.";
		default:
			return "Verifikasi ditolak server. Coba lagi.";
	}
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
		// B1-3/A33: baris terverifikasi tidak boleh ditolak.
		if (payment.isVerified) {
			throw new Error(
				"Pembayaran sudah terverifikasi dan tidak dapat ditolak.",
			);
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
	// B1-3: tolak via RPC — guard state, recalc status, & audit satu transaksi.
	const { data, error } = await supabase.rpc("reject_payment", {
		p_payment_id: paymentId,
		p_actor_hash: actorHash,
		p_reason: reason,
	});
	if (error) {
		throw new Error(`rejectPayment: ${error.message}`);
	}
	const result = data as { ok?: boolean; reason?: string } | undefined;
	if (!result?.ok) {
		throw new Error(rejectRpcMessage(result?.reason));
	}
	return { ok: true, status: "rejected" };
}

/** Pesan ramah utk reason penolakan RPC `reject_payment`. */
function rejectRpcMessage(reason: string | undefined): string {
	switch (reason) {
		case "payment_not_found":
			return "Pembayaran tidak ditemukan.";
		case "already_verified":
			return "Pembayaran sudah terverifikasi dan tidak dapat ditolak.";
		case "invalid_reason":
			return "Alasan penolakan wajib diisi.";
		case "locked":
			return "Data terkunci setelah acara selesai. Penolakan ditutup.";
		default:
			return "Penolakan ditolak server. Coba lagi.";
	}
}

export interface DataLockState {
	locked: boolean;
	lockedAt: Date | null;
	lockedBy: string | null;
}

/** Baca status data lock (demo: lokal; live: via RPC/get). */
export async function getDataLock(): Promise<DataLockState> {
	if (get(demoMode)) {
		const rows = await localGetAll<DataLockState & { id: string }>(LOCK_STORE);
		const row = rows.find((r) => r.id === "lock");
		return row
			? {
					locked: row.locked,
					lockedAt: row.lockedAt ?? null,
					lockedBy: row.lockedBy ?? null,
				}
			: { locked: false, lockedAt: null, lockedBy: null };
	}
	const { supabase } = await import("./supabaseClient");
	const { data, error } = await supabase
		.from("data_lock")
		.select("is_locked, locked_at, locked_by")
		.limit(1)
		.maybeSingle();
	if (error) {
		throw new Error(`getDataLock: ${error.message}`);
	}
	const row = data as
		| { is_locked: boolean; locked_at: string | null; locked_by: string | null }
		| undefined;
	return {
		locked: row?.is_locked ?? false,
		lockedAt: row?.locked_at ? new Date(row.locked_at) : null,
		lockedBy: row?.locked_by ?? null,
	};
}

/** Setel/lepas data lock (demo: lokal; live: via RPC set_data_lock + audit). */
export async function setDataLock(
	locked: boolean,
	actorHash: string,
): Promise<DataLockState> {
	if (get(demoMode)) {
		const state: DataLockState & { id: string } = {
			id: "lock",
			locked,
			lockedAt: locked ? new Date() : null,
			lockedBy: locked ? actorHash : null,
		};
		await localPut(LOCK_STORE, state);
		return state;
	}
	const { supabase } = await import("./supabaseClient");
	const { data, error } = await supabase.rpc("set_data_lock", {
		p_locked: locked,
		p_actor_hash: actorHash,
	});
	if (error) {
		throw new Error(`setDataLock: ${error.message}`);
	}
	const result = data as { ok?: boolean; reason?: string } | undefined;
	if (!result?.ok) {
		throw new Error(
			result?.reason === "locked"
				? "Data terkunci."
				: "Gagal mengubah data lock.",
		);
	}
	return getDataLock();
}
