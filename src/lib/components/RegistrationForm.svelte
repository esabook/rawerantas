<script lang="ts">
	import { AlertTriangle, Loader2, Ticket } from "@lucide/svelte";
	import type { Competition } from "$lib/db/queries";
	import {
		isValidPhone,
		normalizePhone,
		QuotaFullError,
		registerParticipant,
		type RegistrationResult,
	} from "$lib/db/register";
	import {
		clearDraft,
		loadDraft,
		saveDraft,
		type RegistrationDraft,
	} from "$lib/offline/draftStore";
	import { online } from "$lib/offline/networkStore";

	let {
		competitions,
	}: {
		competitions: Competition[];
	} = $props();

	const draft = loadDraft();

	let name = $state(draft?.name ?? "");
	let phone = $state(draft?.phone ?? "");
	let competitionId = $state(draft?.competitionId ?? "");
	let payment = $state<"dp" | "full">(draft?.payment ?? "dp");

	let submitting = $state(false);
	let submitted = $state<RegistrationResult | null>(null);
	let error = $state("");
	let quotaFull = $state(false);

	const selectedCompetition = $derived(
		competitions.find((c) => c.id === competitionId),
	);
	const phoneError = $derived(phone.length > 0 && !isValidPhone(phone));
	const formValid = $derived(
		name.trim().length >= 2 &&
			isValidPhone(phone) &&
			competitionId.length > 0 &&
			!submitting,
	);

	const persistDraft = () => {
		const draftData: RegistrationDraft = {
			name,
			phone,
			competitionId,
			payment,
			savedAt: Date.now(),
		};
		saveDraft(draftData);
	};

	const submit = async () => {
		if (!formValid) {
			return;
		}
		submitting = true;
		error = "";
		quotaFull = false;
		persistDraft();
		try {
			const result = await registerParticipant({
				competitionId,
				name: name.trim(),
				phone: normalizePhone(phone),
			});
			submitted = result;
			clearDraft();
		} catch (e) {
			if (e instanceof QuotaFullError) {
				quotaFull = true;
			} else {
				error = e instanceof Error ? e.message : "Gagal mendaftar. Coba lagi.";
			}
		} finally {
			submitting = false;
		}
	};
</script>

{#if submitted}
	<div class="glass-panel mx-auto w-full max-w-md rounded-xl p-6 text-center" role="status">
		<Ticket class="mx-auto h-10 w-10 text-gold" aria-hidden="true" />
		<h2 class="mt-3 text-xl font-bold">
			{submitted.queued ? "Pendaftaran masuk antrean" : "Berhasil terdaftar"}
		</h2>
		<p class="mt-2 text-sm text-muted-foreground">
			{#if submitted.queued}
				Data tersimpan di perangkat dan akan dikirim otomatis saat koneksi pulih.
			{:else if submitted.duplicated}
				Nomor WA ini sudah terdaftar untuk lomba ini.
			{/if}
		</p>
		{#if submitted.ticketNumber}
			<p class="mt-3 text-2xl font-bold tabular-nums text-gold">{submitted.ticketNumber}</p>
			<p class="text-xs text-muted-foreground">Simpan nomor tiket ini untuk check-in.</p>
		{/if}
		<button type="button" class="btn btn-gold mt-5" onclick={() => (submitted = null)}>
			Daftar lagi
		</button>
	</div>
{:else}
	<form
		class="mx-auto flex w-full max-w-md flex-col gap-4 rounded-xl border border-border bg-background/60 p-6"
		onsubmit={(e) => {
			e.preventDefault();
			void submit();
		}}
	>
		<h1 class="text-xl font-bold">Pendaftaran Lomba</h1>

		<label class="flex flex-col gap-1 text-sm">
			<span class="font-medium">Nama lengkap</span>
			<input
				type="text"
				bind:value={name}
				class="input"
				placeholder="Nama peserta"
				autocomplete="name"
				required
			/>
		</label>

		<label class="flex flex-col gap-1 text-sm">
			<span class="font-medium">Nomor WA</span>
			<input
				type="tel"
				bind:value={phone}
				class="input"
				placeholder="08xxxxxxxxxx"
				autocomplete="tel"
				required
			/>
			{#if phoneError}
				<span class="text-xs text-destructive">Format nomor WA tidak valid (08… / 62…).</span>
			{/if}
		</label>

		<label class="flex flex-col gap-1 text-sm">
			<span class="font-medium">Pilih lomba</span>
			<select bind:value={competitionId} class="input" required>
				<option value="" disabled>Pilih lomba…</option>
				{#each competitions as c}
					<option value={c.id} disabled={!c.isActive}>
						{c.name} — Rp {c.fee.toLocaleString("id-ID")}
					</option>
				{/each}
			</select>
		</label>

		<fieldset class="flex flex-col gap-2 text-sm">
			<legend class="font-medium">Pembayaran</legend>
			{#each ["dp", "full"] as mode}
				<label class="flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2">
					<input
						type="radio"
						name="payment"
						value={mode}
						bind:group={payment}
						class="accent-gold"
					/>
					<span>
						{mode === "dp" ? "DP" : "Lunas"}
						<span class="text-muted-foreground">
							{mode === "dp"
								? ` (min Rp ${(selectedCompetition?.minDp ?? 0).toLocaleString("id-ID")})`
								: ` (Rp ${(selectedCompetition?.fee ?? 0).toLocaleString("id-ID")})`}
						</span>
					</span>
				</label>
			{/each}
		</fieldset>

		<div class="rounded-lg bg-destructive/10 p-3 text-xs text-destructive" role="note">
			<AlertTriangle class="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
			No-refund: biaya pendaftaran tidak dapat dikembalikan setelah dibayar.
		</div>

		{#if error}
			<p class="text-sm text-destructive" role="alert">{error}</p>
		{/if}

		{#if quotaFull}
			<div class="rounded-lg bg-destructive/15 p-4 text-center" role="alert">
				<p class="font-semibold text-destructive">Kuota lomba sudah habis.</p>
				<p class="mt-1 text-xs text-muted-foreground">
					Silakan pilih lomba lain atau hubungi panitia.
				</p>
				<button
					type="button"
					class="btn btn-ghost btn-sm mt-2"
					onclick={() => (quotaFull = false)}
				>
					Pilih lomba lain
				</button>
			</div>
		{/if}

		<button type="submit" class="btn btn-gold" disabled={!formValid}>
			{#if submitting}
				<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
				Mendaftar…
			{:else if !$online}
				Simpan untuk offline
			{:else}
				Daftar sekarang
			{/if}
		</button>
	</form>
{/if}
