<script lang="ts">
	import { onMount } from "svelte";
	import QRCode from "qrcode";
	import { env } from "$lib/env";
	import { buildCheckinUrl } from "$lib/utils/whatsapp";

	let { id, size = 160 }: { id: string | number; size?: number } = $props();

	let dataUrl = $state<string | null>(null);
	let failed = $state(false);

	const baseUrlMissing = $derived(env.baseUrl.length === 0);

	onMount(() => {
		if (baseUrlMissing) {
			console.warn(
				"[QRCode] PUBLIC_BASE_URL kosong — QR tidak digenerate. Isi .env.",
			);
			return;
		}
		const payload = buildCheckinUrl(id);
		QRCode.toDataURL(payload, {
			width: size,
			margin: 4,
			errorCorrectionLevel: "M",
		})
			.then((url) => {
				dataUrl = url;
			})
			.catch(() => {
				failed = true;
			});
	});
</script>

{#if baseUrlMissing}
	<div
		class="flex flex-col items-center gap-1 rounded-lg border border-dashed border-border p-4 text-center"
		role="alert"
	>
		<p class="text-sm font-medium text-destructive">QR tidak tersedia</p>
		<p class="text-xs text-muted-foreground">
			PUBLIC_BASE_URL belum diatur di <code>.env</code>.
		</p>
	</div>
{:else if failed}
	<div class="text-sm text-destructive" role="alert">Gagal generate QR.</div>
{:else if dataUrl}
	<img src={dataUrl} alt="QR check-in" width={size} height={size} />
{:else}
	<div
		class="animate-pulse rounded-lg bg-muted"
		style="width: {size}px; height: {size}px"
		aria-label="QR loading"
	></div>
{/if}
