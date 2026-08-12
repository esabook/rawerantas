<script lang="ts">
	import { CheckCircle2, Fish, Loader2, TriangleAlert } from "@lucide/svelte";
	import { onMount } from "svelte";
	import { sfx, vibrate } from "$lib/audio/sfx";
	import {
		hasJackpot,
		InvalidWeightError,
		removeScore,
		submitMancingScore,
		validateWeight,
	} from "$lib/db/scores";
	import { getParticipants } from "$lib/db/queries";
	import type { Participant } from "$lib/db/queries";
	import { online } from "$lib/offline/networkStore";
	import { undoable } from "$lib/components/toast/toastStore";

	let {
		competitionId,
		competitionName,
		recordedBy,
	}: {
		competitionId: string;
		competitionName: string;
		recordedBy: string;
	} = $props();

	let participants = $state<Participant[]>([]);
	let lapak = $state<number | null>(null);
	let digits = $state("");
	let jackpot = $state(false);
	let jackpotConfirm = $state(false);
	let submitting = $state(false);
	let error = $state("");

	const selected = $derived(
		lapak === null
			? undefined
			: participants.find((p) => p.lapakNumber === String(lapak)),
	);
	const weightGram = $derived(digits === "" ? 0 : Number(digits));
	const weightValid = $derived(weightGram > 0);
	const canSubmit = $derived(weightValid && lapak !== null && !submitting);

	const displayKg = $derived(
		weightGram > 0 ? (weightGram / 1000).toLocaleString("id-ID") : "0",
	);

	onMount(() => {
		// B3-1/A23: offline-safe — kegagalan fetch tidak boleh mengosongkan panel.
		const loadParticipants = () =>
			getParticipants(competitionId)
				.then((rows) => {
					participants = rows;
				})
				.catch(() => {});
		void loadParticipants();
		// B3-3/A36: polling ringan agar peserta baru muncul tanpa reload.
		const timer = setInterval(loadParticipants, 30_000);
		return () => clearInterval(timer);
	});

	const press = (digit: string) => {
		error = "";
		if (digit === "⌫") {
			sfx.backspace();
			digits = digits.slice(0, -1);
			return;
		}
		if (digits.length >= 6) {
			sfx.error();
			return;
		}
		sfx.tap();
		vibrate(10);
		digits = digits === "0" ? digit : digits + digit;
	};

	const confirmJackpot = async (): Promise<boolean> => {
		if (!jackpot || lapak === null) {
			return true;
		}
		const selectedP = selected;
		if (!selectedP) {
			return true;
		}
		// B3-1/A24: kegagalan hasJackpot (offline) dianggap "tidak diketahui" —
		// lewati konfirmasi ganda & lanjut submit, bukan memblokir skor jackpot.
		let alreadyJackpot = false;
		try {
			alreadyJackpot = await hasJackpot(competitionId, selectedP.id);
		} catch {
			alreadyJackpot = false;
		}
		if (alreadyJackpot) {
			jackpotConfirm = true;
			sfx.confirm();
			vibrate([30, 20, 30]);
			return false;
		}
		return true;
	};

	const submit = async () => {
		if (!canSubmit) {
			return;
		}
		if (!jackpotConfirm && !(await confirmJackpot())) {
			return;
		}
		const selectedP = selected;
		if (!selectedP) {
			error = "Peserta No Peserta belum termuat. Coba lagi.";
			return;
		}
		submitting = true;
		error = "";
		try {
			const weight = validateWeight(weightGram);
			const result = await submitMancingScore({
				competitionId,
				participantId: selectedP.id,
				fishWeightGram: weight,
				isJackpot: jackpot,
				recordedBy,
			});
			const label = `No Peserta ${lapak} — ${(weight / 1000).toLocaleString("id-ID")} kg${jackpot ? " 🎗️" : ""}`;
			undoable(
				result.queued ? `Antrean: ${label}` : `Tersimpan: ${label}`,
				{
					onUndo: () => {
						void removeScore(result.id, result.queued).then(() => {
							undoable("Skor dibatalkan", {
								onConfirm: () => {},
								timeoutMs: 2000,
							});
						});
					},
					onConfirm: () => {},
				},
			);
			digits = "";
			jackpot = false;
			jackpotConfirm = false;
			sfx.coin();
			vibrate(80);
		} catch (e) {
			sfx.error();
			vibrate([120, 60, 120]);
			error =
				e instanceof InvalidWeightError || e instanceof Error
					? e.message
					: "Gagal menyimpan skor.";
		} finally {
			submitting = false;
		}
	};
</script>

<div
	class="flex w-full flex-col gap-4 rounded-xl border border-border bg-background/60 p-4"
>
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-2">
			<Fish class="h-5 w-5 text-gold" aria-hidden="true" />
			<h1 class="font-bold">{competitionName}</h1>
		</div>
		{#if !$online}
			<span
				class="rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-600"
			>
				Offline — antrean
			</span>
		{/if}
	</div>

	<label class="flex flex-col gap-1 text-sm">
		<span class="font-medium">No Peserta peserta</span>
		<select
			class="input"
			value={lapak === null ? "" : String(lapak)}
			onchange={(e) => {
				lapak = e.currentTarget.value
					? Number(e.currentTarget.value)
					: null;
				error = "";
				jackpotConfirm = false;
			}}
		>
			<option value="" disabled>Pilih BIB…</option>
			{#each participants
				.filter((x) => x.lapakNumber != null && x.lapakNumber !== "")
				.sort((a, b) => Number(a.lapakNumber) - Number(b.lapakNumber)) as p}
				<option
					value={p.lapakNumber}
					disabled={p.status === "disqualified"}
				>
					{p.lapakNumber} — {p.name}
				</option>
			{/each}
		</select>
		{#if selected?.name}
			<span class="text-xs text-muted-foreground">{selected.name}</span>
		{/if}
	</label>

	<div class="flex flex-col gap-1 text-sm">
		<span class="font-medium">Timbangan</span>
		<div
			class="rounded-lg border border-border bg-background px-4 py-3 text-right font-mono text-2xl font-bold tabular-nums"
			role="status"
			aria-label="Timbangan"
		>
			{displayKg} kg
		</div>
		<div class="grid grid-cols-3 gap-2">
			{#each ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "00", "⌫"] as key}
				<button
					type="button"
					class="btn h-14 text-lg"
					onclick={() => press(key)}
					aria-label={key === "⌫" ? "Hapus digit" : `Digit ${key}`}
				>
					{key}
				</button>
			{/each}
		</div>
	</div>

	<label
		class="flex cursor-pointer items-center justify-between rounded-lg border border-border/60 px-2 py-2 text-sm"
	>
		<span class="font-medium">Jackpot Pita</span>
		<input
			type="checkbox"
			bind:checked={jackpot}
			class="h-5 w-5 accent-gold"
			onchange={() => (jackpotConfirm = false)}
		/>
	</label>

	{#if jackpotConfirm && lapak !== null}
		<div
			class="rounded-lg bg-destructive/10 p-3 text-xs text-destructive"
			role="alert"
		>
			<TriangleAlert class="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
			No Peserta ini sudah tercatat jackpot pita. Simpan tetap?
		</div>
	{/if}

	{#if error}
		<p class="text-sm text-destructive" role="alert">{error}</p>
	{/if}

	<button
		type="button"
		class="btn btn-gold h-14 text-lg"
		onclick={() => void submit()}
		disabled={!canSubmit}
	>
		{#if submitting}
			<Loader2 class="h-5 w-5 animate-spin" aria-hidden="true" />
			Menyimpan…
		{:else}
			<CheckCircle2 class="h-5 w-5" aria-hidden="true" />
			Simpan Skor
		{/if}
	</button>
</div>
