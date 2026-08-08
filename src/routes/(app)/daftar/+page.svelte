<script lang="ts">
	import { onMount } from "svelte";
	import { ArrowLeft, LogIn, UserRound, X } from "@lucide/svelte";
	import RegistrantProfile from "$lib/components/RegistrantProfile.svelte";
	import RegistrationForm from "$lib/components/RegistrationForm.svelte";
	import {
		findParticipantsByPhone,
		isValidPhone,
		normalizePhone,
	} from "$lib/db/register";
	import {
		getCompetitions,
		type Competition,
		type Participant,
	} from "$lib/db/queries";
	import {
		clearGuestSession,
		loadGuestSession,
		saveGuestSession,
		type GuestSession,
	} from "$lib/offline/guestSession";
	import { isOfflineError } from "$lib/offline/networkStore";

	let competitions = $state<Competition[]>([]);
	let loading = $state(true);
	let loadError = $state("");
	let sessionReady = $state(false);
	let loginOpen = $state(false);
	let guestPhone = $state("");
	let guestLoginError = $state("");
	let guestLoggingIn = $state(false);
	let guestSession = $state<GuestSession | null>(null);
	let profileParticipants = $state<Participant[]>([]);
	let profileLoading = $state(false);

	const phoneWithPrefix = $derived(
		guestPhone.length > 0 ? `+62${guestPhone}` : "",
	);
	const validGuestPhone = $derived(
		/^8\d{8,12}$/.test(guestPhone) && isValidPhone(phoneWithPrefix),
	);

	const loadProfile = async (phone: string) => {
		profileLoading = true;
		try {
			const participants = await findParticipantsByPhone(phone);
			if (participants.length === 0) {
				clearGuestSession();
				guestSession = null;
				profileParticipants = [];
				return;
			}
			profileParticipants = participants;
		} catch (error) {
			// B2-3/F21: kegagalan jaringan jangan menghapus sesi guest — tampilkan
			// data lokal bila ada + tawarkan coba lagi; baru hapus bila benar
			// hasil kosong (di atas) atau galat non-jaringan.
			if (isOfflineError(error)) {
				loadError =
					"Jaringan tidak tersedia. Menampilkan data tersimpan — coba lagi saat koneksi pulih.";
				profileParticipants = [];
				return;
			}
			clearGuestSession();
			guestSession = null;
			profileParticipants = [];
			loadError =
				error instanceof Error
					? error.message
					: "Gagal memuat profil pendaftar.";
		} finally {
			profileLoading = false;
		}
	};

	const closeLogin = () => {
		loginOpen = false;
		guestLoginError = "";
	};

	const openLogin = () => {
		guestLoginError = "";
		loginOpen = true;
	};

	const loginGuest = async () => {
		if (!validGuestPhone || guestLoggingIn) return;
		guestLoggingIn = true;
		guestLoginError = "";
		try {
			const phone = normalizePhone(phoneWithPrefix);
			const participants = await findParticipantsByPhone(phone);
			if (participants.length === 0) {
				guestLoginError =
					"Nomor WA belum terdaftar. Daftarkan diri dulu di formulir.";
				return;
			}
			const session = { phone };
			saveGuestSession(session);
			guestSession = session;
			profileParticipants = participants;
			closeLogin();
		} catch (error) {
			guestLoginError =
				error instanceof Error
					? error.message
					: "Login guest gagal. Coba lagi.";
		} finally {
			guestLoggingIn = false;
		}
	};

	const handleGuestPhoneInput = (event: Event) => {
		guestPhone = (event.currentTarget as HTMLInputElement).value.replace(
			/\D/g,
			"",
		);
	};

	const logoutGuest = () => {
		clearGuestSession();
		guestSession = null;
		profileParticipants = [];
		guestPhone = "";
	};

	onMount(async () => {
		const session = loadGuestSession();
		if (session) {
			guestSession = session;
			void loadProfile(session.phone);
		} else if (
			new URLSearchParams(window.location.search).get("login") === "1"
		) {
			guestLoginError = "";
			loginOpen = true;
		}
		sessionReady = true;
		try {
			competitions = await getCompetitions(false);
		} catch (e) {
			loadError = e instanceof Error ? e.message : "Gagal memuat lomba";
		} finally {
			loading = false;
		}
	});

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

<svelte:head>
	<title>Daftar Lomba</title>
</svelte:head>

<main class="min-w-0 w-full overflow-x-clip py-8">
	<div
		class="mb-6 flex items-start justify-between gap-4 border-b border-cyan-300/15 pb-5"
	>
		<div class="min-w-0">
			<p
				class="font-display text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-300"
			>
				Arena Rawera
			</p>
			<!-- <h1
				class="font-display mt-2 text-2xl font-extrabold uppercase tracking-tight text-white sm:text-3xl"
			>
				Daftar & pantau lomba
			</h1> -->
			<p class="mt-2 max-w-2xl text-sm text-slate-400">
				Masuk dengan nomor WA untuk membuka status pendaftaran dan
				e-tiket Anda.
			</p>
		</div>
		{#if sessionReady && !guestSession}
			<button
				type="button"
				class="btn btn-gold shrink-0"
				onclick={openLogin}
			>
				<LogIn class="h-4 w-4" aria-hidden="true" />
				Login
			</button>
		{/if}
	</div>

	{#if loading}
		<div class="w-full animate-pulse rounded-xl bg-muted p-4">
			<div class="h-6 w-1/2 rounded bg-muted-foreground/20"></div>
			<div class="mt-4 h-10 rounded bg-muted-foreground/10"></div>
		</div>
	{:else if loadError}
		<p class="text-sm text-destructive" role="alert">{loadError}</p>
	{:else if profileLoading}
		<div
			class="flex items-center gap-3 rounded-xl border border-cyan-300/20 bg-cyan-300/5 p-4 text-sm text-cyan-100"
			role="status"
		>
			<UserRound class="h-5 w-5 animate-pulse" aria-hidden="true" />
			Memuat profil pendaftar…
		</div>
	{:else if guestSession && profileParticipants.length > 0}
		<RegistrantProfile
			participants={profileParticipants}
			{competitions}
			onLogout={logoutGuest}
			onRegisterMore={() => logoutGuest()}
		/>
	{:else}
		<RegistrationForm {competitions} onLogin={openLogin} />
	{/if}
</main>

{#if loginOpen}
	<div
		class="fixed inset-0 z-50 flex items-end justify-center overflow-hidden bg-slate-950/80 px-2 py-4 backdrop-blur-sm sm:items-center"
		role="presentation"
	>
		<div
			class="w-full max-w-md overflow-hidden rounded-2xl border border-cyan-300/25 bg-[#080b14] shadow-[0_0_44px_rgba(34,211,238,0.15)]"
			role="dialog"
			aria-modal="true"
			aria-labelledby="login-title"
		>
			<div
				class="flex items-start justify-between gap-3 border-b border-slate-800 p-5"
			>
				<div>
					<p
						class="font-display text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300"
					>
						Akses arena
					</p>
					<h2
						id="login-title"
						class="font-display mt-1 text-xl font-extrabold uppercase text-white"
					>
						Login Peserta
					</h2>
				</div>
				<button
					type="button"
					class="btn btn-ghost btn-sm"
					aria-label="Tutup login"
					onclick={closeLogin}
					><X class="h-4 w-4" aria-hidden="true" /></button
				>
			</div>

			<form
				class="flex flex-col gap-4 p-5"
				onsubmit={(event) => {
					event.preventDefault();
					void loginGuest();
				}}
			>
				<div>
					<p class="mt-1 text-xs leading-relaxed text-slate-400">
						Gunakan nomor WA yang dipakai saat mendaftar. Tidak
						perlu password.
					</p>
				</div>
				<label class="flex flex-col gap-1 text-sm">
					<span class="font-medium text-slate-200">Nomor WA</span>
					<div
						class="flex min-w-0 items-center rounded-lg border border-slate-700 bg-slate-950 focus-within:ring-2 focus-within:ring-cyan-300/60"
					>
						<span
							class="shrink-0 border-r border-slate-700 px-2 py-2.5 text-sm font-semibold text-slate-400"
							aria-hidden="true">+62</span
						>
						<input
							type="tel"
							value={guestPhone}
							oninput={handleGuestPhoneInput}
							class="min-w-0 flex-1 border-0 bg-transparent px-2 py-2.5 text-sm text-white outline-none placeholder:text-slate-600"
							placeholder="81234567890"
							inputmode="numeric"
							pattern={"8[0-9]{8,12}"}
							maxlength="13"
							autocomplete="tel-national"
							required
						/>
					</div>
					{#if guestPhone.length > 0 && !validGuestPhone}<span
							class="text-xs text-rose-200"
							>Nomor harus diawali angka 8 setelah +62.</span
						>{/if}
				</label>
				{#if guestLoginError}<p
						class="rounded-lg border border-rose-300/25 bg-rose-300/10 p-3 text-xs text-rose-100"
						role="alert"
					>
						{guestLoginError}
					</p>{/if}
				<button
					type="submit"
					class="btn btn-gold w-full"
					disabled={!validGuestPhone || guestLoggingIn}
				>
					{#if guestLoggingIn}<span
							class="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
							aria-hidden="true"
						></span>Memeriksa…{:else}<UserRound
							class="h-4 w-4"
							aria-hidden="true"
						/>Masuk sebagai peserta{/if}
				</button>
			</form>
		</div>
	</div>
{/if}
