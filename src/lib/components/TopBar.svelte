<script lang="ts">
	import { env } from "$lib/env";
	import { ArrowLeft, LogIn, Radio, X } from "@lucide/svelte";

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

<div
	class="relative flex w-full min-w-0 flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 bg-[#05070d] px-2 py-4 sm:px-4 lg:px-8"
>
	<div class="flex min-w-0 items-center gap-2">
		<span
			class="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-red-300/25 bg-red-300/10 px-2 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-red-200"
		>
			<Radio class="h-3.5 w-3.5 animate-pulse" aria-hidden="true" />
			Tahun {env.appYear}
		</span>
		<span
			class="font-display truncate text-sm font-extrabold uppercase tracking-tight text-slate-100"
		>
			{env.appName || "Lomba Agustusan"}
		</span>
	</div>
	<button
		type="button"
		class="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-cyan-300/60 bg-cyan-300/10 px-4 py-2.5 font-display text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-100 shadow-[0_0_20px_rgba(251,191,36,0.16)] transition-colors hover:border-cyan-200 hover:bg-cyan-300/20"
		onclick={() => (loginOpen = true)}
	>
		<LogIn class="h-3.5 w-3.5" aria-hidden="true" />
		Login
	</button>
</div>

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
