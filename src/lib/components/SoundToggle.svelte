<script lang="ts">
	import { Volume2, VolumeX } from "@lucide/svelte";
	import {
		loadSfxPreference,
		setSfxEnabled,
		sfxEnabled,
	} from "$lib/audio/sfx";
	import {
		loadTtsPreference,
		setTtsEnabled,
		ttsAvailable,
		ttsSpeaking,
	} from "$lib/tts/ttsAnnouncer";

	loadSfxPreference();
	loadTtsPreference();

	const toggle = () => {
		const next = !$sfxEnabled;
		setSfxEnabled(next);
		if ($ttsAvailable) {
			setTtsEnabled(next);
		}
	};
</script>

<button
	type="button"
	class="btn btn-ghost inline-flex items-center gap-2"
	onclick={toggle}
	disabled={!$sfxEnabled && !$ttsAvailable}
	aria-pressed={$sfxEnabled}
>
	{#if $sfxEnabled}
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
