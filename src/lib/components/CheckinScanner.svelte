<script lang="ts">
	import { Camera, CameraOff, ScanLine, Ticket, UserCheck } from "@lucide/svelte";
	import { onDestroy, onMount } from "svelte";
	import ParticipantDetailCard from "$lib/components/ParticipantDetailCard.svelte";
	import { findParticipantByTicket } from "$lib/db/checkin";

	type ScanState = "idle" | "scanning" | "error" | "done";
	let scanState = $state<ScanState>("idle");
	let error = $state("");
	let foundId = $state<string | null>(null);
	let manualTicket = $state("");
	let cameraNote = $state("");

	let scanner: unknown = null;
	let stopScanning: (() => void) | null = null;
	let videoEl: HTMLVideoElement | null = null;

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
			scanState = "error";
			return;
		}
		void openParticipant(id);
	};

	const openParticipant = async (id: string) => {
		foundId = id;
		error = "";
		scanState = "done";
		void stopCamera();
	};

	const startCamera = async () => {
		error = "";
		scanState = "scanning";
		try {
			const Html5Qrcode = (
				await import("html5-qrcode")
			).Html5Qrcode;
			const instance = new Html5Qrcode("checkin-reader", false);
			scanner = instance;
			await instance.start(
				{ facingMode: "environment" },
				{ fps: 10, qrbox: { width: 220, height: 220 } },
				(text) => handleDecoded(text),
				() => {},
			);
			stopScanning = () => {
				void instance.stop().catch(() => {});
				void instance.clear();
			};
			cameraNote = "";
		} catch (e) {
			cameraNote =
				e instanceof Error && e.name === "NotAllowedError"
					? "Izin kamera ditolak — gunakan entri manual nomor tiket."
					: "Kamera tidak tersedia — gunakan entri manual nomor tiket.";
			scanState = "idle";
		}
	};

	const stopCamera = async () => {
		stopScanning?.();
		stopScanning = null;
		scanState = "idle";
	};

	const submitManual = async () => {
		error = "";
		if (!manualTicket.trim()) {
			error = "Masukkan nomor tiket.";
			return;
		}
		try {
			const participant = await findParticipantByTicket(manualTicket);
			if (!participant) {
				error = `Tiket "${manualTicket.trim()}" tidak ditemukan.`;
				scanState = "error";
				return;
			}
			await openParticipant(participant.id);
		} catch (e) {
			error = e instanceof Error ? e.message : "Gagal mencari tiket.";
			scanState = "error";
		}
	};

	onMount(() => {
		videoEl = document.querySelector<HTMLVideoElement>("#checkin-reader");
		void videoEl;
	});

	onDestroy(() => {
		void stopCamera();
	});
</script>

<div class="mx-auto flex w-full max-w-md flex-col gap-4">
	<div class="flex flex-col gap-3 rounded-xl border border-border bg-background/60 p-6">
		<div class="flex items-center justify-between">
			<h1 class="text-lg font-bold">Check-in Peserta</h1>
			{#if scanState === "scanning"}
				<span class="flex items-center gap-1 rounded-full bg-sky-500/15 px-2.5 py-1 text-xs font-semibold text-sky-600">
					<ScanLine class="h-3.5 w-3.5 animate-pulse" aria-hidden="true" />
					Memindai…
				</span>
			{/if}
		</div>

		{#if scanState !== "done"}
			<div class="flex flex-col gap-2">
				<button
					type="button"
					class="btn h-12 text-base {scanState === 'scanning' ? 'btn-ghost' : 'btn-gold'}"
					onclick={() =>
						scanState === "scanning" ? void stopCamera() : void startCamera()}
				>
					{#if scanState === "scanning"}
						<CameraOff class="h-5 w-5" aria-hidden="true" />
						Hentikan Pemindaian
					{:else}
						<Camera class="h-5 w-5" aria-hidden="true" />
						Pindai QR Tiket
					{/if}
				</button>
				{#if scanState === "scanning"}
					<div id="checkin-reader" class="overflow-hidden rounded-lg border border-border" aria-label="Area kamera QR"></div>
				{/if}
				{#if cameraNote}
					<p class="text-xs text-muted-foreground" role="status">{cameraNote}</p>
				{/if}
				<div class="my-1 flex items-center gap-2 text-xs text-muted-foreground">
					<span class="h-px flex-1 bg-border"></span>
					atau masukkan nomor tiket
					<span class="h-px flex-1 bg-border"></span>
				</div>
				<div class="flex gap-2">
					<input
						type="text"
						class="input flex-1"
						placeholder="RA-2026-001"
						bind:value={manualTicket}
						onkeydown={(e) => {
							if (e.key === "Enter") {
								void submitManual();
							}
						}}
					/>
					<button type="button" class="btn" onclick={() => void submitManual()}>
						<Ticket class="h-4 w-4" aria-hidden="true" />
						Cari
					</button>
				</div>
				{#if error}
					<p class="text-sm text-destructive" role="alert">{error}</p>
				{/if}
			</div>
		{/if}
	</div>

	{#if foundId}
		<ParticipantDetailCard
			participantId={foundId}
			onDone={() => {
				foundId = null;
				manualTicket = "";
			}}
		/>
	{:else if scanState === "done" && !foundId}
		<p class="text-sm text-muted-foreground">Memuat peserta…</p>
	{/if}
</div>
