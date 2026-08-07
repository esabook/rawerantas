<script lang="ts">
	import { env } from "$lib/env";

	let { eventDate, endDate }: { eventDate?: string; endDate?: string } = $props();

	const DEFAULT_EVENT_HOURS = 12;

	const parse = (raw: string | undefined): Date | null => {
		if (!raw || raw.length === 0) {
			return null;
		}
		const date = new Date(raw);
		return Number.isNaN(date.getTime()) ? null : date;
	};

	const start = $derived(parse(eventDate ?? env.eventDate));
	const end = $derived(
		endDate !== undefined
			? parse(endDate)
			: start
				? new Date(start.getTime() + DEFAULT_EVENT_HOURS * 60 * 60 * 1000)
				: null,
	);

	let now = $state(Date.now());

	$effect(() => {
		const id = setInterval(() => {
			now = Date.now();
		}, 1000);
		return () => clearInterval(id);
	});

	const parts = $derived.by(() => {
		if (!start || !end) {
			return null;
		}
		const diff = Math.max(0, start.getTime() - now);
		const totalSeconds = Math.floor(diff / 1000);
		return {
			days: Math.floor(totalSeconds / 86_400),
			hours: Math.floor((totalSeconds % 86_400) / 3_600),
			minutes: Math.floor((totalSeconds % 3_600) / 60),
			seconds: totalSeconds % 60,
		};
	});

	const status = $derived.by(() => {
		if (!start || !end) {
			return "error";
		}
		if (now < start.getTime()) {
			return "segera";
		}
		if (now <= end.getTime()) {
			return "live";
		}
		return "habis";
	});

	const pad = (n: number) => String(n).padStart(2, "0");
	const statusLabel = {
		segera: "Segera dimulai",
		live: "Sedang berlangsung",
		habis: "Telah berakhir",
		error: "Tanggal event belum diatur",
	} as const;
</script>

<div
	class="mx-auto flex w-full max-w-md flex-col items-center gap-3 rounded-xl border border-border/60 bg-background/60 px-6 py-6 text-center {status === 'live' ? 'border-gold bg-gold/10' : ''}"
	role="status"
	aria-live="polite"
>
	{#if status === "error"}
		<p class="text-sm font-medium text-destructive">{statusLabel.error}</p>
		<p class="text-xs text-muted-foreground">
			Isi <code>PUBLIC_EVENT_DATE</code> di <code>.env</code> (ISO-8601 + offset).
		</p>
	{:else}
		<p
			class="text-xs font-semibold uppercase tracking-widest {status === 'live' ? 'text-gold' : 'text-secondary'}"
		>
			{statusLabel[status]}
		</p>
		{#if parts && status === "segera"}
			<div class="grid w-full grid-cols-4 gap-2" aria-label="countdown">
				<div class="flex flex-col items-center gap-1 rounded-xl border border-border/60 bg-background/80 px-1 py-2.5">
					<span class="text-2xl font-bold tabular-nums">{parts.days}</span>
					<span class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">hari</span>
				</div>
				<div class="flex flex-col items-center gap-1 rounded-xl border border-border/60 bg-background/80 px-1 py-2.5">
					<span class="text-2xl font-bold tabular-nums">{pad(parts.hours)}</span>
					<span class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">jam</span>
				</div>
				<div class="flex flex-col items-center gap-1 rounded-xl border border-border/60 bg-background/80 px-1 py-2.5">
					<span class="text-2xl font-bold tabular-nums">{pad(parts.minutes)}</span>
					<span class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">menit</span>
				</div>
				<div class="flex flex-col items-center gap-1 rounded-xl border border-gold/40 bg-gold/10 px-1 py-2.5">
					<span class="text-2xl font-bold tabular-nums text-gold">{pad(parts.seconds)}</span>
					<span class="text-[10px] font-medium uppercase tracking-wide text-gold">detik</span>
				</div>
			</div>
		{:else if status === "live"}
			<p class="text-2xl font-bold text-gold">Live!</p>
			<p class="text-sm text-muted-foreground">
				Event berlangsung hingga {end?.toLocaleString("id-ID")}
			</p>
		{:else if status === "habis"}
			<p class="text-2xl font-bold">Sampai jumpa tahun depan!</p>
		{/if}
	{/if}
</div>
