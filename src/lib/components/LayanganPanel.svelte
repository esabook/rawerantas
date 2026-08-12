<script lang="ts">
	import {
		Ban,
		CheckCircle2,
		Loader2,
		Play,
		RotateCcw,
		Search,
		Square,
		Trophy,
		Wind,
		X,
	} from "@lucide/svelte";
	import { onMount } from "svelte";
	import { sfx, vibrate } from "$lib/audio/sfx";
	import { undoable } from "$lib/components/toast/toastStore";
	import { startRound, stopRound } from "$lib/db/admin";
	import { getCompetitions, getParticipants } from "$lib/db/queries";
	import type { Competition, Participant } from "$lib/db/queries";
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
	// B/A: timer bersama per babak — bukan per-kartu-peserta. "Mulai Lomba"
	// sekali menulis round_started_at ke kompetisi; semua kartu baca titik
	// mulai yang sama.
	let competition = $state<Competition | null>(null);
	let elapsedMs = $state(0);
	let confirmRestart = $state(false);
	let confirmStop = $state(false);
	let startingRound = $state(false);
	// B/A: echo optimistik terpisah dari `competition` yang dipoll — sebuah
	// `load()` bisa saja *dimulai* sebelum aksi lokal (Mulai Lomba/Selesai
	// Babak) selesai ditulis server, jadi hasilnya boleh saja balik dan masih
	// membawa data lama walau resolve BELAKANGAN. `localAction.at` dicatat saat
	// tombol ditekan; override hanya dilepas begitu ada fetch yang MULAI
	// setelah itu — bukan sekadar fetch mana pun yang resolve belakangan.
	// Berlaku utk start maupun stop (server tidak selalu punya timestamp utk
	// dibandingkan, khususnya saat di-null-kan oleh stop).
	let localAction = $state<{
		round: number;
		value: number | null;
		at: number;
	} | null>(null);
	let trustServerFetchesAfter = $state(0);

	const roundStartedAtMs = $derived.by(() => {
		const server =
			competition?.roundStartedRound === round &&
			competition?.roundStartedAt
				? new Date(competition.roundStartedAt).getTime()
				: null;
		if (
			localAction &&
			localAction.round === round &&
			trustServerFetchesAfter <= localAction.at
		) {
			return localAction.value;
		}
		return server;
	});

	const normalizeStatus = (
		status: LayanganScoreRecord["status"],
	): LayanganStatus => status;

	const layanganLabel = (status: LayanganScoreRecord["status"]): string => {
		if (status === "menang" || status === "mudun") return "MUDUN";
		if (status === "dq") return "DQ";
		return "PUTUS";
	};

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
		// B3-1/A23: offline-safe — kegagalan fetch tidak boleh mengosongkan panel.
		const fetchStartedAt = Date.now();
		try {
			const [rows, roundResults, competitions] = await Promise.all([
				getParticipants(competitionId),
				getRoundResults(competitionId, round),
				getCompetitions(false),
			]);
			participants = rows;
			results = roundResults;
			competition =
				competitions.find((c) => c.id === competitionId) ?? competition;
			trustServerFetchesAfter = fetchStartedAt;
		} catch {
			// pertahankan data yang sudah ada; juri tetap bisa menilai offline.
		}
	};

	onMount(() => {
		void load();
		// B3-3/A36: polling ringan agar peserta baru muncul tanpa reload — juga
		// jadi jalur sinkron "Mulai Lomba" antar-perangkat juri (≤30 detik).
		const timer = setInterval(load, 30_000);
		return () => clearInterval(timer);
	});

	// Jam bersama: jalan otomatis selama roundStartedAtMs ada, berhenti sendiri
	// begitu babak basi (admin advance) atau timer di-reset — tidak terikat
	// buka/tutup dialog kartu peserta.
	$effect(() => {
		if (roundStartedAtMs === null) {
			elapsedMs = 0;
			return;
		}
		elapsedMs = Date.now() - roundStartedAtMs;
		const interval = setInterval(() => {
			elapsedMs = Date.now() - roundStartedAtMs;
		}, 250);
		return () => clearInterval(interval);
	});

	const formatDuration = (ms: number): string => {
		const totalSeconds = Math.max(0, Math.round(ms / 1000));
		const minutes = Math.floor(totalSeconds / 60);
		const seconds = totalSeconds % 60;
		return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
	};

	const handleStartRound = async () => {
		if (startingRound) {
			return;
		}
		if (roundStartedAtMs !== null && !confirmRestart) {
			confirmRestart = true;
			return;
		}
		const actionAt = Date.now();
		startingRound = true;
		error = "";
		try {
			const res = await startRound(competitionId, round, recordedBy);
			localAction = {
				round,
				value: new Date(res.startedAt).getTime(),
				at: actionAt,
			};
			confirmRestart = false;
			sfx.confirm();
			vibrate(60);
			if (res.queued) {
				undoable("Mulai lomba tersimpan lokal — menunggu sinkron.", {
					onConfirm: () => {},
				});
			}
		} catch (e) {
			error = e instanceof Error ? e.message : "Gagal memulai babak.";
		} finally {
			startingRound = false;
		}
	};

	const handleStopRound = async () => {
		if (startingRound) {
			return;
		}
		if (!confirmStop) {
			confirmStop = true;
			return;
		}
		const actionAt = Date.now();
		startingRound = true;
		error = "";
		try {
			const res = await stopRound(competitionId);
			localAction = { round, value: null, at: actionAt };
			confirmStop = false;
			sfx.confirm();
			vibrate(40);
			if (res.queued) {
				undoable("Selesai babak tersimpan lokal — menunggu sinkron.", {
					onConfirm: () => {},
				});
			}
		} catch (e) {
			error = e instanceof Error ? e.message : "Gagal menutup babak.";
		} finally {
			startingRound = false;
		}
	};

	const cancelRestart = () => {
		confirmRestart = false;
	};

	const cancelStop = () => {
		confirmStop = false;
	};

	const submit = async (
		p: Participant,
		status: LayanganStatus,
		flightDurationMs: number | null,
	) => {
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
			const label = `${p.name} — ${layanganLabel(status)}`;
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
			results = await getRoundResults(competitionId, round).catch(
				() => results,
			);
			selectedParticipant = null;
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
		sfx.tap();
		vibrate(10);
	};

	const closeParticipantDialog = () => {
		if (submittingId === null) {
			selectedParticipant = null;
		}
	};

	const submitSelected = (status: LayanganStatus) => {
		if (!selectedParticipant) {
			return;
		}
		// Math.max(0, ...): jam perangkat yang menekan "Mulai Lomba" bisa maju
		// dibanding perangkat yang mencatat hasil — jangan simpan durasi
		// negatif (formatDuration sudah clamp di tampilan, samakan di sini).
		const durationMs =
			roundStartedAtMs !== null
				? Math.max(0, Date.now() - roundStartedAtMs)
				: null;
		void submit(selectedParticipant, status, durationMs);
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

	{#if roundStartedAtMs === null}
		<button
			type="button"
			class="btn h-12 w-full bg-gold text-slate-950 hover:bg-gold/90"
			onclick={() => void handleStartRound()}
			disabled={startingRound}
		>
			{#if startingRound}
				<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
			{:else}
				<Play class="h-4 w-4" aria-hidden="true" />
			{/if}
			Mulai Lomba
		</button>
	{:else if confirmRestart}
		<div
			class="flex flex-col gap-2 rounded-lg border border-amber-400/40 bg-amber-500/10 p-3 text-sm text-amber-700"
			role="alert"
		>
			<p>
				Timer sudah berjalan sejak {formatDuration(elapsedMs)} lalu. Peserta
				yang sudah dicatat tidak berubah — cuma titik mulai utk peserta berikutnya
				yang di-reset. Mulai ulang?
			</p>
			<div class="flex gap-2">
				<button
					type="button"
					class="btn btn-ghost flex-1"
					onclick={cancelRestart}
					disabled={startingRound}
				>
					Batal
				</button>
				<button
					type="button"
					class="btn flex-1 bg-amber-600 text-white hover:bg-amber-700"
					onclick={() => void handleStartRound()}
					disabled={startingRound}
				>
					{#if startingRound}
						<Loader2
							class="h-4 w-4 animate-spin"
							aria-hidden="true"
						/>
					{:else}
						<RotateCcw class="h-4 w-4" aria-hidden="true" />
					{/if}
					Ya, mulai ulang
				</button>
			</div>
		</div>
	{:else if confirmStop}
		<div
			class="flex flex-col gap-2 rounded-lg border border-border/60 bg-muted/30 p-3 text-sm"
			role="alert"
		>
			<p>Tutup timer babak ini?</p>
			<p>
				Peserta yang sudah dicatat tidak akan berubah, sedangkan peserta
				yang belum dicatat juri, tidak bisa dicatat MUDUN/PUTUS sampai
				juri tekan Mulai Lomba lagi. Pastikan semua juri sudah selesai
				menilai sebelum menutup babak. Pastikan peserta belum dinilai
				sudah nol (0).
			</p>
			<div class="flex gap-2">
				<button
					type="button"
					class="btn btn-ghost flex-1"
					onclick={cancelStop}
					disabled={startingRound}
				>
					Batal
				</button>
				<button
					type="button"
					class="btn flex-1 bg-slate-700 text-white hover:bg-slate-800"
					onclick={() => void handleStopRound()}
					disabled={startingRound}
				>
					{#if startingRound}
						<Loader2
							class="h-4 w-4 animate-spin"
							aria-hidden="true"
						/>
					{:else}
						<Square class="h-4 w-4" aria-hidden="true" />
					{/if}
					Ya, selesai babak
				</button>
			</div>
		</div>
	{:else}
		<div
			class="flex items-center justify-between gap-3 rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-3 py-2"
		>
			<p class="text-sm text-emerald-700">
				Dimulai <span class="font-mono font-semibold tabular-nums"
					>{formatDuration(elapsedMs)}</span
				> lalu
			</p>
			<div class="flex gap-1.5">
				<button
					type="button"
					class="btn btn-ghost px-2 py-1 text-xs"
					onclick={() => (confirmRestart = true)}
				>
					<RotateCcw class="h-3.5 w-3.5" aria-hidden="true" />
					Ulangi
				</button>
				<button
					type="button"
					class="btn btn-ghost px-2 py-1 text-xs"
					onclick={() => (confirmStop = true)}
				>
					<Square class="h-3.5 w-3.5" aria-hidden="true" />
					Selesai Babak
				</button>
			</div>
		</div>
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
						aria-label={`${p.name}, ${status === undefined ? "belum dinilai" : layanganLabel(status).toLowerCase()}`}
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
									<span class="break-all">{p.phone}</span>
									<span class="break-all font-mono"
										>Tiket {p.ticketNumber}</span
									>
								</div>
								{#if p.lapakNumber}
									<span>No Peserta #{p.lapakNumber}</span>
								{/if}
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
								{status === undefined
									? "BELUM DINILAI"
									: layanganLabel(status)}
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
							>{layanganLabel(selectedStatus)}</strong
						>.
					</p>
				</div>
			{:else}
				<div
					class="mt-5 flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/30 p-4"
				>
					<span class="text-sm font-medium">Waktu terbang</span>
					{#if roundStartedAtMs !== null}
						<span class="font-mono text-2xl font-bold tabular-nums">
							{formatDuration(elapsedMs)}
						</span>
					{:else}
						<span class="text-xs text-muted-foreground"
							>Babak belum dimulai</span
						>
					{/if}
				</div>

				<p class="mt-5 text-sm leading-relaxed text-muted-foreground">
					{#if roundStartedAtMs === null}
						Tekan <strong class="text-foreground"
							>Mulai Lomba</strong
						> dulu utk mencatat MUDUN/PUTUS. DQ tetap bisa dicatat kapan
						saja.
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
						disabled={submittingId !== null ||
							roundStartedAtMs === null}
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
						disabled={submittingId !== null ||
							roundStartedAtMs === null}
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
					<button
						type="button"
						class="btn h-12 bg-slate-700 text-white hover:bg-slate-800"
						onclick={() => submitSelected("dq")}
						disabled={submittingId !== null}
					>
						{#if submittingId === selectedParticipant.id}
							<Loader2
								class="h-4 w-4 animate-spin"
								aria-hidden="true"
							/>
						{:else}
							<Ban class="h-4 w-4" aria-hidden="true" />
						{/if}
						Catat DQ
					</button>
				</div>
			{/if}
		</div>
	</div>
{/if}
