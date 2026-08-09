<script lang="ts">
	import { onMount } from "svelte";
	import {
		ArrowUpRight,
		BadgeCheck,
		CalendarDays,
		CircleAlert,
		Clock3,
		CreditCard,
		Loader2,
		LogOut,
		RefreshCw,
		Ticket,
		UserRound,
		X,
	} from "@lucide/svelte";
	import type {
		Competition,
		Participant,
		ParticipantPayment,
		PaymentConfig,
	} from "$lib/db/queries";
	import { getPaymentConfigs, getPayments } from "$lib/db/queries";
	import {
		AmountBelowMinDpError,
		PAYMENT_AMOUNT_STEP,
		resubmitPayment,
		submitPayment,
	} from "$lib/db/payment";
	import ImageUploader from "./ImageUploader.svelte";
	import PaymentMethodSelector from "./PaymentMethodSelector.svelte";
	import TicketCard from "./TicketCard.svelte";

	let {
		participants,
		competitions,
		onLogout,
		onRegisterMore,
	}: {
		participants: Participant[];
		competitions: Competition[];
		onLogout: () => void;
		onRegisterMore: () => void;
	} = $props();

	let paymentMap = $state(new Map<string, ParticipantPayment[]>());
	let loadingPayments = $state(true);
	let paymentError = $state("");
	let selectedTicket = $state<Participant | null>(null);
	let paymentParticipant = $state<Participant | null>(null);
	// B1-2 (F8/F17): bila terisi, modal pembayaran berjalan mode "kirim ulang"
	// untuk baris pembayaran yang ditolak/pending.
	let resubmitTarget = $state<ParticipantPayment | null>(null);
	let paymentConfigs = $state<PaymentConfig[]>([]);
	let paymentMode = $state<"dp" | "full">("dp");
	let paymentMethod = $state("");
	let paymentAmount = $state("");
	let paymentProof = $state<File | null>(null);
	let paymentSubmitting = $state(false);
	let paymentSubmitError = $state("");
	let paymentNotice = $state("");

	const statusLabel: Record<string, string> = {
		registered: "Menunggu pembayaran",
		payment_pending: "Menunggu verifikasi",
		payment_rejected: "Pembayaran ditolak",
		dp_paid: "DP terverifikasi",
		fully_paid: "Lunas",
		checked_in: "Sudah check-in",
		disqualified: "Didiskualifikasi",
	};

	const statusTone: Record<string, string> = {
		registered: "border-amber-300/30 bg-amber-300/10 text-amber-200",
		payment_pending: "border-amber-300/30 bg-amber-300/10 text-amber-200",
		payment_rejected: "border-rose-300/30 bg-rose-300/10 text-rose-200",
		dp_paid: "border-sky-300/30 bg-sky-300/10 text-sky-200",
		fully_paid: "border-emerald-300/30 bg-emerald-300/10 text-emerald-200",
		checked_in: "border-cyan-300/30 bg-cyan-300/10 text-cyan-200",
		disqualified: "border-rose-300/30 bg-rose-300/10 text-rose-200",
	};

	const methodLabel: Record<string, string> = {
		bank_transfer: "Transfer",
		ewallet: "E-wallet",
		qris: "QRIS",
		cash: "Tunai",
	};

	const money = (amount: number) => `Rp ${amount.toLocaleString("id-ID")}`;
	const dateTime = (value: Date | string | null | undefined) => {
		if (!value) return "—";
		const date = new Date(value);
		return Number.isNaN(date.getTime())
			? "—"
			: new Intl.DateTimeFormat("id-ID", {
					dateStyle: "medium",
					timeStyle: "short",
				}).format(date);
	};

	const loadPayments = async () => {
		loadingPayments = true;
		paymentError = "";
		try {
			const entries = await Promise.all(
				participants.map(
					async (participant) =>
						[
							participant.id,
							await getPayments(participant.id),
						] as const,
				),
			);
			paymentMap = new Map(entries);
		} catch (error) {
			paymentError =
				error instanceof Error
					? error.message
					: "Gagal memuat status pembayaran.";
		} finally {
			loadingPayments = false;
		}
	};

	const competitionFor = (participant: Participant) =>
		competitions.find(
			(competition) => competition.id === participant.competitionId,
		);

	onMount(() => {
		void loadPayments();
		void loadPaymentConfigs();
	});

	$effect(() => {
		if (!selectedTicket && !paymentParticipant) return;
		const previousBodyOverflow = document.body.style.overflow;
		const previousDocumentOverflow =
			document.documentElement.style.overflow;
		document.body.style.overflow = "hidden";
		document.documentElement.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = previousBodyOverflow;
			document.documentElement.style.overflow = previousDocumentOverflow;
		};
	});

	const loadPaymentConfigs = async () => {
		try {
			paymentConfigs = await getPaymentConfigs();
		} catch (error) {
			paymentSubmitError =
				error instanceof Error
					? error.message
					: "Gagal memuat metode pembayaran.";
		}
	};

	const openPayment = async (participant: Participant) => {
		const rejected = (paymentMap.get(participant.id) ?? []).some(
			(payment) =>
				!payment.isVerified && Boolean(payment.rejectReason?.trim()),
		);
		if (rejected) {
			paymentNotice =
				'Pembayaran ini ditolak panitia. Gunakan tombol "Kirim ulang pembayaran" untuk memperbaiki bukti.';
			return;
		}
		paymentParticipant = participant;
		resubmitTarget = null;
		paymentMode = participant.status === "dp_paid" ? "full" : "dp";
		paymentMethod = "";
		paymentProof = null;
		paymentSubmitError = "";
		paymentNotice = "";
		const competition = competitionFor(participant);
		paymentAmount = String(
			paymentMode === "full"
				? remainingFor(participant)
				: (competition?.minDp ?? 0),
		);
		if (paymentConfigs.length === 0) {
			await loadPaymentConfigs();
		}
	};

	/** B1-2 (F8/F17): buka modal utk perbaiki/kirim ulang baris yang ditolak. */
	const openResubmit = (
		participant: Participant,
		payment: ParticipantPayment,
	) => {
		paymentParticipant = participant;
		resubmitTarget = payment;
		const competition = competitionFor(participant);
		paymentMode = payment.amount >= (competition?.fee ?? 0) ? "full" : "dp";
		paymentMethod = payment.paymentMethod;
		paymentProof = null;
		paymentAmount = String(payment.amount);
		paymentSubmitError = "";
		paymentNotice = "";
		if (paymentConfigs.length === 0) {
			void loadPaymentConfigs();
		}
	};

	const setPaymentMode = (mode: "dp" | "full") => {
		paymentMode = mode;
		const participant = paymentParticipant;
		paymentAmount = String(
			mode === "full"
				? participant
					? remainingFor(participant)
					: 0
				: paymentParticipant
					? (competitionFor(paymentParticipant)?.minDp ?? 0)
					: 0,
		);
		paymentSubmitError = "";
	};

	const paymentCompetition = $derived(
		paymentParticipant ? competitionFor(paymentParticipant) : undefined,
	);
	const paymentAmountNumber = $derived(Number(paymentAmount));
	const paymentIsCash = $derived(paymentMethod === "cash");
	const paymentIncrementError = $derived(
		paymentMode === "dp" &&
			paymentAmount.length > 0 &&
			(!Number.isInteger(paymentAmountNumber) ||
				paymentAmountNumber % PAYMENT_AMOUNT_STEP !== 0),
	);
	const paymentFormValid = $derived(
		paymentParticipant !== null &&
			paymentMethod.length > 0 &&
			Number.isInteger(paymentAmountNumber) &&
			paymentAmountNumber > 0 &&
			!paymentIncrementError &&
			(paymentIsCash || paymentProof !== null) &&
			!paymentSubmitting,
	);

	const submitContinuationPayment = async () => {
		if (!paymentParticipant || !paymentFormValid) return;
		if (resubmitTarget) {
			paymentSubmitting = true;
			paymentSubmitError = "";
			try {
				const result = await resubmitPayment(
					{
						paymentId: resubmitTarget.id,
						participantId: paymentParticipant.id,
						competitionId: paymentParticipant.competitionId,
						amount: paymentAmountNumber,
						proofBlob: paymentProof,
						isCash: paymentIsCash,
						phone: paymentParticipant.phone,
					},
					paymentCompetition,
				);
				await loadPayments();
				paymentParticipant = null;
				resubmitTarget = null;
				paymentNotice = result.queued
					? "Perbaikan masuk antrean dan akan dikirim otomatis saat koneksi pulih."
					: "Pembayaran dikirim ulang dan menunggu verifikasi admin.";
			} catch (error) {
				paymentSubmitError =
					error instanceof AmountBelowMinDpError ||
					error instanceof Error
						? error.message
						: "Gagal mengirim ulang pembayaran.";
			} finally {
				paymentSubmitting = false;
			}
			return;
		}
		const rejected = (paymentMap.get(paymentParticipant.id) ?? []).some(
			(payment) =>
				!payment.isVerified && Boolean(payment.rejectReason?.trim()),
		);
		if (rejected) {
			paymentSubmitError =
				"Pembayaran ini sudah ditolak panitia dan tidak dapat dibayar ulang.";
			return;
		}
		// B2-1/F6/F18: mode lunas tidak boleh menagih melebihi sisa tagihan.
		if (paymentMode === "full" && paymentParticipant) {
			const remaining = remainingFor(paymentParticipant);
			if (paymentAmountNumber > remaining) {
				paymentSubmitError = `Nominal melebihi sisa tagihan Rp ${remaining.toLocaleString("id-ID")}.`;
				return;
			}
		}
		paymentSubmitting = true;
		paymentSubmitError = "";
		try {
			const result = await submitPayment(
				{
					participantId: paymentParticipant.id,
					competitionId: paymentParticipant.competitionId,
					method: paymentMethod,
					amount: paymentAmountNumber,
					proofBlob: paymentProof,
					isCash: paymentIsCash,
				},
				paymentMode,
				paymentCompetition,
			);
			await loadPayments();
			paymentParticipant = null;
			paymentNotice = result.queued
				? "Pembayaran masuk antrean dan akan dikirim otomatis saat koneksi pulih."
				: "Pembayaran tercatat dan menunggu verifikasi admin.";
		} catch (error) {
			paymentSubmitError =
				error instanceof AmountBelowMinDpError || error instanceof Error
					? error.message
					: "Gagal menyimpan pembayaran.";
		} finally {
			paymentSubmitting = false;
		}
	};

	const paymentsFor = (participant: Participant) =>
		paymentMap.get(participant.id) ?? [];

	const verifiedAmountFor = (participant: Participant) =>
		paymentsFor(participant)
			.filter((payment) => payment.isVerified)
			.reduce((total, payment) => total + payment.amount, 0);

	// B2-1/F6/F18: sisa tagihan utk "Lanjut lunas" = fee - total terverifikasi.
	const remainingFor = (participant: Participant) => {
		const competition = competitionFor(participant);
		return Math.max(
			0,
			(competition?.fee ?? 0) - verifiedAmountFor(participant),
		);
	};

	const pendingPaymentsFor = (participant: Participant) =>
		paymentsFor(participant).filter(
			(payment) => !payment.isVerified && !payment.rejectReason,
		);

	const rejectedPaymentsFor = (participant: Participant) =>
		paymentsFor(participant).filter(
			(payment) =>
				!payment.isVerified && Boolean(payment.rejectReason?.trim()),
		);

	const cardStatusFor = (participant: Participant) => {
		if (pendingPaymentsFor(participant).length > 0)
			return "payment_pending";
		if (rejectedPaymentsFor(participant).length > 0)
			return "payment_rejected";
		return participant.status;
	};

	const canContinuePayment = (participant: Participant) =>
		(participant.status === "registered" ||
			participant.status === "dp_paid") &&
		pendingPaymentsFor(participant).length === 0 &&
		rejectedPaymentsFor(participant).length === 0;

	const paymentStateFor = (
		participant: Participant,
		competition: Competition | undefined,
	) => {
		const verifiedAmount = verifiedAmountFor(participant);
		const pending = pendingPaymentsFor(participant).length;
		const rejected = rejectedPaymentsFor(participant).length;
		// B2-2/F19: checked_in ≠ lunas; tampilkan sisa bila masih ada tagihan.
		if (participant.status === "fully_paid") return "Lunas";
		if (participant.status === "checked_in") {
			const remaining = remainingFor(participant);
			return remaining > 0
				? `Sudah masuk: kurang bayar Rp ${remaining.toLocaleString("id-ID")}`
				: "Sudah masuk: lunas";
		}
		if (pending > 0) return "Menunggu verifikasi";
		if (rejected > 0) return "Pembayaran ditolak";
		if (verifiedAmount > 0) return "DP terverifikasi";
		if (competition?.minDp) return "Belum bayar";
		return "Menunggu pembayaran";
	};
</script>

<section
	class="flex min-w-0 w-full flex-col gap-5"
	aria-labelledby="registrant-profile-title"
>
	<div
		class="flex flex-col gap-4 rounded-2xl border border-cyan-300/20 bg-[linear-gradient(135deg,rgba(34,211,238,0.12),rgba(5,7,13,0.96)_48%,rgba(220,38,38,0.12))] p-5 shadow-[0_0_34px_rgba(34,211,238,0.08)] sm:flex-row sm:items-end sm:justify-between sm:p-4"
	>
		<div class="min-w-0">
			<p
				class="font-display text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-300"
			>
				Dashboard pendaftar
			</p>
			<h1
				id="registrant-profile-title"
				class="font-display mt-2 text-2xl font-extrabold uppercase tracking-tight text-white sm:text-3xl"
			>
				Profil & status lomba
			</h1>
			<p class="mt-2 flex items-center gap-2 text-sm text-slate-300">
				<UserRound
					class="h-4 w-4 shrink-0 text-cyan-300"
					aria-hidden="true"
				/>{participants[0]?.name ?? "Pendaftar"}
			</p>
			<p class="mt-1 text-xs text-slate-500">
				WA tersimpan: {participants[0]?.phone ?? "—"}
			</p>
		</div>
		<div class="flex flex-wrap gap-2">
			<button type="button" class="btn btn-gold" onclick={onRegisterMore}>
				Daftar lomba lain
				<ArrowUpRight class="h-4 w-4" aria-hidden="true" />
			</button>
			<button type="button" class="btn btn-ghost" onclick={onLogout}>
				<LogOut class="h-4 w-4" aria-hidden="true" />
				Keluar
			</button>
		</div>
	</div>

	<div class="grid min-w-0 gap-3 sm:grid-cols-3">
		<a
			href="/"
			class="rounded-xl border border-slate-800 bg-[#0a0f1c] p-4 transition-colors hover:border-cyan-300/40"
		>
			<p
				class="text-[10px] font-bold uppercase tracking-widest text-slate-500"
			>
				Shortcut
			</p>
			<p
				class="mt-2 font-display text-sm font-bold uppercase text-cyan-200"
			>
				Arena utama
			</p>
			<p class="mt-1 text-xs text-slate-400">
				Lihat lomba live dan info pertandingan.
			</p>
		</a>
		<a
			href="/leaderboard"
			class="rounded-xl border border-slate-800 bg-[#0a0f1c] p-4 transition-colors hover:border-indigo-300/40"
		>
			<p
				class="text-[10px] font-bold uppercase tracking-widest text-slate-500"
			>
				Shortcut
			</p>
			<p
				class="mt-2 font-display text-sm font-bold uppercase text-indigo-200"
			>
				Leaderboard
			</p>
			<p class="mt-1 text-xs text-slate-400">
				Pantau posisi dan point lomba.
			</p>
		</a>
		<div class="rounded-xl border border-slate-800 bg-[#0a0f1c] p-4">
			<p
				class="text-[10px] font-bold uppercase tracking-widest text-slate-500"
			>
				Tiket/Kupon
			</p>
			<p
				class="mt-2 font-display text-sm font-bold uppercase text-emerald-200"
			>
				{participants.length} arena diikuti
			</p>
			<p class="mt-1 text-xs text-slate-400">
				Semua tiket pendaftaran milik nomor WA ini.
			</p>
		</div>
	</div>

	<div class="flex items-center justify-between gap-3">
		<div>
			<p
				class="font-display text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300"
			>
				Keanggotaan arena
			</p>
			<h2 class="mt-1 text-xl font-bold text-white">
				Tiket/Kupon pendaftaran
			</h2>
		</div>
		<button
			type="button"
			class="btn btn-ghost btn-sm"
			onclick={() => void loadPayments()}
			disabled={loadingPayments}
		>
			<RefreshCw
				class="h-4 w-4 {loadingPayments ? 'animate-spin' : ''}"
				aria-hidden="true"
			/>
			<!-- Muat ulang -->
		</button>
	</div>

	{#if paymentError}
		<div
			class="flex items-start gap-2 rounded-xl border border-rose-300/30 bg-rose-300/10 p-4 text-sm text-rose-100"
			role="alert"
		>
			<CircleAlert class="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
			<span>{paymentError}</span>
		</div>
	{/if}
	{#if paymentNotice}
		<div
			class="flex items-start gap-2 rounded-xl border border-emerald-300/30 bg-emerald-300/10 p-4 text-sm text-emerald-100"
			role="status"
		>
			<CreditCard class="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
			<span>{paymentNotice}</span>
		</div>
	{/if}

	{#if loadingPayments}
		<div
			class="no-scrollbar flex min-w-0 snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [touch-action:pan-x]"
		>
			{#each [1, 2] as item}
				<div
					class="h-64 w-[min(90vw,32rem)] shrink-0 snap-start animate-pulse rounded-2xl border border-slate-800 bg-[#0a0f1c]"
					aria-label={`Memuat pendaftaran ${item}`}
				></div>
			{/each}
		</div>
	{:else}
		<div
			class="no-scrollbar flex min-w-0 snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [touch-action:pan-x]"
			aria-label="Status pendaftaran per lomba"
		>
			{#each participants as participant (participant.id)}
				{@const competition = competitionFor(participant)}
				{@const payments = paymentsFor(participant)}
				{@const verifiedAmount = verifiedAmountFor(participant)}
				{@const pendingPayments = pendingPaymentsFor(participant)}
				{@const rejectedPayments = rejectedPaymentsFor(participant)}
				{@const cardStatus = cardStatusFor(participant)}
				<article
					class="min-w-0 w-[min(90vw,32rem)] shrink-0 snap-start overflow-hidden rounded-2xl border border-slate-800 bg-[#0a0f1c]"
				>
					<div
						class="flex items-start justify-between gap-3 border-b border-slate-800 p-4"
					>
						<div class="min-w-0">
							<p
								class="font-display truncate text-lg font-extrabold uppercase text-white"
							>
								{competition?.name ?? "Lomba"}
							</p>
							<p
								class="mt-1 flex items-center gap-1.5 text-xs text-slate-400"
							>
								<CalendarDays
									class="h-3.5 w-3.5"
									aria-hidden="true"
								/>Daftar {dateTime(participant.createdAt)}
							</p>
						</div>
						<span
							class="shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide {statusTone[
								cardStatus
							] ??
								'border-slate-700 bg-slate-800 text-slate-300'}"
							>{statusLabel[cardStatus] ?? cardStatus}</span
						>
					</div>

					<div class="grid gap-3 p-4 sm:grid-cols-2">
						<div
							class="rounded-xl border border-cyan-300/15 bg-cyan-300/5 p-3"
						>
							<p
								class="text-[10px] font-bold uppercase tracking-widest text-cyan-300"
							>
								Nomor tiket
							</p>

							<p
								class="mt-1 font-mono text-xl font-bold tabular-nums text-white"
							>
								{participant.ticketNumber}
							</p>
							{#if participant.lapakNumber}
								<p class="mt-1 text-xs text-slate-400">
									BIB #{participant.lapakNumber}
								</p>
							{:else}
								<p class="mt-1 text-xs text-slate-400">
									Gunakan nomor tiket untuk check-in, untuk
									klaim BIB (nomor peserta) di lokasi lomba.
								</p>
							{/if}
						</div>
						<div
							class="rounded-xl border border-indigo-300/15 bg-indigo-300/5 p-3"
						>
							<p
								class="text-[10px] font-bold uppercase tracking-widest text-indigo-200"
							>
								Pembayaran
							</p>
							<p class="mt-1 font-bold text-white">
								{paymentStateFor(participant, competition)}
							</p>
							<p class="mt-1 text-xs text-slate-400">
								Terverifikasi: {money(verifiedAmount)}
							</p>
						</div>
					</div>

					<div class="border-t border-slate-800 px-4 py-3">
						<p
							class="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500"
						>
							<Clock3
								class="h-3.5 w-3.5"
								aria-hidden="true"
							/>Riwayat pembayaran
						</p>
						{#if payments.length === 0}
							<p class="mt-2 text-xs text-slate-400">
								Belum ada pembayaran yang dikirim.
							</p>
						{:else}
							<div class="mt-2 flex flex-col gap-2">
								{#each payments as payment}
									{@const rejectionReason =
										payment.rejectReason?.trim()}
									<div
										class="flex flex-wrap items-center justify-between gap-2 text-xs"
									>
										<span class="text-slate-300"
											>{money(payment.amount)} · {methodLabel[
												payment.paymentMethod
											] ?? payment.paymentMethod}</span
										>
										<span
											class={payment.isVerified
												? "text-emerald-300"
												: rejectionReason
													? "text-rose-300"
													: "text-amber-300"}
											>{payment.isVerified
												? "Terverifikasi"
												: rejectionReason
													? "Ditolak"
													: "Menunggu verifikasi"}</span
										>
									</div>
									<p class="text-[11px] text-slate-500">
										Disimpan {dateTime(payment.createdAt)}
									</p>
									{#if rejectionReason}
										<p
											class="text-[11px] leading-relaxed text-rose-200"
										>
											Alasan penolakan: {rejectionReason}
										</p>
									{/if}
								{/each}
							</div>
						{/if}
						{#if pendingPayments.length > 0}
							<p class="mt-3 text-xs text-amber-200">
								Bukti pembayaran sedang dicek panitia/admin.
							</p>
						{:else if rejectedPayments.length > 0}
							<p
								class="mt-3 text-xs leading-relaxed text-rose-200"
							>
								Pembayaran ditolak panitia/admin. Periksa alasan
								di atas lalu kirim ulang lewat tombol "Kirim
								ulang pembayaran".
							</p>
						{/if}
					</div>

					<div
						class="flex flex-wrap gap-2 border-t border-slate-800 p-4"
					>
						{#if canContinuePayment(participant)}
							<button
								type="button"
								class="btn btn-gold flex-1"
								onclick={() => void openPayment(participant)}
							>
								<CreditCard
									class="h-4 w-4"
									aria-hidden="true"
								/>
								{participant.status === "dp_paid"
									? "Lanjut lunas"
									: "Lanjut bayar"}
							</button>
						{/if}
						{#if rejectedPayments.length > 0}
							<button
								type="button"
								class="btn btn-gold flex-1"
								onclick={() =>
									void openResubmit(
										participant,
										rejectedPayments[0],
									)}
							>
								<RefreshCw class="h-4 w-4" aria-hidden="true" />
								Kirim ulang pembayaran
							</button>
						{/if}
						{#if rejectedPayments.length === 0}
							<button
								type="button"
								class="btn btn-gold flex-1"
								onclick={() => (selectedTicket = participant)}
								><Ticket
									class="h-4 w-4"
									aria-hidden="true"
								/>Buka e-tiket</button
							>
						{:else}
							<span
								class="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-rose-300/30 bg-rose-300/10 px-2 py-2 text-xs text-rose-200"
								><Ticket
									class="h-4 w-4"
									aria-hidden="true"
								/>E-tiket terkunci</span
							>
						{/if}
						{#if participant.status === "fully_paid" || participant.status === "checked_in"}
							<span
								class="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300/25 bg-emerald-300/10 px-2 py-2 text-xs text-emerald-200"
								><BadgeCheck
									class="h-4 w-4"
									aria-hidden="true"
								/>{participant.status === "checked_in" &&
								remainingFor(participant) > 0
									? "Sudah masuk: kurang bayar"
									: "Siap bertanding"}</span
							>
						{/if}
					</div>
				</article>
			{/each}
		</div>
	{/if}
</section>

{#if selectedTicket}
	<div
		class="fixed inset-0 z-50 flex items-end justify-center overflow-hidden bg-slate-950/85 px-2 py-3 backdrop-blur-sm sm:items-center sm:px-4"
		role="presentation"
	>
		<div
			class="flex max-h-[94dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-cyan-300/30 bg-[#080b14] shadow-[0_0_44px_rgba(34,211,238,0.16)]"
			role="dialog"
			aria-modal="true"
			aria-labelledby="registrant-ticket-title"
		>
			<div
				class="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-3 sm:px-4"
			>
				<div>
					<p
						class="font-display text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300"
					>
						Tiket peserta
					</p>
					<h2
						id="registrant-ticket-title"
						class="mt-1 text-lg font-bold text-white"
					>
						E-Tiket check-in
					</h2>
				</div>
				<button
					type="button"
					class="btn btn-ghost btn-sm"
					aria-label="Tutup e-tiket"
					onclick={() => (selectedTicket = null)}
					><X class="h-4 w-4" aria-hidden="true" /></button
				>
			</div>
			<div
				class="min-h-0 overflow-y-auto overscroll-contain p-2 sm:p-4 [touch-action:pan-y]"
			>
				<TicketCard
					participant={selectedTicket}
					competition={competitionFor(selectedTicket)}
					remaining={remainingFor(selectedTicket)}
					printWidth={80}
				/>
			</div>
		</div>
	</div>
{/if}

{#if paymentParticipant}
	<div
		class="fixed inset-0 z-50 flex items-end justify-center overflow-hidden bg-slate-950/85 px-2 py-3 backdrop-blur-sm sm:items-center sm:px-4"
		role="presentation"
	>
		<div
			class="flex max-h-[94dvh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-amber-300/30 bg-[#080b14] shadow-[0_0_44px_rgba(251,191,36,0.14)]"
			role="dialog"
			aria-modal="true"
			aria-labelledby="continue-payment-title"
		>
			<div
				class="flex items-start justify-between gap-3 border-b border-slate-800 p-5"
			>
				<div>
					<p
						class="font-display text-[10px] font-bold uppercase tracking-[0.2em] text-amber-200"
					>
						Pembayaran peserta
					</p>
					<h2
						id="continue-payment-title"
						class="mt-1 text-xl font-bold text-white"
					>
						{resubmitTarget
							? "Kirim ulang pembayaran"
							: "Lanjut bayar"}
					</h2>
					<p class="mt-1 text-xs text-slate-400">
						{paymentCompetition?.name ?? "Lomba"} · {paymentParticipant.name}
					</p>
				</div>
				<button
					type="button"
					class="btn btn-ghost btn-sm"
					aria-label="Tutup pembayaran"
					onclick={() => (paymentParticipant = null)}
					><X class="h-4 w-4" aria-hidden="true" /></button
				>
			</div>

			<form
				class="min-h-0 overflow-y-auto overscroll-contain p-5 [touch-action:pan-y]"
				onsubmit={(event) => {
					event.preventDefault();
					void submitContinuationPayment();
				}}
			>
				<div
					class="rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-xs leading-relaxed text-amber-100"
				>
					{#if paymentMode === "full"}
						{paymentParticipant.status === "dp_paid"
							? "DP Anda sudah tercatat. Selesaikan pembayaran sisa tagihan untuk menjadi lunas."
							: "Lunasi seluruh tagihan untuk menjadi lunas."}
						{#if paymentParticipant}
							<span class="mt-1 block font-semibold">
								Sisa tagihan: Rp {remainingFor(
									paymentParticipant,
								).toLocaleString("id-ID")}
							</span>
						{/if}
					{:else}
						Pendaftaran tercatat. Bayar minimal DP agar status dapat
						diproses panitia.
					{/if}
				</div>

				{#if paymentParticipant.status !== "dp_paid"}
					<fieldset class="mt-4 flex flex-col gap-2 text-sm">
						<legend class="font-medium text-slate-200"
							>Pilih pembayaran</legend
						>
						<label
							class="flex items-center gap-2 rounded-lg border border-border/60 px-2 py-2"
						>
							<input
								type="radio"
								name="continue-payment-mode"
								value="dp"
								checked={paymentMode === "dp"}
								onchange={() => setPaymentMode("dp")}
								class="accent-gold"
							/>
							<span
								>DP minimal <span class="text-muted-foreground"
									>(Rp {(
										paymentCompetition?.minDp ?? 0
									).toLocaleString("id-ID")})</span
								></span
							>
						</label>
						<label
							class="flex items-center gap-2 rounded-lg border border-border/60 px-2 py-2"
						>
							<input
								type="radio"
								name="continue-payment-mode"
								value="full"
								checked={paymentMode === "full"}
								onchange={() => setPaymentMode("full")}
								class="accent-gold"
							/>
							<span
								>Lunas <span class="text-muted-foreground"
									>(Rp {(
										paymentCompetition?.fee ?? 0
									).toLocaleString("id-ID")})</span
								></span
							>
						</label>
					</fieldset>
				{:else}
					<p
						class="mt-4 rounded-lg border border-sky-300/20 bg-sky-300/10 px-2 py-2 text-xs text-sky-100"
					>
						Mode pembayaran: lanjut lunas
					</p>
				{/if}

				<div class="mt-4">
					<PaymentMethodSelector
						configs={paymentConfigs}
						value={paymentMethod}
						onchange={(method) => {
							paymentMethod = method;
							paymentSubmitError = "";
						}}
					/>
				</div>

				<label class="mt-4 flex flex-col gap-1 text-sm">
					<span class="font-medium text-slate-200"
						>Nominal {paymentMode === "dp" ? "DP" : "lunas"}</span
					>
					<input
						type="number"
						bind:value={paymentAmount}
						class="input"
						inputmode="numeric"
						min="0"
						step={PAYMENT_AMOUNT_STEP}
					/>
				</label>
				<p class="mt-1 text-[11px] leading-relaxed text-slate-500">
					Nominal DP harus kelipatan Rp 500 dan otomatis terisi dari
					biaya lomba.
				</p>
				{#if paymentIncrementError}
					<p class="mt-1 text-xs text-rose-200" role="alert">
						Nominal DP harus kelipatan Rp 500.
					</p>
				{/if}

				{#if !paymentIsCash}
					<div class="mt-4">
						<ImageUploader
							participantId={paymentParticipant.id}
							bind:file={paymentProof}
							required
						/>
					</div>
				{/if}

				{#if paymentSubmitError}
					<p
						class="mt-3 rounded-lg border border-rose-300/25 bg-rose-300/10 p-3 text-xs text-rose-100"
						role="alert"
					>
						{paymentSubmitError}
					</p>
				{/if}

				<button
					type="submit"
					class="btn btn-gold mt-5 w-full"
					disabled={!paymentFormValid}
				>
					{#if paymentSubmitting}
						<Loader2
							class="h-4 w-4 animate-spin"
							aria-hidden="true"
						/>
						Menyimpan…
					{:else}
						<CreditCard class="h-4 w-4" aria-hidden="true" />
						{resubmitTarget ? "Kirim ulang" : "Kirim pembayaran"}
					{/if}
				</button>
			</form>
		</div>
	</div>
{/if}
