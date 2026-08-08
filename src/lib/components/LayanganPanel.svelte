<script lang="ts">
	import {
		CheckCircle2,
		Loader2,
		Play,
		Search,
		Square,
		Trophy,
		Wind,
		X,
	} from "@lucide/svelte";
	import { onDestroy, onMount } from "svelte";
	import { sfx, vibrate } from "$lib/audio/sfx";
	import { undoable } from "$lib/components/toast/toastStore";
	import { getParticipants } from "$lib/db/queries";
	import type { Participant } from "$lib/db/queries";
	import {
		getRoundResults,
		removeLayanganScore,
		submitLayanganResult,
	} from "$lib/db/layangan";
	import type { LayanganScoreRecord, LayanganStatus } from "$lib/db/layangan";
	import { online } from "$lib/offline/networkStore";

	let {
		competitionId,
		competitionName,
		round,
		recordedBy,
	}: {
		competitionId: string;
		competitionName: string;
		round: number;
		recordedBy: string;
	} = $props();

	let participants = $state<Participant[]>([]);
	let results = $state<LayanganScoreRecord[]>([]);
	let submittingId = $state<string | null>(null);
	let searchQuery = $state("");
	let statusFilter = $state<"pending" | "scored">("pending");
	let selectedParticipant = $state<Participant | null>(null);
	let error = $state("");
	let timerStartedAt = $state<number | null>(null);
	let flightDurationMs = $state<number | null>(null);
	let elapsedMs = $state(0);
	let timerInterval: ReturnType<typeof setInterval> | null = null;

	const normalizeStatus = (
		status: LayanganScoreRecord["status"],
	): LayanganStatus => (status === "putus" ? "putus" : "menang");

	const resultByParticipant = $derived(
		new Map(
			results.map((r) => [r.participantId, normalizeStatus(r.status)]),
		),
	);
	const pendingParticipants = $derived(
		participants.filter((p) => !resultByParticipant.has(p.id)),
	);
	const scoredParticipants = $derived(
		participants.filter((p) => resultByParticipant.has(p.id)),
	);
	const statusFilteredParticipants = $derived(
		statusFilter === "pending" ? pendingParticipants : scoredParticipants,
	);
	const filteredParticipants = $derived(
		statusFilteredParticipants.filter((p) => {
			const query = searchQuery.trim().toLowerCase();
			if (!query) return true;
			return [p.ticketNumber, p.lapakNumber, p.name]
				.filter(Boolean)
				.some((value) => value?.toLowerCase().includes(query));
		}),
	);
	const selectedStatus = $derived(
		selectedParticipant
			? resultByParticipant.get(selectedParticipant.id)
			: undefined,
	);

	const load = async () => {
		const [rows, roundResults] = await Promise.all([
			getParticipants(competitionId),
			getRoundResults(competitionId, round),
		]);
		participants = rows;
		results = roundResults;
	};

	onMount(() => {
		void load();
	});

	onDestroy(() => {
		if (timerInterval !== null) {
			clearInterval(timerInterval);
		}
	});

	const formatDuration = (ms: number): string => {
		const totalSeconds = Math.max(0, Math.round(ms / 1000));
		const minutes = Math.floor(totalSeconds / 60);
		const seconds = totalSeconds % 60;
		return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
	};

	const resetTimer = () => {
		if (timerInterval !== null) {
			clearInterval(timerInterval);
			timerInterval = null;
		}
		timerStartedAt = null;
		flightDurationMs = null;
		elapsedMs = 0;
	};

	const startTimer = () => {
		timerStartedAt = Date.now();
		flightDurationMs = null;
		elapsedMs = 0;
		timerInterval = setInterval(() => {
			if (timerStartedAt !== null) {
				elapsedMs = Date.now() - timerStartedAt;
			}
		}, 250);
	};

	const stopTimer = () => {
		if (timerStartedAt === null) {
			return;
		}
		flightDurationMs = Date.now() - timerStartedAt;
		elapsedMs = flightDurationMs;
		if (timerInterval !== null) {
			clearInterval(timerInterval);
			timerInterval = null;
		}
		timerStartedAt = null;
	};

	const submit = async (p: Participant, status: LayanganStatus) => {
		if (submittingId !== null) {
			return;
		}
		if (resultByParticipant.get(p.id)) {
			error = `${p.name} sudah tercatat pada babak ini.`;
			return;
		}
		submittingId = p.id;
		error = "";
		try {
			const result = await submitLayanganResult({
				competitionId,
				participantId: p.id,
				round,
				status,
				flightDurationMs,
				recordedBy,
			});
			const label = `${p.name} — ${status === "menang" ? "MUDUN" : "PUTUS"}`;
			undoable(
				result.queued ? `Antrean: ${label}` : `Tersimpan: ${label}`,
				{
					onUndo: () => {
						void removeLayanganScore(result.id, result.queued).then(
							() => {
								void load();
								undoable("Hasil dibatalkan", {
									onConfirm: () => {},
									timeoutMs: 2000,
								});
							},
						);
					},
					onConfirm: () => {},
				},
			);
			results = await getRoundResults(competitionId, round);
			selectedParticipant = null;
			resetTimer();
			if (status === "menang") {
				sfx.fanfare();
				vibrate([60, 40, 100]);
			} else {
				sfx.confirm();
				vibrate(60);
			}
		} catch (e) {
			sfx.error();
			vibrate([120, 60, 120]);
			error = e instanceof Error ? e.message : "Gagal menyimpan hasil.";
		} finally {
			submittingId = null;
		}
	};

	const selectParticipant = (p: Participant) => {
		selectedParticipant = p;
		error = "";
		resetTimer();
		sfx.tap();
		vibrate(10);
	};

	const closeParticipantDialog = () => {
		if (submittingId === null) {
			selectedParticipant = null;
			resetTimer();
		}
	};

	const submitSelected = (status: LayanganStatus) => {
		if (selectedParticipant) {
			void submit(selectedParticipant, status);
		}
	};
</script>

<div
	class="flex w-full flex-col gap-4 rounded-xl border border-border bg-background/60 p-4"
>
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-2">
			<Wind class="h-5 w-5 text-gold" aria-hidden="true" />
			<h1 class="font-bold">{competitionName}</h1>
			<span
				class="rounded-full bg-gold/15 px-2.5 py-1 text-xs font-semibold text-gold"
			>
				Babak {round}
			</span>
		</div>
		{#if !$online}
			<span
				class="rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-600"
			>
				Offline — antrean
			</span>
		{/if}
	</div>

	{#if error}
		<p class="text-sm text-destructive" role="alert">{error}</p>
	{/if}

	<div
		class="grid grid-cols-2 gap-2 rounded-lg border border-border/60 bg-background/40 p-1"
		role="tablist"
		aria-label="Filter status peserta"
	>
		<button
			type="button"
			class={`flex min-h-11 items-center justify-center gap-2 rounded-md px-2 py-2 text-sm font-semibold transition-colors ${statusFilter === "pending" ? "bg-gold text-slate-950" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
			onclick={() => (statusFilter = "pending")}
			role="tab"
			aria-selected={statusFilter === "pending"}
		>
			Belum dinilai
			<span
				class="rounded-full bg-black/10 px-2 py-0.5 text-xs tabular-nums"
				>{pendingParticipants.length}</span
			>
		</button>
		<button
			type="button"
			class={`flex min-h-11 items-center justify-center gap-2 rounded-md px-2 py-2 text-sm font-semibold transition-colors ${statusFilter === "scored" ? "bg-gold text-slate-950" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
			onclick={() => (statusFilter = "scored")}
			role="tab"
			aria-selected={statusFilter === "scored"}
		>
			Sudah dinilai
			<span
				class="rounded-full bg-black/10 px-2 py-0.5 text-xs tabular-nums"
				>{scoredParticipants.length}</span
			>
		</button>
	</div>

	<div
		class="flex flex-col gap-2 rounded-lg border border-border/60 bg-background/40 p-3 sm:flex-row sm:items-center"
	>
		<label class="relative min-w-0 flex-1">
			<span class="sr-only">Cari nomor peserta</span>
			<Search
				class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
				aria-hidden="true"
			/>
			<input
				type="search"
				bind:value={searchQuery}
				class="h-11 w-full rounded-lg border border-border bg-background px-2 pl-10 text-sm outline-none transition focus:border-gold"
				placeholder="Cari nomor peserta…"
				aria-label="Cari nomor peserta"
			/>
		</label>
		<p class="shrink-0 text-xs text-muted-foreground">
			{filteredParticipants.length} dari {statusFilteredParticipants.length}
			peserta
		</p>
	</div>

	{#if filteredParticipants.length === 0}
		<div
			class="rounded-lg border border-border/60 p-4 text-center text-sm text-muted-foreground"
		>
			{statusFilteredParticipants.length === 0
				? statusFilter === "pending"
					? "Semua peserta sudah dinilai."
					: "Belum ada peserta yang sudah dinilai."
				: "Nomor peserta tidak ditemukan."}
		</div>
	{:else}
		<ul
			class="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3"
		>
			{#each filteredParticipants as p (p.id)}
				{@const status = resultByParticipant.get(p.id)}
				<li class="min-w-0">
					<button
						type="button"
						class="flex min-h-28 w-full min-w-0 flex-col items-start justify-between gap-3 rounded-lg border border-border/60 bg-background/30 p-3 text-left transition-colors hover:border-gold/70 hover:bg-gold/5 focus-visible:border-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50"
						onclick={() => selectParticipant(p)}
						aria-label={`${p.name}, ${status === "menang" ? "MUDUN" : status === "putus" ? "PUTUS" : "belum dinilai"}`}
					>
						<div
							class="flex w-full min-w-0 items-start justify-between gap-3"
						>
							<div class="min-w-0 flex-1">
								<p
									class="break-words text-sm font-semibold leading-snug"
								>
									{p.name}
								</p>
								<div
									class="mt-1 flex min-w-0 flex-wrap gap-x-2 gap-y-1 text-xs text-muted-foreground"
								>
									<span class="break-all font-mono"
										>{p.ticketNumber}</span
									>
									{#if p.lapakNumber}
										<span>BIB {p.lapakNumber}</span>
									{/if}
									<span class="break-all">{p.phone}</span>
								</div>
							</div>
							<span
								class={`max-w-[45%] shrink-0 rounded-full px-2 py-1 text-center text-[10px] font-bold uppercase leading-tight tracking-wide ${
									status === "menang"
										? "bg-emerald-500/15 text-emerald-600"
										: status === "putus"
											? "bg-destructive/15 text-destructive"
											: "bg-muted text-muted-foreground"
								}`}
							>
								{status === "menang"
									? "MUDUN"
									: status === "putus"
										? "PUTUS"
										: "BELUM DINILAI"}
							</span>
						</div>
						<span class="text-[11px] text-muted-foreground"
							>Ketuk untuk membuka konfirmasi</span
						>
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>

{#if selectedParticipant}
	<div
		class="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 px-2 py-4 backdrop-blur-sm sm:items-center"
		role="presentation"
		onclick={(event) => {
			if (event.target === event.currentTarget) {
				closeParticipantDialog();
			}
		}}
	>
		<div
			class="w-full max-w-md rounded-2xl border border-border bg-background p-5 shadow-2xl"
			role="dialog"
			aria-modal="true"
			aria-labelledby="layangan-confirm-title"
			tabindex="-1"
		>
			<div class="flex items-start justify-between gap-3">
				<div class="min-w-0">
					<p
						class="text-xs font-bold uppercase tracking-wider text-gold"
					>
						Konfirmasi hasil
					</p>
					<h2
						id="layangan-confirm-title"
						class="mt-1 break-words text-lg font-bold"
					>
						{selectedParticipant.name}
					</h2>
					<p
						class="mt-1 break-all font-mono text-xs text-muted-foreground"
					>
						{selectedParticipant.ticketNumber}
					</p>
				</div>
				<button
					type="button"
					class="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
					onclick={closeParticipantDialog}
					aria-label="Tutup konfirmasi"
				>
					<X class="h-5 w-5" aria-hidden="true" />
				</button>
			</div>

			{#if selectedStatus}
				<div
					class="mt-5 flex items-center gap-3 rounded-lg border border-border/60 bg-muted/30 p-4"
				>
					<CheckCircle2
						class="h-5 w-5 shrink-0 text-emerald-500"
						aria-hidden="true"
					/>
					<p class="text-sm">
						Hasil babak ini sudah tercatat sebagai <strong
							>{selectedStatus === "menang"
								? "MUDUN"
								: "PUTUS"}</strong
						>.
					</p>
				</div>
			{:else}
				<div
					class="mt-5 rounded-lg border border-border/60 bg-muted/30 p-4"
				>
					<div class="flex items-center justify-between gap-3">
						<span class="text-sm font-medium">Waktu terbang</span>
						<span class="font-mono text-2xl font-bold tabular-nums">
							{formatDuration(elapsedMs)}
						</span>
					</div>
					<div class="mt-3">
						{#if timerStartedAt !== null}
							<button
								type="button"
								class="btn h-11 w-full bg-destructive text-white hover:bg-destructive/90"
								onclick={stopTimer}
							>
								<Square class="h-4 w-4" aria-hidden="true" />
								Berhenti
							</button>
						{:else}
							<button
								type="button"
								class="btn h-11 w-full bg-gold text-slate-950 hover:bg-gold/90"
								onclick={startTimer}
							>
								<Play class="h-4 w-4" aria-hidden="true" />
								{flightDurationMs === null
									? "Mulai Terbang"
									: "Ulangi Timer"}
							</button>
						{/if}
					</div>
				</div>

				<p class="mt-5 text-sm leading-relaxed text-muted-foreground">
					{#if flightDurationMs === null}
						Catat waktu terbang dulu, baru pilih hasil untuk <strong
							class="text-foreground">{selectedParticipant.name}</strong
						>.
					{:else}
						Pilih hasil untuk <strong class="text-foreground"
							>{selectedParticipant.name}</strong
						>. Aksi baru tersimpan setelah tombol di bawah ditekan.
					{/if}
				</p>
				<div class="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
					<button
						type="button"
						class="btn h-12 bg-emerald-600 text-white hover:bg-emerald-700"
						onclick={() => submitSelected("menang")}
						disabled={submittingId !== null || flightDurationMs === null}
					>
						{#if submittingId === selectedParticipant.id}
							<Loader2
								class="h-4 w-4 animate-spin"
								aria-hidden="true"
							/>
						{:else}
							<Trophy class="h-4 w-4" aria-hidden="true" />
						{/if}
						Catat MUDUN
					</button>
					<button
						type="button"
						class="btn h-12 bg-destructive text-white hover:bg-destructive/90"
						onclick={() => submitSelected("putus")}
						disabled={submittingId !== null || flightDurationMs === null}
					>
						{#if submittingId === selectedParticipant.id}
							<Loader2
								class="h-4 w-4 animate-spin"
								aria-hidden="true"
							/>
						{:else}
							<X class="h-4 w-4" aria-hidden="true" />
						{/if}
						Catat PUTUS
					</button>
				</div>
			{/if}
		</div>
	</div>
{/if}
