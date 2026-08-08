<script lang="ts">
	import {
		ArrowUpRight,
		ExternalLink,
		Fish,
		Gift,
		Palette,
		Trophy,
		Wind,
		X,
	} from "@lucide/svelte";
	import type { Component } from "svelte";
	import type { Competition } from "$lib/db/queries";
	import type { ScoringMode } from "$lib/db/schema";

	let {
		competitions,
		loading = false,
	}: {
		competitions: Competition[];
		loading?: boolean;
	} = $props();

	const isLive = (competition: Competition) => competition.isActive;
	const liveCompetitions = $derived(competitions.filter(isLive));

	interface CompetitionMeta {
		eyebrow: string;
		copy: string;
		accent: string;
		panel: string;
		icon: Component;
	}

	const metaByMode: Record<ScoringMode, CompetitionMeta> = {
		terberat: {
			eyebrow: "Liga Mancing",
			copy: "Tarik ikan terberat, kuasai kolam, bawa pulang gelar juara.",
			accent: "text-cyan-300",
			panel: "from-cyan-500/30 via-sky-500/10 to-transparent",
			icon: Fish,
		},
		kumulatif: {
			eyebrow: "Liga Mancing",
			copy: "Kumpulkan berat terbaik dari setiap strike di lapangan.",
			accent: "text-cyan-300",
			panel: "from-cyan-500/30 via-sky-500/10 to-transparent",
			icon: Fish,
		},
		jackpot_pita: {
			eyebrow: "Liga Mancing",
			copy: "Satu strike jackpot bisa mengubah papan peringkat.",
			accent: "text-cyan-300",
			panel: "from-cyan-500/30 via-sky-500/10 to-transparent",
			icon: Fish,
		},
		layangan_aduan: {
			eyebrow: "Aduan Layangan",
			copy: "Naikkan layangan, baca angin, putuskan lawan di arena.",
			accent: "text-blue-300",
			panel: "from-blue-500/30 via-indigo-500/10 to-transparent",
			icon: Wind,
		},
		layangan_hias: {
			eyebrow: "Pameran Layangan",
			copy: "Gaya, warna, dan stabilitas terbaik jadi sorotan tribun.",
			accent: "text-violet-300",
			panel: "from-violet-500/30 via-indigo-500/10 to-transparent",
			icon: Palette,
		},
	};

	const metaFor = (competition: Competition): CompetitionMeta =>
		metaByMode[competition.scoringMode] ?? metaByMode.terberat;

	let termsCompetition = $state<Competition | null>(null);

	const scoringLabel = (competition: Competition): string => {
		switch (competition.scoringMode) {
			case "terberat":
				return "ikan terberat";
			case "kumulatif":
				return "berat kumulatif";
			case "jackpot_pita":
				return "jackpot pita";
			case "layangan_aduan":
				return "aduan layangan";
			case "layangan_hias":
				return "penilaian layangan hias";
		}
	};

	const prizesFor = (competition: Competition): string[] => {
		const prizes = [
			"Juara 1 — piala dan hadiah utama",
			"Juara 2 — hadiah runner-up",
			"Juara 3 — hadiah podium",
		];
		return competition.scoringMode === "jackpot_pita"
			? [...prizes, "Bonus — hadiah jackpot pita"]
			: prizes;
	};

	const termsFor = (competition: Competition): string[] => [
		`Peserta wajib mengikuti arahan panitia dan membawa nomor tiket ${competition.name}.`,
		`Penilaian menggunakan kategori ${scoringLabel(competition)} dan keputusan juri bersifat final.`,
		`Kuota tersedia maksimal ${competition.totalQuota} peserta; pendaftaran ditutup saat kuota penuh.`,
		`Tiket pendaftaran Rp ${competition.fee.toLocaleString("id-ID")} dan minimal DP Rp ${competition.minDp.toLocaleString("id-ID")}.`,
		"Biaya pendaftaran yang sudah dibayar tidak dapat dikembalikan (no-refund).",
	];

	$effect(() => {
		if (!termsCompetition) return;
		const previousBodyOverflow = document.body.style.overflow;
		const previousDocumentOverflow =
			document.documentElement.style.overflow;
		document.body.style.overflow = "hidden";
		document.documentElement.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = previousBodyOverflow;
			document.documentElement.style.overflow = previousDocumentOverflow;
		};
	});
</script>

<section class="w-full bg-[#05070d] py-10 sm:py-12" aria-label="Arena lomba">
	<div class="flex w-full flex-col gap-5 px-2 sm:px-4 lg:px-8">
		<div
			class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
		>
			<div>
				<p
					class="text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-300"
				>
					Event Lomba
				</p>
				<h2
					class="font-display mt-2 text-[clamp(1rem,8vw,3rem)] font-extrabold uppercase tracking-tight sm:text-4xl"
				>
					Arena <span class="text-cyan-300">Live</span>
				</h2>
			</div>
			<a
				href="/leaderboard"
				class="rainbow-edge-button inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-lg font-bold uppercase tracking-widest text-white"
			>
				<Trophy class="h-3.5 w-3.5" aria-hidden="true" />
				Leaderboard
				<ArrowUpRight class="h-3.5 w-3.5" aria-hidden="true" />
			</a>
		</div>

		{#if loading}
			<div class="no-scrollbar flex gap-4 overflow-x-auto pb-2">
				{#each [1, 2, 3] as i}
					<div
						class="h-[22rem] w-[19rem] shrink-0 animate-pulse rounded-2xl border border-slate-800 bg-[#0a0f1c] sm:w-[21rem]"
						aria-label="loading card"
					></div>
				{/each}
			</div>
		{:else if liveCompetitions.length === 0}
			<p
				class="rounded-xl border border-slate-800 bg-[#0a0f1c] p-5 text-sm text-slate-400"
			>
				Belum ada arena yang live. Cek lagi sebentar.
			</p>
		{:else}
			<div
				class="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2"
			>
				{#each liveCompetitions as c, i (c.id)}
					{@const meta = metaFor(c)}
					<article
						class="group flex min-h-[22rem] w-[19rem] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-slate-800 bg-[#0a0f1c] shadow-xl shadow-black/25 transition-[border-color,box-shadow] duration-200 hover:border-cyan-300/45 hover:shadow-[0_0_28px_rgba(34,211,238,0.12)] sm:w-[21rem]"
						data-testid="competition-card"
					>
						<div
							class="relative overflow-hidden border-b border-slate-800 bg-gradient-to-br {meta.panel} p-5"
						>
							<div
								class="absolute -right-6 -top-8 text-white/5"
								aria-hidden="true"
							>
								<meta.icon class="h-36 w-36" strokeWidth={1} />
							</div>
							<div
								class="relative flex items-start justify-between gap-3"
							>
								<div
									class="rounded-xl border border-white/15 bg-slate-950/30 p-3 {meta.accent}"
								>
									<meta.icon
										class="h-7 w-7"
										aria-hidden="true"
									/>
								</div>
								<span
									class="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-cyan-200"
								>
									<span
										class="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-300"
										aria-hidden="true"
									></span>
									Live
								</span>
							</div>
							<div
								class="relative mt-6 flex items-end justify-between gap-3"
							>
								<div class="min-w-0">
									<p
										class="text-[10px] font-bold uppercase tracking-[0.2em] {meta.accent}"
									>
										{meta.eyebrow}
									</p>
									<h3
										class="font-display mt-2 break-words text-2xl font-extrabold uppercase leading-none text-slate-100"
									>
										{c.name}
									</h3>
								</div>
								<span
									class="font-display shrink-0 text-4xl font-extrabold text-white/15"
									>{String(i + 1).padStart(2, "0")}</span
								>
							</div>
						</div>

						<div class="flex flex-1 flex-col gap-4 p-5">
							<p class="text-sm leading-relaxed text-slate-400">
								{meta.copy}
							</p>
							<div
								class="grid grid-cols-2 gap-2 rounded-xl border border-slate-800 bg-slate-950/20 p-3 text-xs"
							>
								<div class="min-w-0">
									<p
										class="font-bold uppercase tracking-wider text-slate-500"
									>
										Tiket
									</p>
									<p
										class="mt-1 break-words font-semibold text-slate-100"
									>
										Rp {c.fee.toLocaleString("id-ID")}
									</p>
								</div>
								<div
									class="min-w-0 border-l border-slate-800 pl-3"
								>
									<p
										class="font-bold uppercase tracking-wider text-slate-500"
									>
										Slot
									</p>
									<p
										class="mt-1 break-words font-semibold text-slate-100"
									>
										{c.totalQuota} peserta
									</p>
								</div>
							</div>
							<div class="mt-auto flex flex-col gap-2">
								<button
									type="button"
									class="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-300/25 bg-cyan-300/5 px-2 py-2.5 text-[10px] font-bold uppercase tracking-widest text-cyan-200 transition-colors hover:border-cyan-200/60 hover:bg-cyan-300/10"
									onclick={() => (termsCompetition = c)}
								>
									Lihat ketentuan dan syarat
									<ExternalLink
										class="h-3.5 w-3.5"
										aria-hidden="true"
									/>
								</button>
								<a
									href="/daftar"
									class="btn btn-sm btn-gold w-full"
								>
									Daftar Sekarang
									<ArrowUpRight
										class="h-3.5 w-3.5"
										aria-hidden="true"
									/>
								</a>
							</div>
						</div>
					</article>
				{/each}
			</div>
		{/if}
	</div>
</section>

{#if termsCompetition}
	<div
		class="fixed inset-0 z-50 flex overscroll-none items-center justify-center overflow-hidden bg-slate-950/80 px-2 py-4 backdrop-blur-sm"
	>
		<div
			class="flex max-h-[88dvh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-cyan-300/30 bg-[#0a0f1c] shadow-[0_0_40px_rgba(34,211,238,0.16)]"
			role="dialog"
			aria-modal="true"
			aria-labelledby="landing-competition-terms-title"
		>
			<div
				class="flex items-start justify-between gap-3 border-b border-slate-800 p-4"
			>
				<div>
					<p
						class="text-[10px] font-bold uppercase tracking-widest text-cyan-300"
					>
						Ketentuan lomba
					</p>
					<h2
						id="landing-competition-terms-title"
						class="font-display mt-1 break-words text-xl font-extrabold uppercase text-slate-100"
					>
						{termsCompetition.name}
					</h2>
				</div>
				<button
					type="button"
					class="btn btn-ghost btn-sm shrink-0"
					aria-label="Tutup ketentuan"
					onclick={() => (termsCompetition = null)}
					><X class="h-4 w-4" aria-hidden="true" /></button
				>
			</div>
			<div
				class="min-h-0 overflow-y-auto overscroll-contain p-4 [touch-action:pan-y]"
			>
				<div
					class="rounded-xl border border-indigo-300/15 bg-indigo-300/5 p-3"
				>
					<p
						class="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-indigo-200"
					>
						<Gift class="h-3.5 w-3.5" aria-hidden="true" />Hadiah
					</p>
					<ul
						class="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-200"
					>
						{#each prizesFor(termsCompetition) as prize}<li
								class="pl-1"
							>
								{prize}
							</li>{/each}
					</ul>
				</div>
				<h3
					class="font-display mt-5 text-sm font-bold uppercase tracking-wider text-cyan-200"
				>
					Ketentuan dan persyaratan
				</h3>
				<ol
					class="mt-2 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-slate-300"
				>
					{#each termsFor(termsCompetition) as term}<li class="pl-1">
							{term}
						</li>{/each}
				</ol>
			</div>
		</div>
	</div>
{/if}
