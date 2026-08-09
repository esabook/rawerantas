<script lang="ts">
	import {
		Banknote,
		CheckCircle2,
		Info,
		Loader2,
		LogIn,
		XCircle,
	} from "@lucide/svelte";
	import { onMount } from "svelte";
	import { sfx, vibrate } from "$lib/audio/sfx";
	import TermsDialog from "$lib/components/TermsDialog.svelte";
	import { undoable } from "$lib/components/toast/toastStore";
	import {
		CheckinError,
		checkInParticipant,
		getCheckinSummary,
	} from "$lib/db/checkin";
	import type { CheckinSummary } from "$lib/db/checkin";
	import { submitCashPayment } from "$lib/db/payment";

	let {
		participantId,
		onDone,
	}: {
		participantId: string;
		onDone?: () => void;
	} = $props();

	let summary = $state<CheckinSummary | null>(null);
	let loading = $state(true);
	let checking = $state(false);
	let paying = $state(false);
	let error = $state("");
	// B2-4/F7/F16: true bila ada op queued (check-in / bayar tunai offline)
	// yang belum tersinkron — tampilkan badge "menunggu sinkron".
	let syncPending = $state(false);
	let showTerms = $state(false);

	const statusLabel: Record<string, string> = {
		registered: "Terdaftar",
		dp_paid: "DP lunas",
		fully_paid: "Lunas",
		checked_in: "Sudah check-in",
		disqualified: "Didiskualifikasi",
	};

	const load = async () => {
		loading = true;
		error = "";
		try {
			summary = await getCheckinSummary(participantId);
		} catch (e) {
			error = e instanceof Error ? e.message : "Gagal memuat peserta.";
		} finally {
			loading = false;
		}
	};

	onMount(() => {
		void load();
	});

	const checkin = async () => {
		if (checking || paying || summary?.paymentRejected) {
			return;
		}
		checking = true;
		error = "";
		try {
			const { eligibility, queued } = await checkInParticipant(
				participantId,
				null,
			);
			syncPending = syncPending || Boolean(queued);
			if (eligibility === "already") {
				undoable("Peserta sudah check-in sebelumnya.", {
					onConfirm: () => {},
				});
				sfx.confirm();
				vibrate(40);
			} else {
				undoable("Check-in berhasil.", { onConfirm: () => {} });
				sfx.coin();
				vibrate([80, 40, 120]);
			}
			await load();
			onDone?.();
		} catch (e) {
			sfx.error();
			vibrate([120, 60, 120]);
			error =
				e instanceof CheckinError || e instanceof Error
					? e.message
					: "Gagal check-in.";
		} finally {
			checking = false;
		}
	};

	// QW-4/A10: alasan check-in terblokir — tombol dinonaktifkan alih-alih
	// melempar error saat diklik. Status layak hanya dp_paid/fully_paid
	// (cermin guard checkInParticipant di checkin.ts).
	const checkinBlockedReason = $derived.by((): string => {
		if (!summary) return "";
		if (summary.status === "disqualified") {
			return "Peserta didiskualifikasi.";
		}
		if (summary.status !== "dp_paid" && summary.status !== "fully_paid") {
			return "Belum memenuhi syarat masuk (minimal DP dibayar).";
		}
		return "";
	});

	const payCash = async () => {
		if (
			!summary ||
			paying ||
			checking ||
			summary.paymentRejected ||
			summary.remaining <= 0
		) {
			return;
		}
		paying = true;
		error = "";
		try {
			const result = await submitCashPayment(
				{
					participantId: summary.participant.id,
					competitionId: summary.participant.competitionId,
				},
				{ fee: summary.fee },
			);
			// B2-4/F16: op tunai offline masuk antrean — tandai "menunggu
			// sinkron" & jangan tampilkan error misleading dari load() offline.
			syncPending = syncPending || Boolean(result.queued);
			undoable(
				result.queued
					? "Pelunasan tunai menunggu sinkron."
					: "Pelunasan tunai berhasil dicatat.",
				{ onConfirm: () => {} },
			);
			sfx.coin();
			vibrate([80, 40, 120]);
			if (!result.queued) {
				await load();
			}
		} catch (e) {
			sfx.error();
			vibrate([120, 60, 120]);
			error =
				e instanceof Error
					? e.message
					: "Gagal mencatat pembayaran tunai.";
		} finally {
			paying = false;
		}
	};
</script>

{#if loading}
	<div class="flex items-center gap-2 py-6 text-muted-foreground">
		<Loader2 class="h-5 w-5 animate-spin" aria-hidden="true" />
		<p class="text-sm">Memuat peserta…</p>
	</div>
{:else if error && !summary}
	<div
		class="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
		role="alert"
	>
		<XCircle class="mr-1 inline h-4 w-4" aria-hidden="true" />
		{error}
	</div>
{:else if summary}
	<div
		class="flex flex-col gap-3 rounded-xl border border-border bg-background/60 p-5"
	>
		<div class="flex items-start justify-between gap-3">
			<div>
				<p class="text-lg font-bold">{summary.participant.name}</p>
				<p class="text-xs text-muted-foreground">
					{summary.competitionName} · Tiket {summary.participant
						.ticketNumber}
				</p>
				<p class="text-xs text-muted-foreground">
					BIB {summary.participant.lapakNumber}
				</p>
			</div>
			<div class="flex shrink-0 items-center gap-1.5">
				<button
					type="button"
					class="p-1 text-muted-foreground transition-colors hover:text-foreground"
					title="Syarat & Ketentuan"
					aria-label="Lihat Syarat & Ketentuan"
					onclick={() => (showTerms = true)}
				>
					<Info class="h-4 w-4" aria-hidden="true" />
				</button>
				<span
					class="rounded-full px-2.5 py-1 text-xs font-semibold {summary.paymentRejected
						? 'bg-rose-500/15 text-rose-600'
						: summary.status === 'checked_in'
							? 'bg-sky-500/15 text-sky-600'
							: summary.status === 'disqualified'
								? 'bg-destructive/15 text-destructive'
								: summary.status === 'fully_paid'
									? 'bg-emerald-500/15 text-emerald-600'
									: 'bg-amber-500/15 text-amber-600'}"
				>
					{summary.paymentRejected
						? "Pembayaran ditolak"
						: (statusLabel[summary.status] ?? summary.status)}
				</span>
			</div>
		</div>

		<div
			class="flex justify-between rounded-lg border border-border/60 px-2 py-2 text-sm"
		>
			<span class="text-muted-foreground">Sisa bayar</span>
			<span class="font-mono font-semibold tabular-nums">
				{summary.remaining.toLocaleString("id-ID")}
			</span>
		</div>

		{#if summary.pendingAmount > 0}
			<div
				class="rounded-lg border border-sky-400/40 bg-sky-500/10 p-3 text-sm text-sky-700"
				role="note"
			>
				<p class="font-semibold">
					Pembayaran Rp {summary.pendingAmount.toLocaleString(
						"id-ID",
					)} menunggu verifikasi admin ({summary.pendingCount} bukti).
				</p>
				<p class="mt-1 text-xs">
					Jangan tagih ulang full. Sisa bayar di atas menghitung hanya
					pembayaran yang sudah diverifikasi.
				</p>
			</div>
		{/if}

		{#if summary.paymentRejected}
			<div
				class="rounded-lg border border-rose-400/40 bg-rose-500/10 p-3 text-sm text-rose-700"
				role="alert"
			>
				<p>Pembayaran ditolak admin. Peserta tidak dapat check-in.</p>
				{#if summary.rejectionReason}
					<p class="mt-1 text-xs">
						Alasan: {summary.rejectionReason}
					</p>
				{/if}
			</div>
		{/if}

		{#if summary.checkedInAt}
			<p class="text-xs text-muted-foreground" role="status">
				Check-in: {summary.checkedInAt.toLocaleTimeString("id-ID")}
			</p>
		{/if}

		{#if syncPending}
			<p
				class="mt-2 flex items-center gap-1.5 rounded-lg border border-sky-400/40 bg-sky-500/10 px-2 py-1.5 text-xs text-sky-700"
				role="status"
			>
				<Loader2 class="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
				Menunggu sinkron — perubahan tercatat di perangkat ini.
			</p>
		{/if}

		{#if error}
			<p class="text-sm text-destructive" role="alert">{error}</p>
		{/if}

		{#if !summary.paymentRejected && summary.remaining > 0}
			<button
				type="button"
				class="btn btn-ghost h-11 text-sm"
				onclick={() => void payCash()}
				disabled={paying || checking}
			>
				{#if paying}
					<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
					Mencatat…
				{:else}
					<Banknote class="h-4 w-4" aria-hidden="true" />
					Bayar tunai Rp {summary.remaining.toLocaleString("id-ID")}
				{/if}
			</button>
		{/if}

		{#if summary.paymentRejected}
			<p class="text-sm font-semibold text-rose-700" role="status">
				Check-in diblokir.
			</p>
		{:else if summary.status !== "checked_in"}
			<button
				type="button"
				class="btn btn-gold h-12 text-base"
				onclick={() => void checkin()}
				disabled={checking || paying || checkinBlockedReason !== ""}
			>
				{#if checking}
					<Loader2 class="h-5 w-5 animate-spin" aria-hidden="true" />
					Memproses…
				{:else}
					<LogIn class="h-5 w-5" aria-hidden="true" />
					Check-in Peserta
				{/if}
			</button>
			{#if checkinBlockedReason !== ""}
				<p class="text-xs text-muted-foreground" role="status">
					{checkinBlockedReason}
				</p>
			{/if}
		{:else}
			<p
				class="flex items-center gap-1.5 text-sm text-emerald-600"
				role="status"
			>
				<CheckCircle2 class="h-4 w-4" aria-hidden="true" />
				Peserta sudah masuk.
			</p>
		{/if}
	</div>
{/if}

<TermsDialog
	open={showTerms}
	title="Syarat & Ketentuan"
	competition={
		summary
			? {
					id: summary.participant.competitionId,
					name: summary.competitionName ?? "",
				}
			: null
	}
	onclose={() => (showTerms = false)}
/>
