<script lang="ts">
	import { env } from "$lib/env";

	let { eventDate, endDate }: { eventDate?: string; endDate?: string } =
		$props();

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
				? new Date(
						start.getTime() + DEFAULT_EVENT_HOURS * 60 * 60 * 1000,
					)
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
	class="flex w-full flex-col items-center gap-3 rounded-xl border px-4 py-5 text-center {status ===
	'segera'
		? 'border-rose-200/45 bg-[linear-gradient(135deg,rgba(127,29,29,0.72),rgba(10,15,28,0.96)_54%,rgba(248,250,252,0.12))] shadow-[0_0_34px_rgba(220,38,38,0.18)]'
		: status === 'live'
			? 'border-gold bg-gold/10'
			: 'border-slate-800 bg-background/60'} sm:px-4 sm:py-6"
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
			class="font-display text-xs font-semibold uppercase tracking-widest {status ===
			'segera'
				? 'text-rose-100'
				: status === 'live'
					? 'text-gold'
					: 'text-secondary'}"
		>
			{statusLabel[status]}
		</p>
		{#if parts && status === "segera"}
			<div class="grid w-full grid-cols-4 gap-2" aria-label="countdown">
				<div
					class="flex min-w-0 flex-col items-center gap-1 rounded-xl border border-white/20 bg-slate-950/70 px-1 py-2.5"
				>
					<span
						class="font-display text-2xl font-bold tabular-nums text-white"
						>{parts.days}</span
					>
					<span
						class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
						>hari</span
					>
				</div>
				<div
					class="flex min-w-0 flex-col items-center gap-1 rounded-xl border border-white/20 bg-slate-950/70 px-1 py-2.5"
				>
					<span
						class="font-display text-2xl font-bold tabular-nums text-white"
						>{pad(parts.hours)}</span
					>
					<span
						class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
						>jam</span
					>
				</div>
				<div
					class="flex min-w-0 flex-col items-center gap-1 rounded-xl border border-white/20 bg-slate-950/70 px-1 py-2.5"
				>
					<span
						class="font-display text-2xl font-bold tabular-nums text-white"
						>{pad(parts.minutes)}</span
					>
					<span
						class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
						>menit</span
					>
				</div>
				<div
					class="flex min-w-0 flex-col items-center gap-1 rounded-xl border border-white/75 bg-white/10 px-1 py-2.5 shadow-[0_0_16px_rgba(248,250,252,0.15)]"
				>
					<span
						class="font-display text-2xl font-bold tabular-nums text-white"
						>{pad(parts.seconds)}</span
					>
					<span
						class="text-[10px] font-medium uppercase tracking-wide text-white"
						>detik</span
					>
				</div>
			</div>
		{:else if status === "live"}
			<p class="font-display text-2xl font-bold text-cyan-200">Live!</p>
			<p class="text-sm text-muted-foreground">
				Event berlangsung hingga {end?.toLocaleString("id-ID")}
			</p>
		{:else if status === "habis"}
			<p class="font-display text-2xl font-bold">
				Sampai jumpa tahun depan!
			</p>
		{/if}
	{/if}
</div>
