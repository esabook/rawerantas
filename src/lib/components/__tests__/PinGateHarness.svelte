<script lang="ts">
	import PinGate from "$lib/components/PinGate.svelte";
	import type { PinKind } from "$lib/security/pin";

	let { kind = "juri", title = "Masukkan PIN" }: { kind?: PinKind; title?: string } =
		$props();
</script>

<PinGate {kind} {title}>
	<div data-testid="content">Dibuka</div>
</PinGate>
