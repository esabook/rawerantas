<script lang="ts">
	import { BadgeCheck, Printer, Ticket, UserRound } from "@lucide/svelte";
	import { onMount } from "svelte";
	import type { Competition, Participant } from "$lib/db/queries";
	import { waShare } from "$lib/utils/whatsapp";
	import QRCode from "./QRCode.svelte";

	let {
		participant,
		competition,
		printWidth = 80,
	}: {
		participant: Participant;
		competition: Competition | undefined;
		printWidth?: number;
	} = $props();

	let qrSize = $state(256);

	onMount(() => {
		const updateQrSize = () => {
			qrSize = Math.min(480, Math.max(220, window.innerWidth - 72));
		};
		updateQrSize();
		window.addEventListener("resize", updateQrSize);
		return () => window.removeEventListener("resize", updateQrSize);
	});

	$effect(() => {
		const style = document.createElement("style");
		style.dataset.ticketPrint = "true";
		style.textContent = `@media print { @page { size: ${printWidth}mm auto; margin: 0; } body { margin: 0; } .no-print { display: none !important; } .ticket-card { box-shadow: none; border: none; } }`;
		document.head.appendChild(style);
		return () => style.remove();
	});

	const statusLabels: Record<string, string> = {
		registered: "Terdaftar",
		dp_paid: "DP dibayar",
		fully_paid: "Lunas",
		checked_in: "Sudah check-in",
	};

	const statusClass = $derived(
		participant.status === "fully_paid" ||
			participant.status === "checked_in"
			? "bg-gold/15 text-gold"
			: participant.status === "dp_paid"
				? "bg-primary/15 text-primary"
				: "bg-muted text-muted-foreground",
	);

	const waLink = $derived(
		waShare(
			`Halo panitia Rawera, saya ${participant.name} pemegang tiket ${participant.ticketNumber ?? ""} (${competition?.name ?? "lomba"}).`,
		),
	);
</script>

<div
	class="ticket-card w-full rounded-xl border border-border bg-background/60 p4"
>
	<div class="flex items-center gap-3">
		<div
			class="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/15"
		>
			<Ticket class="h-5 w-5 text-gold" aria-hidden="true" />
		</div>
		<div class="min-w-0 flex-1">
			<p class="truncate font-bold">{competition?.name ?? "Lomba"}</p>
			<p class="text-xs text-muted-foreground">E-Tiket Peserta</p>
		</div>
		<span
			class={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass}`}
		>
			{statusLabels[participant.status] ?? participant.status}
		</span>
	</div>

	<div class="mt-5 flex flex-col items-center gap-3">
		<div
			class="w-full max-w-[30rem] rounded-xl border border-border bg-background p-2"
		>
			<QRCode id={participant.id} size={qrSize} />
		</div>
		<p class="font-mono text-xl font-bold tabular-nums text-gold">
			{participant.ticketNumber ?? "—"}
		</p>
	</div>

	<div class="mt-5 grid gap-3 text-sm sm:grid-cols-2">
		<div class="rounded-lg border border-border/60 bg-background/50 p-3">
			<p
				class="text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
			>
				Nama peserta
			</p>
			<p
				class="mt-1 flex items-center gap-2 break-words font-medium text-foreground"
			>
				<UserRound
					class="h-4 w-4 shrink-0"
					aria-hidden="true"
				/>{participant.name}
			</p>
		</div>
		<div class="rounded-lg border border-border/60 bg-background/50 p-3">
			<p
				class="text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
			>
				Nomor WA
			</p>
			<p
				class="mt-1 break-words font-mono font-medium tabular-nums text-foreground"
			>
				{participant.phone}
			</p>
		</div>
		{#if participant.lapakNumber}
			<p class="text-xs text-muted-foreground sm:col-span-2">
				BIB #{participant.lapakNumber}
			</p>
		{/if}
	</div>

	<div class="no-print mt-6 flex gap-2">
		<a
			class="btn btn-gold flex-1"
			href={waLink}
			target="_blank"
			rel="noopener noreferrer"
		>
			Hubungi Panitia via WA
		</a>
		<button
			type="button"
			class="btn flex items-center gap-1.5"
			onclick={() => window.print()}
		>
			<Printer class="h-4 w-4" aria-hidden="true" />
			Print
		</button>
	</div>

	{#if participant.status === "fully_paid" || participant.status === "checked_in"}
		<p class="no-print mt-3 flex items-center gap-1 text-xs text-gold">
			<BadgeCheck class="h-3.5 w-3.5" aria-hidden="true" />
			Pembayaran lunas terverifikasi.
		</p>
	{/if}
</div>
