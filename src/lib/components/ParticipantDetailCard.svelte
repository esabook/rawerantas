<script lang="ts">
	import { CheckCircle2, Loader2, LogIn, UserCheck, XCircle } from "@lucide/svelte";
	import { onMount } from "svelte";
	import { sfx, vibrate } from "$lib/audio/sfx";
	import { undoable } from "$lib/components/toast/toastStore";
	import {
		CheckinError,
		checkInParticipant,
		getCheckinSummary,
	} from "$lib/db/checkin";
	import type { CheckinSummary } from "$lib/db/checkin";

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
	let error = $state("");

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
		if (checking) {
			return;
		}
		checking = true;
		error = "";
		try {
			const { eligibility } = await checkInParticipant(participantId, null);
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
</script>

{#if loading}
	<div class="flex items-center gap-2 py-6 text-muted-foreground">
		<Loader2 class="h-5 w-5 animate-spin" aria-hidden="true" />
		<p class="text-sm">Memuat peserta…</p>
	</div>
{:else if error && !summary}
	<div class="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive" role="alert">
		<XCircle class="mr-1 inline h-4 w-4" aria-hidden="true" />
		{error}
	</div>
{:else if summary}
	<div class="flex flex-col gap-3 rounded-xl border border-border bg-background/60 p-5">
		<div class="flex items-start justify-between gap-3">
			<div>
				<p class="text-lg font-bold">{summary.participant.name}</p>
				<p class="text-xs text-muted-foreground">
					{summary.competitionName} · Tiket {summary.participant.ticketNumber}
				</p>
				<p class="text-xs text-muted-foreground">
					Lapak {summary.participant.lapakNumber}
				</p>
			</div>
			<span
				class="rounded-full px-2.5 py-1 text-xs font-semibold {summary.status === 'checked_in'
					? 'bg-sky-500/15 text-sky-600'
					: summary.status === 'disqualified'
						? 'bg-destructive/15 text-destructive'
						: summary.status === 'fully_paid'
							? 'bg-emerald-500/15 text-emerald-600'
							: 'bg-amber-500/15 text-amber-600'}"
			>
				{statusLabel[summary.status] ?? summary.status}
			</span>
		</div>

		<div class="flex justify-between rounded-lg border border-border/60 px-3 py-2 text-sm">
			<span class="text-muted-foreground">Sisa bayar</span>
			<span class="font-mono font-semibold tabular-nums">
				{summary.remaining.toLocaleString("id-ID")}
			</span>
		</div>

		{#if summary.checkedInAt}
			<p class="text-xs text-muted-foreground" role="status">
				Check-in: {summary.checkedInAt.toLocaleTimeString("id-ID")}
			</p>
		{/if}

		{#if error}
			<p class="text-sm text-destructive" role="alert">{error}</p>
		{/if}

		{#if summary.status !== "checked_in"}
			<button
				type="button"
				class="btn btn-gold h-12 text-base"
				onclick={() => void checkin()}
				disabled={checking || summary.status === "disqualified"}
			>
				{#if checking}
					<Loader2 class="h-5 w-5 animate-spin" aria-hidden="true" />
					Memproses…
				{:else}
					<LogIn class="h-5 w-5" aria-hidden="true" />
					Check-in Peserta
				{/if}
			</button>
		{:else}
			<p class="flex items-center gap-1.5 text-sm text-emerald-600" role="status">
				<CheckCircle2 class="h-4 w-4" aria-hidden="true" />
				Peserta sudah masuk.
			</p>
		{/if}
	</div>
{/if}
