<script lang="ts">
	import {
		AlertTriangle,
		Camera,
		CreditCard,
		ExternalLink,
		Gift,
		Loader2,
		LogIn,
		QrCode,
		Save,
		Ticket,
	} from "@lucide/svelte";
	import { onMount, untrack } from "svelte";
	import TermsDialog from "$lib/components/TermsDialog.svelte";
	import type { Competition, PaymentConfig } from "$lib/db/queries";
	import {
		isValidPhone,
		normalizePhone,
		QuotaFullError,
		registerParticipant,
		type RegistrationResult,
	} from "$lib/db/register";
	import {
		AmountBelowMinDpError,
		PAYMENT_AMOUNT_STEP,
		submitPayment,
	} from "$lib/db/payment";
	import {
		clearDraft,
		loadDraft,
		saveDraft,
		type RegistrationDraft,
	} from "$lib/offline/draftStore";
	import { online } from "$lib/offline/networkStore";
	import ImageUploader from "./ImageUploader.svelte";
	import PaymentMethodSelector from "./PaymentMethodSelector.svelte";
	import QRCode from "./QRCode.svelte";

	let {
		competitions,
		onLogin,
		lockedCompetitionId,
	}: {
		competitions: Competition[];
		onLogin?: () => void;
		lockedCompetitionId?: string;
	} = $props();

	const draft = loadDraft();
	const toLocalPhone = (raw: string): string => {
		const normalized = normalizePhone(raw);
		if (normalized.startsWith("+62")) {
			return normalized.slice(3);
		}
		return normalized.replace(/^0/, "");
	};

	let name = $state((draft?.name ?? "").toUpperCase());
	let phone = $state(toLocalPhone(draft?.phone ?? ""));
	let competitionId = $state(
		untrack(() => lockedCompetitionId) ?? draft?.competitionId ?? "",
	);
	let payment = $state<"dp" | "full">(draft?.payment ?? "dp");

	let submitting = $state(false);
	let submitted = $state<RegistrationResult | null>(null);
	let error = $state("");
	let quotaFull = $state(false);

	let paymentConfigs = $state<PaymentConfig[]>([]);
	let paymentMethod = $state("");
	let amountInput = $state<string>("");
	let amountError = $state("");
	let paymentError = $state("");
	let paymentSubmitted = $state(false);
	let paymentQueued = $state(false);
	let paymentProcessing = $state(false);
	let proofFile = $state<File | null>(null);
	let termsCompetition = $state<Competition | null>(null);

	const selectedCompetition = $derived(
		competitions.find((c) => c.id === competitionId),
	);
	const liveCompetitions = $derived(competitions.filter((c) => c.isActive));
	const phoneWithPrefix = $derived(phone.length > 0 ? `+62${phone}` : "");
	const validLocalPhone = $derived(/^8\d{8,12}$/.test(phone));

	const isCashMethod = $derived(paymentMethod === "cash");
	const amountDefault = $derived(
		payment === "dp"
			? String(selectedCompetition?.minDp ?? 0)
			: String(selectedCompetition?.fee ?? 0),
	);
	let amountSource = $state("");
	$effect(() => {
		const nextSource = `${competitionId}:${payment}:${amountDefault}`;
		if (nextSource === amountSource) {
			return;
		}
		amountSource = nextSource;
		amountInput = amountDefault;
		amountError = "";
	});
	const effectiveAmount = $derived(
		amountInput.length > 0 ? Number(amountInput) : Number(amountDefault),
	);
	const amountIncrementError = $derived(
		payment === "dp" &&
			amountInput.length > 0 &&
			(!Number.isInteger(effectiveAmount) ||
				effectiveAmount % PAYMENT_AMOUNT_STEP !== 0),
	);
	const paymentValid = $derived(
		paymentMethod.length > 0 &&
			(isCashMethod || submitted !== null) &&
			!Number.isNaN(effectiveAmount) &&
			effectiveAmount > 0 &&
			!amountIncrementError,
	);

	const loadPaymentConfigs = async () => {
		try {
			const { getPaymentConfigs } = await import("$lib/db/queries");
			paymentConfigs = await getPaymentConfigs();
		} catch (e) {
			paymentError =
				e instanceof Error
					? e.message
					: "Gagal memuat metode pembayaran.";
		}
	};

	onMount(() => {
		void loadPaymentConfigs();
	});
	const phoneError = $derived(
		phone.length > 0 &&
			(!validLocalPhone || !isValidPhone(phoneWithPrefix)),
	);
	const formValid = $derived(
		name.trim().length >= 2 &&
			validLocalPhone &&
			isValidPhone(phoneWithPrefix) &&
			competitionId.length > 0 &&
			!submitting,
	);

	const persistDraft = () => {
		const draftData: RegistrationDraft = {
			name: name.trim().toUpperCase(),
			phone: phoneWithPrefix,
			competitionId,
			payment,
			savedAt: Date.now(),
		};
		saveDraft(draftData);
	};

	const submit = async () => {
		if (!formValid) {
			return;
		}
		submitting = true;
		error = "";
		quotaFull = false;
		persistDraft();
		try {
			const result = await registerParticipant({
				competitionId,
				name: name.trim().toUpperCase(),
				phone: normalizePhone(phoneWithPrefix),
			});
			submitted = result;
			clearDraft();
			void loadPaymentConfigs();
		} catch (e) {
			if (e instanceof QuotaFullError) {
				quotaFull = true;
			} else {
				error =
					e instanceof Error
						? e.message
						: "Gagal mendaftar. Coba lagi.";
			}
		} finally {
			submitting = false;
		}
	};

	const handlePayment = async () => {
		if (!submitted || !paymentValid) {
			return;
		}
		paymentProcessing = true;
		amountError = "";
		try {
			const res = await submitPayment(
				{
					participantId: submitted.participantId,
					competitionId,
					method: paymentMethod,
					amount: effectiveAmount,
					proofBlob: proofFile ?? null,
					isCash: isCashMethod,
				},
				payment,
				selectedCompetition,
			);
			paymentSubmitted = true;
			paymentQueued = res.queued;
		} catch (e) {
			amountError =
				e instanceof AmountBelowMinDpError || e instanceof Error
					? e.message
					: "Gagal menyimpan pembayaran.";
		} finally {
			paymentProcessing = false;
		}
	};

	const successStatus = $derived.by(() => {
		if (!submitted) return "";
		if (submitted.queued) return "Menunggu sinkronisasi";
		if (submitted.duplicated) return "Sudah terdaftar";
		return "Terdaftar — menunggu pembayaran";
	});

	const successStatusDescription = $derived.by(() => {
		if (!submitted) return "";
		if (submitted.queued) {
			return "Data aman tersimpan di perangkat dan akan dikirim otomatis saat koneksi pulih.";
		}
		if (submitted.duplicated) {
			return "Nomor WA ini sudah terdaftar untuk lomba tersebut. Lanjutkan ke pembayaran jika belum lunas, atau gunakan tiket dan QR yang tampil untuk check-in.";
		}
		return "Data peserta sudah tercatat. Pembayaran berikutnya akan menentukan status DP atau lunas.";
	});
</script>

{#if submitted}
	<div
		class="w-full rounded-xl border border-border/60 bg-background/60 p-4 text-center"
		role="status"
	>
		<Ticket class="mx-auto h-10 w-10 text-gold" aria-hidden="true" />
		<h2 class="mt-3 text-xl font-bold">
			{submitted.queued
				? "Pendaftaran masuk antrean"
				: "Berhasil terdaftar"}
		</h2>
		<div
			class="mt-4 rounded-xl border border-cyan-300/30 bg-cyan-300/10 p-4 text-left"
			data-testid="registration-status-banner"
		>
			<p
				class="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-200"
			>
				Status pendaftaran
			</p>
			<p
				class="mt-1 font-display text-lg font-extrabold uppercase text-white"
			>
				{successStatus}
			</p>
			<p class="mt-1 text-xs leading-relaxed text-slate-300">
				{successStatusDescription}
			</p>
		</div>
		{#if submitted.ticketNumber}
			<div
				class="mt-4 rounded-xl border border-amber-300/25 bg-amber-300/10 p-4"
			>
				<p
					class="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-200"
				>
					Nomor tiket
				</p>
				<p class="mt-1 text-2xl font-bold tabular-nums text-white">
					{submitted.ticketNumber}
				</p>
				<p class="mt-1 text-xs text-amber-100/80">
					Simpan nomor ini sebagai cadangan saat check-in.
				</p>
			</div>
		{/if}

		{#if submitted.participantId && !paymentQueued}
			<div
				class="mt-4 rounded-xl border border-indigo-300/25 bg-indigo-300/10 p-4"
			>
				<div
					class="flex items-center justify-center gap-2 text-left text-sm font-bold text-indigo-100"
				>
					<QrCode class="h-4 w-4 shrink-0" aria-hidden="true" />
					QR check-in panitia
				</div>
				<div
					class="mx-auto mt-3 w-fit rounded-xl bg-white p-2"
					data-testid="registration-qr"
				>
					<QRCode id={submitted.participantId} size={176} />
				</div>
				<p class="mt-3 text-xs leading-relaxed text-indigo-100/80">
					Tunjukkan QR ini kepada panitia. QR terhubung langsung ke
					data peserta dan bisa dipindai dari menu Check-in.
				</p>
			</div>
		{:else if submitted.queued}
			<div
				class="mt-4 rounded-xl border border-amber-300/25 bg-amber-300/10 p-4 text-left text-xs leading-relaxed text-amber-100"
			>
				QR akan muncul setelah data berhasil tersinkronisasi. Untuk
				sementara, simpan nomor WA dan detail pendaftaran ini.
			</div>
		{/if}

		<div class="mt-4 grid gap-3 text-left sm:grid-cols-2">
			<div class="rounded-xl border border-cyan-300/20 bg-cyan-300/5 p-4">
				<div
					class="flex items-center gap-2 text-sm font-bold text-cyan-100"
				>
					<LogIn class="h-4 w-4" aria-hidden="true" />Cara login lagi
				</div>
				<p class="mt-2 text-xs leading-relaxed text-slate-300">
					Tekan tombol Login, lalu masukkan nomor WA yang sama. Profil
					pendaftar dan semua tiket akan tampil kembali.
				</p>
			</div>
			<div
				class="rounded-xl border border-emerald-300/20 bg-emerald-300/5 p-4"
			>
				<div
					class="flex items-center gap-2 text-sm font-bold text-emerald-100"
				>
					<Camera class="h-4 w-4" aria-hidden="true" />Screenshot /
					simpan
				</div>
				<p class="mt-2 text-xs leading-relaxed text-slate-300">
					Screenshot halaman ini atau simpan nomor tiket dan QR
					sebelum menutup halaman.
				</p>
			</div>
		</div>

		{#if !submitted.queued && submitted.participantId}
			<div class="mt-6 border-t border-border/60 pt-5 text-left">
				<h3 class="flex items-center gap-2 text-sm font-bold">
					<CreditCard class="h-4 w-4 text-gold" aria-hidden="true" />
					Pembayaran
				</h3>

				{#if paymentSubmitted}
					<div
						class="mt-3 rounded-lg bg-muted p-3 text-xs"
						role="status"
					>
						{paymentQueued
							? "Pembayaran masuk antrean dan akan dikirim otomatis saat koneksi pulih."
							: "Pembayaran tercatat. Terima kasih!"}
					</div>
				{:else}
					<div class="mt-3">
						<PaymentMethodSelector
							configs={paymentConfigs}
							value={paymentMethod}
							onchange={(m) => {
								paymentMethod = m;
								amountError = "";
							}}
						/>
					</div>

					{#if paymentError}
						<p class="mt-2 text-xs text-destructive" role="alert">
							{paymentError}
						</p>
					{/if}

					{#if isCashMethod}
						<p class="mt-3 text-xs text-muted-foreground">
							Bayar tunai di lokasi — Rp {effectiveAmount.toLocaleString(
								"id-ID",
							)}
							({payment === "dp" ? "DP" : "lunas"}).
						</p>
					{:else}
						<label class="mt-3 flex flex-col gap-1 text-sm">
							<span class="font-medium"
								>Nominal ({payment === "dp"
									? "DP"
									: "Lunas"})</span
							>
							<input
								type="number"
								bind:value={amountInput}
								class="input"
								inputmode="numeric"
								min="0"
								step={PAYMENT_AMOUNT_STEP}
							/>
						</label>
						<p
							class="text-[11px] leading-relaxed text-muted-foreground"
						>
							Terisi otomatis dari card lomba. DP memakai
							kelipatan Rp 500 (Rp500, Rp1.000, Rp5.000, Rp10.000,
							Rp20.000, Rp50.000, Rp100.000).
						</p>
						{#if amountIncrementError}
							<p class="text-xs text-destructive" role="alert">
								Nominal DP harus kelipatan Rp 500.
							</p>
						{/if}

						{#if amountError}
							<p
								class="mt-1 text-xs text-destructive"
								role="alert"
							>
								{amountError}
							</p>
						{/if}

						<div class="mt-3">
							<ImageUploader
								participantId={submitted.participantId}
								bind:file={proofFile}
								required
							/>
						</div>
					{/if}

					<button
						type="button"
						class="btn btn-gold mt-4 w-full"
						onclick={() => void handlePayment()}
						disabled={!paymentValid || paymentProcessing}
					>
						{#if paymentProcessing}
							<Loader2
								class="h-4 w-4 animate-spin"
								aria-hidden="true"
							/>
							Menyimpan…
						{:else}
							Bayar
						{/if}
					</button>
				{/if}
			</div>
		{/if}

		<div class="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
			{#if onLogin}
				<button
					type="button"
					class="btn btn-gold"
					onclick={() => onLogin?.()}
				>
					<LogIn class="h-4 w-4" aria-hidden="true" />
					Lanjut login
				</button>
			{/if}
			<button
				type="button"
				class="btn btn-ghost"
				onclick={() => (submitted = null)}
			>
				<Save class="h-4 w-4" aria-hidden="true" />
				Daftar lagi
			</button>
		</div>
	</div>
{:else}
	<form
		class="flex min-w-0 w-full flex-col gap-4 rounded-xl border border-border bg-background/60 p-4"
		onsubmit={(e) => {
			e.preventDefault();
			void submit();
		}}
	>
		<h1 class="text-xl font-bold">Pendaftaran Lomba</h1>

		<label class="flex flex-col gap-1 text-sm">
			<span class="font-medium">Nama lengkap</span>
			<input
				type="text"
				value={name}
				oninput={(event) => {
					name = event.currentTarget.value.toUpperCase();
				}}
				class="input"
				placeholder="Nama peserta"
				autocomplete="name"
				required
			/>
		</label>

		<label class="flex flex-col gap-1 text-sm">
			<span class="font-medium">Nomor WA</span>
			<div
				class="flex min-w-0 items-center rounded-lg border border-border bg-background focus-within:ring-2 focus-within:ring-gold/60"
			>
				<span
					class="shrink-0 border-r border-border px-2 py-2.5 text-sm font-semibold text-muted-foreground"
					aria-hidden="true">+62</span
				>
				<input
					type="tel"
					value={phone}
					oninput={(event) => {
						phone = (
							event.currentTarget as HTMLInputElement
						).value.replace(/\D/g, "");
					}}
					class="min-w-0 flex-1 border-0 bg-transparent px-2 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground"
					placeholder="81234567890"
					aria-label="Nomor WA setelah +62"
					inputmode="numeric"
					pattern={"8[0-9]{8,12}"}
					maxlength="13"
					autocomplete="tel-national"
					required
				/>
			</div>
			{#if phoneError}
				<span class="text-xs text-destructive"
					>Nomor WA harus diawali angka 8 setelah prefix +62.</span
				>
			{/if}
		</label>

		{#if lockedCompetitionId}
			<div
				class="flex min-w-0 flex-col gap-2 rounded-2xl border border-cyan-300/25 bg-cyan-300/5 p-4 text-sm"
			>
				<p
					class="font-display text-[10px] font-bold uppercase tracking-widest text-cyan-300"
				>
					Lomba
				</p>
				<h3
					class="font-display break-words text-lg font-extrabold uppercase text-slate-100"
				>
					{selectedCompetition?.name ?? ""}
				</h3>
				{#if selectedCompetition}
					<p class="text-xs text-slate-400">
						Tiket Rp {selectedCompetition.fee.toLocaleString(
							"id-ID",
						)} · DP mulai Rp {selectedCompetition.minDp.toLocaleString(
							"id-ID",
						)}
					</p>
					<button
						type="button"
						class="mt-1 inline-flex w-fit items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-cyan-200 underline"
						onclick={() =>
							(termsCompetition = selectedCompetition ?? null)}
					>
						<ExternalLink class="h-3.5 w-3.5" aria-hidden="true" />
						Lihat Ketentuan & Persyaratan
					</button>
				{/if}
			</div>
		{:else}
		<fieldset class="flex min-w-0 flex-col gap-2 text-sm">
			<legend class="font-medium">Pilih lomba</legend>
			<div
				class="no-scrollbar mt-2 flex min-w-0 w-full max-w-full snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain pb-2"
				role="radiogroup"
				aria-label="Pilihan lomba"
			>
				{#each liveCompetitions as c (c.id)}
					{@const selected = competitionId === c.id}
					<div
						class="relative flex w-[16rem] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border {selected
							? 'border-cyan-300/70 shadow-[0_0_24px_rgba(34,211,238,0.14)]'
							: c.isActive
								? 'border-slate-700'
								: 'border-rose-200/45 shadow-[0_0_24px_rgba(220,38,38,0.14)]'} {c.isActive
							? 'bg-[#0a0f1c]'
							: 'bg-[linear-gradient(135deg,rgba(127,29,29,0.72),rgba(10,15,28,0.96)_58%,rgba(248,250,252,0.1))]'}"
					>
						<input
							id={`competition-${c.id}`}
							type="radio"
							name="competition"
							value={c.id}
							bind:group={competitionId}
							disabled={!c.isActive}
							class="sr-only"
						/>
						<label
							for={`competition-${c.id}`}
							class="flex flex-1 cursor-pointer flex-col gap-3 p-4 {c.isActive
								? ''
								: 'cursor-not-allowed'}"
						>
							<div class="flex items-start justify-between gap-2">
								<span
									class="font-display text-[10px] font-bold uppercase tracking-widest {c.isActive
										? 'text-cyan-300'
										: 'text-rose-100'}"
								>
									{c.isActive
										? "Siap Bertanding"
										: "Segera Dimulai"}
								</span>
								<span
									class="font-display text-xs text-slate-500"
								>
									--- slot
									<!-- {c.totalQuota} slot -->
								</span>
							</div>
							<h3
								class="font-display break-words text-lg font-extrabold uppercase leading-tight text-slate-100"
							>
								{c.name}
							</h3>
							<div
								class="grid grid-cols-2 gap-2 rounded-xl border border-slate-800 bg-slate-950/40 p-3 text-xs"
							>
								<div>
									<p
										class="font-bold uppercase tracking-wider text-slate-500"
									>
										Tiket
									</p>
									<p
										class="mt-1 break-words font-semibold text-slate-100"
									>
										Rp {c.fee.toLocaleString("id-ID")}
									</p>
								</div>
								<div class="border-l border-slate-800 pl-2">
									<p
										class="font-bold uppercase tracking-wider text-slate-500"
									>
										DP mulai
									</p>
									<p
										class="mt-1 break-words font-semibold text-slate-100"
									>
										Rp {c.minDp.toLocaleString("id-ID")}
									</p>
								</div>
							</div>
							<div
								class="rounded-xl border border-indigo-300/15 bg-indigo-300/5 p-3"
							>
								<p
									class="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-indigo-200"
								>
									<Gift
										class="h-3.5 w-3.5"
										aria-hidden="true"
									/>
									Hadiah-hadiah
								</p>
								<ul
									class="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-300"
								>
									<li class="break-words pl-1">
										Lihat Syarat & Ketentuan untuk daftar
										hadiah lengkap.
									</li>
								</ul>
							</div>
						</label>
						<button
							type="button"
							class="flex items-center justify-between gap-2 border-t border-slate-800 px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-cyan-200 transition-colors hover:bg-cyan-300/10"
							onclick={() => (termsCompetition = c)}
						>
							<span>Lihat Ketentuan & Persyaratan</span>
							<ExternalLink
								class="h-3.5 w-3.5 shrink-0"
								aria-hidden="true"
							/>
						</button>
					</div>
				{/each}
			</div>
			{#if selectedCompetition}
				<p class="text-xs text-cyan-200">
					Terpilih: {selectedCompetition.name}
				</p>
			{:else}
				<p class="text-xs text-slate-500">
					Geser kartu lalu pilih arena yang ingin diikuti.
				</p>
			{/if}
		</fieldset>
		{/if}

		<fieldset class="flex flex-col gap-2 text-sm">
			<legend class="font-medium">Pembayaran</legend>
			{#each ["dp", "full"] as mode}
				<label
					class="flex items-center gap-2 rounded-lg border border-border/60 px-2 py-2"
				>
					<input
						type="radio"
						name="payment"
						value={mode}
						bind:group={payment}
						class="accent-gold"
					/>
					<span>
						{mode === "dp" ? "DP" : "Lunas"}
						<span class="text-muted-foreground">
							{mode === "dp"
								? ` (min Rp ${(selectedCompetition?.minDp ?? 0).toLocaleString("id-ID")})`
								: ` (Rp ${(selectedCompetition?.fee ?? 0).toLocaleString("id-ID")})`}
						</span>
					</span>
				</label>
			{/each}
		</fieldset>

		<div
			class="relative overflow-hidden rounded-xl border border-rose-200/35 bg-[linear-gradient(110deg,rgba(127,29,29,0.92),rgba(15,23,42,0.96)_62%,rgba(248,250,252,0.1))] p-4 text-rose-50 shadow-[0_0_24px_rgba(220,38,38,0.12)]"
			role="note"
		>
			<div
				class="absolute inset-y-0 left-0 w-1 bg-white"
				aria-hidden="true"
			></div>
			<div class="flex gap-2 pl-2">
				<AlertTriangle
					class="mt-0.5 h-4 w-4 shrink-0 text-white"
					aria-hidden="true"
				/>
				<div>
					<p
						class="font-display text-xs font-bold uppercase tracking-wider text-white"
					>
						No-refund
					</p>
					<p class="mt-1 text-xs leading-relaxed text-rose-100">
						Biaya pendaftaran yang sudah dibayar tidak dapat
						dikembalikan. Pastikan pilihan lomba dan data peserta
						sudah benar.
					</p>
				</div>
			</div>
		</div>

		{#if error}
			<p class="text-sm text-destructive" role="alert">{error}</p>
		{/if}

		{#if quotaFull}
			<div
				class="rounded-lg bg-destructive/15 p-4 text-center"
				role="alert"
			>
				<p class="font-semibold text-destructive">
					Kuota lomba sudah habis.
				</p>
				<p class="mt-1 text-xs text-muted-foreground">
					Silakan pilih lomba lain atau hubungi panitia.
				</p>
				<button
					type="button"
					class="btn btn-ghost btn-sm mt-2"
					onclick={() => (quotaFull = false)}
				>
					Pilih lomba lain
				</button>
			</div>
		{/if}

		<button type="submit" class="btn btn-gold" disabled={!formValid}>
			{#if submitting}
				<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
				Mendaftar…
			{:else if !$online}
				Simpan untuk offline
			{:else}
				Daftar sekarang
			{/if}
		</button>
	</form>
{/if}

<TermsDialog
	open={termsCompetition !== null}
	title="Syarat & Ketentuan"
	competition={termsCompetition}
	onclose={() => (termsCompetition = null)}
/>
