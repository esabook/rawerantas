<script lang="ts">
	import { env } from "$lib/env";
	import {
		ArrowLeft,
		CalendarDays,
		LogIn,
		Radio,
		Sparkles,
		X,
	} from "@lucide/svelte";
	import CountdownTimer from "./CountdownTimer.svelte";

	const eventDate =
		env.eventDate.length > 0
			? new Date(env.eventDate).toLocaleDateString("id-ID", {
					day: "numeric",
					month: "long",
				})
			: "17 AGU";

	const parts = (env.appName || "Lomba Agustusan").trim().split(/\s+/);
	const nameHead =
		parts.length > 1
			? parts.slice(0, -1).join(" ")
			: env.appName || "Lomba";
	const nameTail = parts.length > 1 ? parts[parts.length - 1] : env.appYear;
	let loginOpen = $state(false);
	let staffOpen = $state(false);

	const closeLogin = () => {
		loginOpen = false;
		staffOpen = false;
	};

	$effect(() => {
		if (!loginOpen) return;
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

<section
	class="relative isolate overflow-hidden border-b border-slate-800/80 bg-[#05070d]"
>
	<div
		class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(34,211,238,0.12),transparent_30%),radial-gradient(circle_at_85%_80%,rgba(99,102,241,0.14),transparent_32%)]"
		aria-hidden="true"
	></div>

	<div
		class="relative flex w-full min-w-0 flex-col gap-8 px-2 pb-9 pt-8 sm:px-4 lg:px-8 lg:pb-12 lg:pt-10"
	>
		<div class="min-w-0">
			<div
				class="flex flex-wrap items-center justify-between gap-3 text-[10px] font-bold uppercase tracking-[0.2em]"
			>
				<div class="flex flex-wrap items-center gap-2">
					<span
						class="inline-flex items-center gap-1.5 rounded-full border border-red-300/25 bg-red-300/10 px-2 py-1.5 text-red-200"
					>
						<Radio
							class="h-3.5 w-3.5 animate-pulse"
							aria-hidden="true"
						/>
						Tahun {env.appYear}
					</span>
					<!-- <span class="text-slate-500">Hari Pertandingan 02</span> -->
				</div>
				<button
					type="button"
					class="inline-flex items-center gap-1.5 rounded-full border border-cyan-300/60 bg-cyan-300/10 px-4 py-2.5 font-display text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-100 shadow-[0_0_20px_rgba(251,191,36,0.16)] transition-colors hover:border-cyan-200 hover:bg-cyan-300/20"
					onclick={() => (loginOpen = true)}
				>
					<LogIn class="h-3.5 w-3.5" aria-hidden="true" />
					Login
				</button>
			</div>

			<h1
				class="font-display mt-6 min-w-0 max-w-full break-words text-[clamp(2.5rem,10vw,6rem)] font-extrabold uppercase leading-[0.9] tracking-tight [overflow-wrap:anywhere]"
			>
				{nameHead}
				<span class="block text-[clamp(1rem,8vw,3rem)] text-red-600"
					>{nameTail}</span
				>
			</h1>

			<p class="mt-5 text-base leading-relaxed text-slate-300 sm:text-lg">
				Arena lomba warga dengan energi pertandingan besar. Masuk
				lapangan, ikuti skor, dan kejar posisi puncak.
			</p>

			<div class="relative mx-auto mt-6 w-full min-w-0 max-w-[640px]">
				<div
					class="pointer-events-none absolute -inset-3 rounded-3xl border border-cyan-300/15 shadow-[0_0_42px_rgba(34,211,238,0.08)]"
					aria-hidden="true"
				></div>
				<div
					class="relative overflow-hidden rounded-2xl border border-slate-700/80 bg-[#0a0f1c] shadow-2xl shadow-black/40"
				>
					<div
						class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-4 py-3 text-[10px] font-bold uppercase tracking-[0.18em]"
					>
						<span class="text-cyan-300">Pengumunan Lomba</span>
						<span class="text-right text-slate-500"
							>Live / {env.appYear}</span
						>
					</div>
					<div
						class="relative min-h-40 overflow-hidden p-5 sm:min-h-64 sm:p-7"
					>
						<div
							class="absolute inset-x-0 top-1/2 border-t border-dashed border-cyan-300/15"
							aria-hidden="true"
						></div>
						<div
							class="absolute inset-y-0 left-1/2 border-l border-dashed border-indigo-300/15"
							aria-hidden="true"
						></div>
						<div
							class="absolute -left-10 top-8 h-32 w-32 rounded-full border border-cyan-300/10"
							aria-hidden="true"
						></div>
						<div
							class="absolute -right-10 bottom-8 h-32 w-32 rounded-full border border-indigo-300/10"
							aria-hidden="true"
						></div>

						<div class="relative flex items-start justify-between">
							<div>
								<p
									class="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500"
								>
									Siapkan untuk me-
								</p>
								<p
									class="font-display mt-2 text-3xl font-extrabold uppercase leading-none text-slate-100 sm:text-4xl"
								>
									Meriahkan!
								</p>
							</div>
							<div
								class="rounded-xl bg-cyan-300 p-2.5 text-slate-950 shadow-lg shadow-cyan-300/20"
							>
								<Sparkles class="h-5 w-5" aria-hidden="true" />
							</div>
						</div>

						<div
							class="relative mt-12 grid grid-cols-2 gap-3 text-center sm:mt-14"
						>
							<div class="border-r border-slate-800">
								<p
									class="font-display break-words text-xl font-extrabold text-cyan-300 sm:text-2xl"
								>
									{eventDate}
								</p>
								<p
									class="text-[9px] font-bold uppercase tracking-widest text-slate-500"
								>
									Tanggal event
								</p>
							</div>
							<div>
								<p
									class="font-display text-2xl font-extrabold text-indigo-300"
								>
									{env.appYear}
								</p>
								<p
									class="text-[9px] font-bold uppercase tracking-widest text-slate-500"
								>
									Musim
								</p>
							</div>
						</div>
					</div>
					<div
						class="flex items-center justify-between border-t border-slate-800 px-4 py-3 text-[10px] font-bold uppercase tracking-widest"
					>
						<span
							class="inline-flex items-center gap-1.5 text-cyan-300"
							><span
								class="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-300"
							></span>Live</span
						>
						<span class="text-slate-500">Skor langsung</span>
					</div>
					<div class="border-t border-slate-800 p-4 sm:p-5">
						<CountdownTimer />
						<div
							class="mt-3 flex items-center justify-center gap-2 text-center text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500"
						>
							<CalendarDays
								class="h-3.5 w-3.5 text-cyan-300"
								aria-hidden="true"
							/>
							Menuju pertandingan berikutnya
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</section>

{#if loginOpen}
	<div
		class="fixed inset-0 z-50 flex items-end justify-center overflow-hidden bg-slate-950/85 px-2 py-4 backdrop-blur-sm sm:items-center"
		role="presentation"
	>
		<div
			class="w-full rounded-2xl border border-amber-300/30 bg-[#080b14] shadow-[0_0_48px_rgba(251,191,36,0.16)] sm:w-[min(28rem,calc(100vw-2rem))]"
			role="dialog"
			aria-modal="true"
			aria-labelledby="landing-login-title"
		>
			<div
				class="flex items-start justify-between gap-3 border-b border-slate-800 p-5"
			>
				<div>
					<p
						class="font-display text-[10px] font-bold uppercase tracking-[0.2em] text-amber-300"
					>
						Akses arena
					</p>
					<h2
						id="landing-login-title"
						class="font-display mt-1 text-xl font-extrabold uppercase text-white"
					>
						Pilih jalur masuk
					</h2>
				</div>
				<button
					type="button"
					class="btn btn-ghost btn-sm"
					aria-label="Tutup pilihan login"
					onclick={closeLogin}
				>
					<X class="h-4 w-4" aria-hidden="true" />
				</button>
			</div>

			{#if staffOpen}
				<div class="flex flex-col gap-3 p-5">
					<button
						type="button"
						class="inline-flex items-center gap-2 self-start text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-white"
						onclick={() => (staffOpen = false)}
					>
						<ArrowLeft class="h-4 w-4" aria-hidden="true" /> Kembali
					</button>
					<p class="text-sm leading-relaxed text-slate-400">
						Pilih area kerja. Keduanya dilindungi PIN 6 digit.
					</p>
					<div class="flex flex-col gap-3">
						<a
							href="/panitia/checkin"
							onclick={closeLogin}
							class="flex items-center justify-between gap-3 rounded-xl border border-cyan-300/25 bg-cyan-300/5 p-4 text-left transition-colors hover:border-cyan-200/70 hover:bg-cyan-300/10"
						>
							<span
								><strong
									class="block text-sm font-bold text-white"
									>Panitia</strong
								><span class="mt-1 block text-xs text-slate-400"
									>Check-in peserta dan verifikasi tiket</span
								></span
							>
							<span
								class="font-display text-[10px] font-bold uppercase tracking-wider text-cyan-300"
								>PIN</span
							>
						</a>
						<a
							href="/juri"
							onclick={closeLogin}
							class="flex items-center justify-between gap-3 rounded-xl border border-indigo-300/25 bg-indigo-300/5 p-4 text-left transition-colors hover:border-indigo-200/70 hover:bg-indigo-300/10"
						>
							<span
								><strong
									class="block text-sm font-bold text-white"
									>Juri</strong
								><span class="mt-1 block text-xs text-slate-400"
									>Buka event dan input skor</span
								></span
							>
							<span
								class="font-display text-[10px] font-bold uppercase tracking-wider text-indigo-300"
								>PIN</span
							>
						</a>
					</div>
				</div>
			{:else}
				<div class="flex flex-col gap-3 p-5">
					<a
						href="/daftar?login=1"
						onclick={closeLogin}
						class="flex items-center justify-between gap-3 rounded-xl border border-emerald-300/25 bg-emerald-300/5 p-4 text-left transition-colors hover:border-emerald-200/70 hover:bg-emerald-300/10"
					>
						<span
							><strong class="block text-sm font-bold text-white"
								>Peserta</strong
							><span class="mt-1 block text-xs text-slate-400"
								>Masuk dengan nomor WhatsApp</span
							></span
						>
						<LogIn
							class="h-5 w-5 shrink-0 text-emerald-300"
							aria-hidden="true"
						/>
					</a>
					<button
						type="button"
						class="flex items-center justify-between gap-3 rounded-xl border border-cyan-300/25 bg-cyan-300/5 p-4 text-left transition-colors hover:border-cyan-200/70 hover:bg-cyan-300/10"
						onclick={() => (staffOpen = true)}
					>
						<span
							><strong class="block text-sm font-bold text-white"
								>Panitia / Juri</strong
							><span class="mt-1 block text-xs text-slate-400"
								>Masuk ke area kerja dengan PIN</span
							></span
						>
						<span
							class="font-display text-[10px] font-bold uppercase tracking-wider text-cyan-300"
							>PIN</span
						>
					</button>
					<a
						href="/admin"
						onclick={closeLogin}
						class="flex items-center justify-between gap-3 rounded-xl border border-amber-300/30 bg-amber-300/5 p-4 text-left transition-colors hover:border-amber-200/70 hover:bg-amber-300/10"
					>
						<span
							><strong class="block text-sm font-bold text-white"
								>Admin</strong
							><span class="mt-1 block text-xs text-slate-400"
								>Kelola lomba, pembayaran, dan sponsor</span
							></span
						>
						<span
							class="font-display text-[10px] font-bold uppercase tracking-wider text-amber-300"
							>PIN</span
						>
					</a>
				</div>
			{/if}
		</div>
	</div>
{/if}
