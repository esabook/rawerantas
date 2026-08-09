<script lang="ts">
	import type { PaymentConfig } from "$lib/db/queries";

	let {
		configs,
		value,
		onchange = () => {},
	}: {
		configs: PaymentConfig[];
		value: string;
		onchange?: (method: string) => void;
	} = $props();

	const configsActive = $derived(configs.filter((c) => c.isActive));

	const labels: Record<string, string> = {
		bank_transfer: "TF-bank",
		ewallet: "E-Wallet",
		qris: "QRIS",
		cash: "Tunai",
	};

	const qrisWithoutImage = $derived(
		value === "qris" &&
			configsActive.find((c) => c.method === "qris")?.qrisImageUrl ==
				null,
	);
</script>

<fieldset class="flex flex-col gap-2 text-sm">
	<legend class="font-medium">Metode pembayaran</legend>

	{#each configsActive as c}
		<label
			class="flex items-center gap-2 rounded-lg border border-border/60 px-2 py-2"
		>
			<input
				type="radio"
				name="payment-method"
				value={c.method}
				checked={value === c.method}
				onchange={(e) => onchange((e.target as HTMLInputElement).value)}
				class="accent-gold"
			/>
			<span class="flex-1">
				<span class="font-medium">{labels[c.method] ?? c.method}</span>
				{#if c.accountName}
					<span class="block text-xs text-muted-foreground">
						{c.accountName}{c.accountNumber
							? ` — ${c.accountNumber}`
							: ""}
					</span>
				{/if}
			</span>
		</label>
	{/each}

	{#if configsActive.length === 0}
		<p class="text-xs text-muted-foreground">
			Belum ada metode pembayaran aktif. Hubungi panitia.
		</p>
	{/if}

	{#if value && qrisWithoutImage}
		<p
			class="rounded-lg bg-muted p-2 text-xs text-muted-foreground"
			role="note"
		>
			QRIS belum tersedia — ikuti instruksi berikut.
		</p>
	{/if}
</fieldset>
