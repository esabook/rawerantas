<script lang="ts">
	import { Volume2, VolumeX } from "@lucide/svelte";
	import {
		loadTtsPreference,
		setTtsEnabled,
		ttsAvailable,
		ttsEnabled,
		ttsSpeaking,
	} from "$lib/tts/ttsAnnouncer";

	loadTtsPreference();
</script>

<button
	type="button"
	class="btn btn-ghost inline-flex items-center gap-2"
	onclick={() => setTtsEnabled(!$ttsEnabled)}
	disabled={!$ttsAvailable}
	aria-pressed={$ttsEnabled}
>
	{#if $ttsEnabled}
		<Volume2 class="h-4 w-4" aria-hidden="true" />
		Suara: nyala
	{:else}
		<VolumeX class="h-4 w-4" aria-hidden="true" />
		Suara: mati
	{/if}
	{#if $ttsSpeaking}
		<span class="h-2 w-2 animate-pulse rounded-full bg-gold" aria-label="berbicara"></span>
	{/if}
</button>
