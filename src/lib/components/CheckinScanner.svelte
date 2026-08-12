<script lang="ts">
	import {
		Camera,
		CameraOff,
		Info,
		Loader2,
		ScanLine,
		Ticket,
		Users,
		UserCheck,
		UserPlus,
	} from "@lucide/svelte";
	import { onDestroy, onMount, tick } from "svelte";
	import ParticipantDetailCard from "$lib/components/ParticipantDetailCard.svelte";
	import SoundToggle from "$lib/components/SoundToggle.svelte";
	import TermsDialog from "$lib/components/TermsDialog.svelte";
	import {
		findParticipantByTicket,
		getCheckinStats,
		registerWalkinCheckin,
	} from "$lib/db/checkin";
	import { getCompetitions, getParticipantById } from "$lib/db/queries";
	import type { Competition } from "$lib/db/queries";
	import { isValidPhone, normalizePhone, QuotaFullError } from "$lib/db/register";
	import { formatStaffActor } from "$lib/db/staff";
	import { readStaffGrant } from "$lib/security/pin";

	type ScanState = "idle" | "scanning" | "stopping" | "error" | "done";
	let scanState = $state<ScanState>("idle");
	let error = $state("");
	let foundId = $state<string | null>(null);
	let manualTicket = $state("");
	let cameraNote = $state("");
	let stats = $state<Awaited<ReturnType<typeof getCheckinStats>> | null>(null);
	let statsLoading = $state(true);
	let statsError = $state("");
	let competitions = $state<Competition[]>([]);
	let selectedCompetitionId = $state("");
	let competitionError = $state("");
	let statsLoadToken = 0;
	let showTerms = $state(false);

	let showWalkin = $state(false);
	let walkinName = $state("");
	let walkinPhone = $state("");
	let walkinCompetitionId = $state("");
	let walkinSubmitting = $state(false);
	let walkinError = $state("");
	let walkinQuotaFull = $state(false);

	const walkinPhoneWithPrefix = $derived(
		walkinPhone.length > 0 ? `+62${walkinPhone}` : "",
	);
	const walkinValidLocalPhone = $derived(/^8\d{8,12}$/.test(walkinPhone));
	const walkinPhoneError = $derived(
		walkinPhone.length > 0 &&
			(!walkinValidLocalPhone || !isValidPhone(walkinPhoneWithPrefix)),
	);
	const walkinFormValid = $derived(
		walkinName.trim().length >= 2 &&
			walkinValidLocalPhone &&
			isValidPhone(walkinPhoneWithPrefix) &&
			walkinCompetitionId.length > 0 &&
			!walkinSubmitting,
	);
	const walkinFee = $derived(
		competitions.find((c) => c.id === walkinCompetitionId)?.fee ?? null,
	);

	// B/A: identitas panitia yg login (roster 6-digit HP) — dipakai sbg
	// registeredBy pendaftaran walk-in dan recordedBy check-in di halaman ini.
	const panitiaStaff = readStaffGrant("panitia");

	const termsCompetition = $derived(
		selectedCompetitionId
			? (competitions.find(
					(c) => c.id === selectedCompetitionId,
				) ?? null)
			: null,
	);

	let scanner: unknown = null;
	let stopScanning: (() => Promise<void>) | null = null;
	let videoEl: HTMLVideoElement | null = null;
	let cameraStartToken = 0;

	const loadStats = async () => {
		const loadToken = ++statsLoadToken;
		const competitionId = selectedCompetitionId || undefined;
		statsLoading = true;
		statsError = "";
		try {
			const nextStats = await getCheckinStats(competitionId);
			if (loadToken === statsLoadToken) {
				stats = nextStats;
			}
		} catch (e) {
			if (loadToken === statsLoadToken) {
				statsError =
					e instanceof Error ? e.message : "Gagal memuat statistik.";
			}
		} finally {
			if (loadToken === statsLoadToken) {
				statsLoading = false;
			}
		}
	};

	const loadCompetitions = async () => {
		competitionError = "";
		try {
			// Hanya lomba aktif — lomba yang admin nonaktifkan tidak perlu
			// muncul di loket check-in/walk-in.
			competitions = await getCompetitions(true);
		} catch (e) {
			competitionError =
				e instanceof Error ? e.message : "Gagal memuat daftar lomba.";
		}
	};

	const parseQrPayload = (decoded: string): string | null => {
		try {
			const url = new URL(decoded);
			const id = url.searchParams.get("id");
			return id && id.length > 0 ? id : null;
		} catch {
			if (decoded.startsWith("?")) {
				const params = new URLSearchParams(decoded.slice(1));
				const id = params.get("id");
				return id && id.length > 0 ? id : null;
			}
			return null;
		}
	};

	const handleDecoded = (text: string) => {
		const id = parseQrPayload(text);
		if (!id) {
			error = "QR tidak dikenal (harus berisi ?id=).";
			void stopCamera();
			return;
		}
		void openParticipant(id);
	};

	const openParticipant = async (id: string) => {
		try {
			const participant = await getParticipantById(id);
			if (!participant) {
				throw new Error("Peserta tidak ditemukan.");
			}
			if (
				selectedCompetitionId &&
				participant.competitionId !== selectedCompetitionId
			) {
				const selectedCompetition = competitions.find(
					(competition) => competition.id === selectedCompetitionId,
				);
				throw new Error(
					`Peserta ini terdaftar di lomba lain, bukan ${selectedCompetition?.name ?? "lomba yang dipilih"}.`,
				);
			}
			await stopCamera();
			foundId = id;
			error = "";
			scanState = "done";
		} catch (e) {
			await stopCamera();
			error = e instanceof Error ? e.message : "Gagal memuat peserta.";
			scanState = "error";
		}
	};

	const startCamera = async () => {
		const startToken = ++cameraStartToken;
		error = "";
		scanState = "scanning";
		try {
			await tick();
			if (startToken !== cameraStartToken || scanState !== "scanning") {
				return;
			}
			const Html5Qrcode = (await import("html5-qrcode")).Html5Qrcode;
			const instance = new Html5Qrcode("checkin-reader", false);
			scanner = instance;
			await instance.start(
				{ facingMode: "environment" },
				{ fps: 10, qrbox: { width: 220, height: 220 } },
				(text) => handleDecoded(text),
				() => {},
			);
			const cleanup = async () => {
				try {
					await instance.stop();
				} catch {
					// Kamera mungkin sudah dihentikan oleh browser atau lifecycle.
				}
				try {
					instance.clear();
				} catch {
					// Container dapat sudah dilepas saat halaman ditutup.
				}
			};
			if (startToken !== cameraStartToken || scanState !== "scanning") {
				await cleanup();
				return;
			}
			stopScanning = cleanup;
			cameraNote = "";
		} catch (e) {
			if (startToken !== cameraStartToken) {
				return;
			}
			cameraNote =
				e instanceof Error && e.name === "NotAllowedError"
					? "Izin kamera ditolak — gunakan entri manual nomor tiket."
					: "Kamera tidak tersedia — gunakan entri manual nomor tiket.";
			scanState = "idle";
		}
	};

	const stopCamera = async () => {
		cameraStartToken += 1;
		const stop = stopScanning;
		stopScanning = null;
		if (!stop) {
			scanner = null;
			scanState = "idle";
			return;
		}

		scanState = "stopping";
		let timeout: ReturnType<typeof setTimeout> | undefined;
		try {
			await Promise.race([
				stop(),
				new Promise<void>((resolve) => {
					timeout = setTimeout(resolve, 2000);
				}),
			]);
		} finally {
			if (timeout !== undefined) {
				clearTimeout(timeout);
			}
			scanner = null;
			scanState = "idle";
		}
	};

	const handleCompetitionChange = async (competitionId: string) => {
		selectedCompetitionId = competitionId;
		await stopCamera();
		foundId = null;
		manualTicket = "";
		error = "";
		scanState = "idle";
		await loadStats();
	};

	const submitManual = async () => {
		error = "";
		if (!manualTicket.trim()) {
			error = "Masukkan nomor tiket.";
			return;
		}
		try {
			const participant = await findParticipantByTicket(
				manualTicket,
				selectedCompetitionId || undefined,
			);
			if (!participant) {
				const selectedCompetition = competitions.find(
					(competition) => competition.id === selectedCompetitionId,
				);
				error = selectedCompetition
					? `Tiket "${manualTicket.trim()}" tidak ditemukan di lomba ${selectedCompetition.name}.`
					: `Tiket "${manualTicket.trim()}" tidak ditemukan.`;
				scanState = "error";
				return;
			}
			await openParticipant(participant.id);
		} catch (e) {
			error = e instanceof Error ? e.message : "Gagal mencari tiket.";
			scanState = "error";
		}
	};

	const openWalkin = () => {
		walkinCompetitionId = selectedCompetitionId || walkinCompetitionId;
		walkinName = "";
		walkinPhone = "";
		walkinError = "";
		walkinQuotaFull = false;
		showWalkin = true;
	};

	const cancelWalkin = () => {
		showWalkin = false;
		walkinError = "";
		walkinQuotaFull = false;
	};

	const submitWalkin = async () => {
		if (!walkinFormValid) {
			return;
		}
		walkinSubmitting = true;
		walkinError = "";
		walkinQuotaFull = false;
		try {
			const result = await registerWalkinCheckin({
				competitionId: walkinCompetitionId,
				name: walkinName.trim().toUpperCase(),
				phone: normalizePhone(walkinPhoneWithPrefix),
				staffId: panitiaStaff?.staffId,
				staffName: panitiaStaff?.name,
			});
			await stopCamera();
			showWalkin = false;
			foundId = result.participantId;
			error = "";
			scanState = "done";
			void loadStats();
		} catch (e) {
			// Peserta sudah tercatat (mungkin sudah kena kuota + bayar) tapi
			// bayar/check-in gagal di tengah jalan — buka kartu peserta supaya
			// panitia bisa lanjutkan manual, jangan biarkan jadi dead-end error.
			const partialId = (e as { participantId?: string }).participantId;
			if (partialId) {
				await stopCamera();
				showWalkin = false;
				foundId = partialId;
				error = "";
				scanState = "done";
				void loadStats();
			} else if (e instanceof QuotaFullError) {
				walkinQuotaFull = true;
			} else {
				walkinError =
					e instanceof Error ? e.message : "Gagal mendaftarkan peserta.";
			}
		} finally {
			walkinSubmitting = false;
		}
	};

	onMount(() => {
		videoEl = document.querySelector<HTMLVideoElement>("#checkin-reader");
		void videoEl;
		void loadCompetitions();
		void loadStats();
	});

	onDestroy(() => {
		void stopCamera();
	});
</script>

<div class="flex w-full flex-col gap-4">
	<div
		class="flex flex-col gap-3 rounded-xl border border-border bg-background/60 p-4"
	>
		<div class="flex items-center justify-between gap-3">
			<h1 class="text-lg font-bold">Check-in Peserta</h1>
			<div class="flex items-center gap-2">
				{#if scanState === "scanning"}
					<span
						class="flex items-center gap-1 rounded-full bg-sky-500/15 px-2.5 py-1 text-xs font-semibold text-sky-600"
					>
						<ScanLine
							class="h-3.5 w-3.5 animate-pulse"
							aria-hidden="true"
						/>
						Memindai…
					</span>
				{:else if scanState === "stopping"}
					<span class="text-xs font-semibold text-muted-foreground">
						Menghentikan kamera…
					</span>
				{/if}
			</div>
		</div>

		<div class="flex flex-col gap-1.5">
			<div class="flex items-center justify-between gap-2">
				<label for="checkin-competition" class="text-sm font-medium">
					Filter lomba
				</label>
				<button
					type="button"
					class="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
					onclick={() => (showTerms = true)}
				>
					<Info class="h-3.5 w-3.5" aria-hidden="true" />
					Syarat & Ketentuan
				</button>
			</div>
			<select
				id="checkin-competition"
				class="input h-11"
				disabled={scanState === "stopping"}
				value={selectedCompetitionId}
				onchange={(event) =>
					void handleCompetitionChange(
						(event.currentTarget as HTMLSelectElement).value,
					)}
			>
				<option value="">Semua lomba</option>
				{#each competitions as competition (competition.id)}
					<option value={competition.id}>{competition.name}</option>
				{/each}
			</select>
			{#if competitionError}
				<p class="text-xs text-destructive" role="alert">
					{competitionError}
				</p>
			{/if}
		</div>

	{#if statsLoading}
		<p class="text-sm text-muted-foreground" role="status">
			Memuat statistik check-in…
		</p>
	{:else if statsError}
		<p class="text-sm text-destructive" role="alert">{statsError}</p>
	{:else if stats}
		<div class="grid grid-cols-2 gap-3" aria-label="Statistik check-in">
			<div class="rounded-lg border border-border/60 px-2 py-2.5">
				<div class="flex items-center gap-2 text-xs text-muted-foreground">
					<Users class="h-4 w-4" aria-hidden="true" />
					<span>Jumlah terdaftar</span>
				</div>
				<p class="mt-1 text-2xl font-bold tabular-nums">
					{stats.registered}
				</p>
			</div>
			<div class="rounded-lg border border-border/60 px-2 py-2.5">
				<div class="flex items-center gap-2 text-xs text-muted-foreground">
					<UserCheck class="h-4 w-4" aria-hidden="true" />
					<span>Sisa belum check-in</span>
				</div>
				<p class="mt-1 text-2xl font-bold tabular-nums">
					{stats.remaining}
				</p>
			</div>
		</div>
	{/if}

		{#if scanState !== "done"}
			<div class="flex flex-col gap-2">
				<button
					type="button"
					disabled={scanState === "stopping"}
					class="btn h-12 text-base {scanState === 'scanning'
						? 'btn-ghost'
						: 'btn-gold'}"
					onclick={() =>
						scanState === "scanning"
							? void stopCamera()
							: void startCamera()}
				>
						{#if scanState === "scanning" || scanState === "stopping"}
						<CameraOff class="h-5 w-5" aria-hidden="true" />
						Hentikan Pemindaian
					{:else}
						<Camera class="h-5 w-5" aria-hidden="true" />
						Pindai QR Tiket
					{/if}
				</button>
				{#if scanState === "scanning"}
					<div
						id="checkin-reader"
						class="overflow-hidden rounded-lg border border-border"
						aria-label="Area kamera QR"
					></div>
				{/if}
				{#if cameraNote}
					<p class="text-xs text-muted-foreground" role="status">
						{cameraNote}
					</p>
				{/if}
				<div
					class="my-1 flex items-center gap-2 text-xs text-muted-foreground"
				>
					<span class="h-px flex-1 bg-border"></span>
					atau masukkan nomor tiket
					<span class="h-px flex-1 bg-border"></span>
				</div>
				<div class="flex gap-2">
					<input
						type="text"
						class="input flex-1"
						placeholder="T-000001"
						bind:value={manualTicket}
						onkeydown={(e) => {
							if (e.key === "Enter") {
								void submitManual();
							}
						}}
					/>
					<button
						type="button"
						class="btn"
						onclick={() => void submitManual()}
					>
						<Ticket class="h-4 w-4" aria-hidden="true" />
						Cari
					</button>
				</div>
				{#if error}
					<p class="text-sm text-destructive" role="alert">{error}</p>
				{/if}

				<div
					class="my-1 flex items-center gap-2 text-xs text-muted-foreground"
				>
					<span class="h-px flex-1 bg-border"></span>
					atau daftar di tempat
					<span class="h-px flex-1 bg-border"></span>
				</div>

				{#if !showWalkin}
					<button
						type="button"
						class="btn btn-ghost h-11 text-sm"
						onclick={openWalkin}
					>
						<UserPlus class="h-4 w-4" aria-hidden="true" />
						Daftar Peserta Baru (Tunai)
					</button>
				{:else}
					<div
						class="flex flex-col gap-2 rounded-lg border border-border/60 p-3"
					>
						<p class="text-sm font-semibold">
							Daftar on-site — bayar tunai + check-in langsung
						</p>
						<select
							class="input h-11"
							bind:value={walkinCompetitionId}
							disabled={walkinSubmitting}
						>
							<option value="">Pilih lomba</option>
							{#each competitions as competition (competition.id)}
								<option value={competition.id}>{competition.name}</option>
							{/each}
						</select>
						{#if walkinFee !== null}
							<p class="text-xs text-muted-foreground">
								Biaya: Rp {walkinFee.toLocaleString("id-ID")}
							</p>
						{/if}
						<input
							type="text"
							class="input"
							placeholder="Nama peserta"
							value={walkinName}
							oninput={(event) => {
								walkinName = (
									event.currentTarget as HTMLInputElement
								).value.toUpperCase();
							}}
							disabled={walkinSubmitting}
							autocomplete="name"
						/>
						<div
							class="flex min-w-0 items-center rounded-lg border border-border bg-background focus-within:ring-2 focus-within:ring-gold/60"
						>
							<span
								class="shrink-0 border-r border-border px-2 py-2.5 text-sm font-semibold text-muted-foreground"
								aria-hidden="true">+62</span
							>
							<input
								type="tel"
								class="min-w-0 flex-1 border-0 bg-transparent px-2 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground"
								placeholder="81234567890"
								aria-label="Nomor WA setelah +62"
								value={walkinPhone}
								oninput={(event) => {
									walkinPhone = (
										event.currentTarget as HTMLInputElement
									).value.replace(/\D/g, "");
								}}
								disabled={walkinSubmitting}
								inputmode="numeric"
								maxlength="13"
								autocomplete="tel-national"
							/>
						</div>
						{#if walkinPhoneError}
							<p class="text-xs text-destructive">
								Nomor WA harus diawali angka 8 setelah prefix +62.
							</p>
						{/if}
						{#if walkinQuotaFull}
							<p class="text-sm text-destructive" role="alert">
								Kuota lomba ini sudah habis.
							</p>
						{:else if walkinError}
							<p class="text-sm text-destructive" role="alert">
								{walkinError}
							</p>
						{/if}
						<div class="flex gap-2">
							<button
								type="button"
								class="btn btn-ghost flex-1"
								onclick={cancelWalkin}
								disabled={walkinSubmitting}
							>
								Batal
							</button>
							<button
								type="button"
								class="btn btn-gold flex-1"
								onclick={() => void submitWalkin()}
								disabled={!walkinFormValid}
							>
								{#if walkinSubmitting}
									<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
									Memproses…
								{:else}
									<UserPlus class="h-4 w-4" aria-hidden="true" />
									Daftar & Check-in
								{/if}
							</button>
						</div>
					</div>
				{/if}
			</div>
		{/if}
	</div>

	{#if foundId}
		<ParticipantDetailCard
			participantId={foundId}
			recordedBy={panitiaStaff
				? formatStaffActor({ id: panitiaStaff.staffId, name: panitiaStaff.name })
				: null}
			onDone={() => {
				foundId = null;
				manualTicket = "";
				scanState = "idle";
				void loadStats();
			}}
		/>
	{:else if scanState === "done" && !foundId}
		<p class="text-sm text-muted-foreground">Memuat peserta…</p>
	{/if}
</div>

<TermsDialog
	open={showTerms}
	title="Syarat & Ketentuan"
	competition={termsCompetition}
	onclose={() => (showTerms = false)}
/>
