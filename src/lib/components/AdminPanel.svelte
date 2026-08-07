<script lang="ts">
	import { ArrowRight, Loader2, Save, Settings2 } from "@lucide/svelte";
	import { onMount } from "svelte";
	import { undoable } from "$lib/components/toast/toastStore";
	import {
		advanceRound,
		saveCompetition,
		savePaymentConfig,
	} from "$lib/db/admin";
	import { getCompetitions, getPaymentConfigs } from "$lib/db/queries";
	import type { Competition, PaymentConfig } from "$lib/db/queries";

	let competitions = $state<Competition[]>([]);
	let configs = $state<PaymentConfig[]>([]);
	let loading = $state(true);
	let error = $state("");
	let tab = $state<"config" | "competition">("competition");
	let savingId = $state<string | null>(null);
	let advancing = $state<string | null>(null);

	const load = async () => {
		try {
			const [comps, cfgs] = await Promise.all([
				getCompetitions(false),
				getPaymentConfigs(false),
			]);
			competitions = comps;
			configs = cfgs;
			error = "";
		} catch (e) {
			error = e instanceof Error ? e.message : "Gagal memuat konfigurasi.";
		} finally {
			loading = false;
		}
	};

	onMount(() => {
		void load();
	});

	const saveComp = async (c: Competition) => {
		if (savingId !== null) {
			return;
		}
		savingId = c.id;
		error = "";
		try {
			await saveCompetition(c);
			undoable("Konfigurasi kompetisi tersimpan.", { onConfirm: () => {} });
			await load();
		} catch (e) {
			error = e instanceof Error ? e.message : "Gagal menyimpan.";
		} finally {
			savingId = null;
		}
	};

	const saveConfig = async (cfg: PaymentConfig) => {
		if (savingId !== null) {
			return;
		}
		savingId = cfg.id;
		error = "";
		try {
			await savePaymentConfig(cfg);
			undoable("Konfigurasi pembayaran tersimpan.", { onConfirm: () => {} });
			await load();
		} catch (e) {
			error = e instanceof Error ? e.message : "Gagal menyimpan.";
		} finally {
			savingId = null;
		}
	};

	const nextRound = async (c: Competition) => {
		if (advancing !== null) {
			return;
		}
		advancing = c.id;
		error = "";
		try {
			const { round } = await advanceRound(c.id);
			undoable(`Babak ${c.name} maju ke ronde ${round}. Board reset.`, {
				onConfirm: () => {},
			});
			await load();
		} catch (e) {
			error = e instanceof Error ? e.message : "Gagal advance round.";
		} finally {
			advancing = null;
		}
	};
</script>

<div class="mx-auto flex w-full max-w-2xl flex-col gap-4">
	<div class="flex items-center gap-2">
		<Settings2 class="h-5 w-5 text-gold" aria-hidden="true" />
		<h1 class="text-lg font-bold">Admin — Konfigurasi & Round</h1>
	</div>

	{#if error}
		<p class="text-sm text-destructive" role="alert">{error}</p>
	{/if}

	{#if loading}
		<div class="flex items-center gap-2 py-10 text-muted-foreground">
			<Loader2 class="h-5 w-5 animate-spin" aria-hidden="true" />
			<p class="text-sm">Memuat…</p>
		</div>
	{:else}
		<div class="flex gap-2">
			<button
				type="button"
				class="btn {tab === 'competition' ? 'btn-gold' : ''}"
				onclick={() => (tab = "competition")}
			>
				Kompetisi
			</button>
			<button
				type="button"
				class="btn {tab === 'config' ? 'btn-gold' : ''}"
				onclick={() => (tab = "config")}
			>
				Metode Pembayaran
			</button>
		</div>

		{#if tab === "competition"}
			<div class="flex flex-col gap-3">
				{#each competitions as c (c.id)}
					<div class="flex flex-col gap-3 rounded-xl border border-border bg-background/60 p-4">
						<div class="flex items-center justify-between">
							<label class="flex items-center gap-2 text-sm font-semibold">
								<input
									type="checkbox"
									checked={c.isActive}
									onchange={(e) => {
										c.isActive = e.currentTarget.checked;
									}}
									class="h-4 w-4 accent-gold"
								/>
								{c.name}
								<span class="rounded-full bg-border/50 px-2 py-0.5 text-xs font-normal">
									{c.scoringMode}
								</span>
							</label>
							<span class="text-xs text-muted-foreground">
								Babak {c.currentRound}
							</span>
						</div>
						<div class="grid grid-cols-3 gap-2 text-sm">
							<label class="flex flex-col gap-1">
								<span class="text-xs text-muted-foreground">Fee (Rp)</span>
								<input
									type="number"
									class="input"
									value={c.fee}
									onchange={(e) => {
										c.fee = Number(e.currentTarget.value);
									}}
								/>
							</label>
							<label class="flex flex-col gap-1">
								<span class="text-xs text-muted-foreground">Kuota</span>
								<input
									type="number"
									class="input"
									value={c.totalQuota}
									onchange={(e) => {
										c.totalQuota = Number(e.currentTarget.value);
									}}
								/>
							</label>
							<label class="flex flex-col gap-1">
								<span class="text-xs text-muted-foreground">Mode</span>
								<select
									class="input"
									value={c.scoringMode}
									onchange={(e) => {
										c.scoringMode = e.currentTarget
											.value as Competition["scoringMode"];
									}}
								>
									<option value="terberat">terberat</option>
									<option value="kumulatif">kumulatif</option>
									<option value="jackpot_pita">jackpot_pita</option>
									<option value="layangan_aduan">layangan_aduan</option>
									<option value="layangan_hias">layangan_hias</option>
								</select>
							</label>
						</div>
						<div class="flex justify-end gap-2">
							<button
								type="button"
								class="btn"
								onclick={() => void nextRound(c)}
								disabled={c.scoringMode !== "layangan_aduan" || advancing !== null}
								title={c.scoringMode !== "layangan_aduan" ? "Hanya mode aduan" : "Babak berikutnya"}
							>
								{#if advancing === c.id}
									<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
								{:else}
									<ArrowRight class="h-4 w-4" aria-hidden="true" />
								{/if}
								Advance Round
							</button>
							<button
								type="button"
								class="btn btn-gold"
								onclick={() => void saveComp(c)}
								disabled={savingId !== null}
							>
								<Save class="h-4 w-4" aria-hidden="true" />
								Simpan
							</button>
						</div>
					</div>
				{/each}
			</div>
		{:else}
			<div class="flex flex-col gap-3">
				{#each configs as cfg (cfg.id)}
					<div class="flex flex-col gap-3 rounded-xl border border-border bg-background/60 p-4">
						<label class="flex items-center gap-2 text-sm font-semibold">
							<input
								type="checkbox"
								checked={cfg.isActive}
								onchange={(e) => {
									cfg.isActive = e.currentTarget.checked;
								}}
								class="h-4 w-4 accent-gold"
							/>
							{cfg.method}
						</label>
						<div class="grid grid-cols-2 gap-2 text-sm">
							<label class="flex flex-col gap-1">
								<span class="text-xs text-muted-foreground">Nama akun</span>
								<input
									type="text"
									class="input"
									value={cfg.accountName ?? ""}
									onchange={(e) => {
										cfg.accountName = e.currentTarget.value || null;
									}}
								/>
							</label>
							<label class="flex flex-col gap-1">
								<span class="text-xs text-muted-foreground">Nomor akun</span>
								<input
									type="text"
									class="input"
									value={cfg.accountNumber ?? ""}
									onchange={(e) => {
										cfg.accountNumber = e.currentTarget.value || null;
									}}
								/>
							</label>
							<label class="col-span-2 flex flex-col gap-1">
								<span class="text-xs text-muted-foreground">Instruksi</span>
								<input
									type="text"
									class="input"
									value={cfg.instructions ?? ""}
									onchange={(e) => {
										cfg.instructions = e.currentTarget.value;
									}}
								/>
							</label>
							<label class="col-span-2 flex flex-col gap-1">
								<span class="text-xs text-muted-foreground">URL gambar QRIS</span>
								<input
									type="text"
									class="input"
									value={cfg.qrisImageUrl ?? ""}
									onchange={(e) => {
										cfg.qrisImageUrl = e.currentTarget.value || null;
									}}
								/>
							</label>
						</div>
						<div class="flex justify-end">
							<button
								type="button"
								class="btn btn-gold"
								onclick={() => void saveConfig(cfg)}
								disabled={savingId !== null}
							>
								<Save class="h-4 w-4" aria-hidden="true" />
								Simpan
							</button>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	{/if}
</div>
