<script lang="ts">
	import { onMount } from "svelte";
	import { AlertTriangle, Loader2 } from "@lucide/svelte";
	import { page } from "$app/state";
	import TicketCard from "$lib/components/TicketCard.svelte";
	import {
		getCompetitions,
		getParticipantById,
		getPayments,
	} from "$lib/db/queries";
	import type { Competition, Participant } from "$lib/db/queries";
	import { env } from "$lib/env";
	import { selectThermalWidth } from "$lib/utils/thermal";

	let participant = $state<Participant | null>(null);
	let competition = $state<Competition | undefined>(undefined);
	let loading = $state(true);
	let error = $state("");
	let ticketBlocked = $state(false);
	let ticketBlockReason = $state("");
	let printWidth = $state(80);

	onMount(() => {
		printWidth = selectThermalWidth(
			new URLSearchParams(window.location.search),
		);
	});

	$effect(() => {
		const id = page.params.id;
		if (!id) {
			return;
		}
		loading = true;
		error = "";
		ticketBlocked = false;
		ticketBlockReason = "";
		void (async () => {
			try {
				const p = await getParticipantById(id);
				participant = p;
				if (p) {
					const [comps, payments] = await Promise.all([
						getCompetitions(false),
						getPayments(p.id),
					]);
					competition = comps.find((c) => c.id === p.competitionId);
					const rejected = payments.find(
						(payment) =>
							!payment.isVerified &&
							Boolean(payment.rejectReason?.trim()),
					);
					ticketBlocked = Boolean(rejected);
					ticketBlockReason = rejected?.rejectReason?.trim() ?? "";
				}
			} catch (e) {
				error = e instanceof Error ? e.message : "Gagal memuat tiket.";
			} finally {
				loading = false;
			}
		})();
	});
</script>

<svelte:head>
	<title>E-Tiket | {env.appName}</title>
</svelte:head>

<div class="px-4 py-8">
	{#if loading}
		<div
			class="flex flex-col items-center gap-2 py-16 text-muted-foreground"
		>
			<Loader2 class="h-6 w-6 animate-spin" aria-hidden="true" />
			<p class="text-sm">Memuat tiket…</p>
		</div>
	{:else if error || !participant}
		<div
			class="rounded-xl border border-border bg-background/60 p-8 text-center"
		>
			<AlertTriangle
				class="mx-auto h-8 w-8 text-destructive"
				aria-hidden="true"
			/>
			<h1 class="mt-3 text-lg font-bold">Tiket tidak ditemukan</h1>
			<p class="mt-1 text-sm text-muted-foreground">
				Periksa kembali link tiket Anda, atau hubungi panitia.
			</p>
		</div>
	{:else if ticketBlocked}
		<div
			class="rounded-xl border border-rose-300/30 bg-rose-300/10 p-8 text-center"
		>
			<AlertTriangle
				class="mx-auto h-8 w-8 text-rose-200"
				aria-hidden="true"
			/>
			<h1 class="mt-3 text-lg font-bold text-rose-100">
				E-tiket terkunci
			</h1>
			<p class="mt-1 text-sm text-rose-100/80">
				Pembayaran pendaftaran ditolak admin, sehingga e-tiket tidak
				dapat diakses.
			</p>
			{#if ticketBlockReason}
				<p
					class="mx-auto mt-3 rounded-lg border border-rose-200/20 bg-black/15 p-3 text-sm text-rose-100"
				>
					Alasan: {ticketBlockReason}
				</p>
			{/if}
		</div>
	{:else}
		<TicketCard {participant} {competition} {printWidth} />
		<p
			class="mx-auto mt-4 max-w-md text-center text-[11px] leading-relaxed text-muted-foreground"
			role="note"
		>
			E-tiket ini adalah bukti pendaftaran. Data ditampilkan sebagai bentuk
			kemudahan (login guest berbasis nomor WA) dan bukan jaminan keamanan
			ketat — jangan bagikan link tiket ke pihak lain. (Keputusan produk:
			risiko privasi diterima sebagai UX gate.)
		</p>
	{/if}
</div>
