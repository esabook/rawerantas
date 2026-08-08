<script lang="ts">
	import { ImagePlus, Loader2, UploadCloud, X } from "@lucide/svelte";
	import { compressImage } from "$lib/utils/imageCompressor";
	import {
		clearProofDraft,
		loadProofDraft,
		saveProofDraft,
	} from "$lib/offline/proofDraftStore";
	import { online } from "$lib/offline/networkStore";

	let {
		participantId,
		file = $bindable(null),
		required = false,
		label = "Upload bukti pembayaran",
	}: {
		participantId: string;
		file?: File | null;
		required?: boolean;
		label?: string;
	} = $props();

	let previewUrl = $state<string | null>(null);
	let compressing = $state(false);
	let error = $state("");
	let draftOffer = $state(false);
	let fileInput = $state<HTMLInputElement | null>(null);

	const hasProof = $derived(file !== null);

	const checkDraft = async () => {
		const draft = await loadProofDraft(participantId);
		if (draft && !file) {
			draftOffer = true;
		}
	};

	void checkDraft();

	const handleFile = async (input: HTMLInputElement) => {
		const chosen = input.files?.[0];
		if (!chosen) {
			return;
		}
		compressing = true;
		error = "";
		try {
			const compressed = await compressImage(chosen);
			file = compressed;
			previewUrl = URL.createObjectURL(compressed);
			await saveProofDraft({
				participantId,
				blob: compressed,
				name: compressed.name,
				savedAt: Date.now(),
			});
		} catch (e) {
			error = e instanceof Error ? e.message : "Gagal memproses gambar";
		} finally {
			compressing = false;
		}
	};

	const restoreDraft = async () => {
		const draft = await loadProofDraft(participantId);
		if (draft) {
			file = new File([draft.blob], draft.name, {
				type: draft.blob.type,
			});
			previewUrl = URL.createObjectURL(draft.blob);
			draftOffer = false;
		}
	};

	const clear = async () => {
		file = null;
		if (previewUrl) {
			URL.revokeObjectURL(previewUrl);
			previewUrl = null;
		}
		await clearProofDraft(participantId);
	};
</script>

<div class="flex flex-col gap-2 text-sm">
	<span class="font-medium">{label}</span>

	{#if draftOffer}
		<div
			class="flex items-center justify-between gap-2 rounded-lg bg-muted p-3"
			role="note"
		>
			<p class="text-xs text-muted-foreground">
				Bukti tersimpan dari percobaan sebelumnya ditemukan.
			</p>
			<div class="flex gap-2">
				<button
					type="button"
					class="btn btn-sm"
					onclick={restoreDraft}
					disabled={!$online}
				>
					Pulihkan
				</button>
				<button
					type="button"
					class="btn btn-ghost btn-sm"
					onclick={clear}
				>
					Buang
				</button>
			</div>
		</div>
	{:else}
		<input
			type="file"
			accept="image/*"
			bind:this={fileInput}
			class="hidden"
			onchange={(e) => void handleFile(e.currentTarget)}
		/>
		{#if !file}
			<button
				type="button"
				class="flex flex-col items-center gap-1 rounded-lg border border-dashed border-border p-4 text-muted-foreground hover:border-secondary"
				onclick={() => fileInput?.click()}
				disabled={compressing}
			>
				{#if compressing}
					<Loader2 class="h-6 w-6 animate-spin" aria-hidden="true" />
					<span>Mengompresi…</span>
				{:else}
					<UploadCloud class="h-6 w-6" aria-hidden="true" />
					<span class="text-xs">Pilih gambar (otomatis ≤200 KB)</span>
				{/if}
			</button>
		{:else}
			<div
				class="flex items-center gap-3 rounded-lg border border-border/60 p-2"
			>
				<img
					src={previewUrl ?? ""}
					alt="Pratinjau bukti"
					class="h-16 w-16 rounded object-cover"
				/>
				<div class="min-w-0 flex-1">
					<p class="truncate text-xs font-medium">{file.name}</p>
					<p class="text-xs text-muted-foreground">
						{(file.size / 1024).toFixed(1)} KB
					</p>
				</div>
				<button
					type="button"
					class="btn btn-ghost btn-sm"
					onclick={clear}
					aria-label="Hapus bukti"
				>
					<X class="h-4 w-4" aria-hidden="true" />
				</button>
			</div>
		{/if}
		{#if error}
			<p class="text-xs text-destructive" role="alert">{error}</p>
		{/if}
		{#if required && !hasProof && !compressing}
			<p class="text-xs text-muted-foreground">
				<ImagePlus class="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
				Bukti wajib untuk metode ini.
			</p>
		{/if}
	{/if}
</div>
