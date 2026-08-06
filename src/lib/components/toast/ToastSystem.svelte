<script lang="ts">
	import { Undo2, X } from "@lucide/svelte";
	import { confirmToast, DEFAULT_TOAST_MS, dismissToast, toasts, undoToast } from "./toastStore";

	let now = $state(Date.now());

	$effect(() => {
		const id = setInterval(() => {
			now = Date.now();
		}, 250);
		return () => clearInterval(id);
	});

	$effect(() => {
		const expired = $toasts.filter((t) => now >= t.dismissAt);
		for (const t of expired) {
			confirmToast(t.id);
		}
	});
</script>

<div class="fixed right-4 top-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
	{#each $toasts as toast}
		<div
			class="glass-panel relative overflow-hidden border-border/60 p-4 shadow-lg"
			role="status"
		>
			<p class="pr-8 text-sm font-medium text-foreground">{toast.message}</p>
			<div class="mt-2 flex items-center gap-3">
				<button type="button" class="btn btn-ghost btn-sm" onclick={() => undoToast(toast.id)}>
					<Undo2 class="h-4 w-4" aria-hidden="true" />
					Undo
				</button>
				<button
					type="button"
					class="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
					onclick={() => dismissToast(toast.id)}
					aria-label="Tutup"
				>
					<X class="h-4 w-4" aria-hidden="true" />
				</button>
			</div>
			<div
				class="absolute bottom-0 left-0 h-0.5 bg-secondary/60"
				style="width: {Math.max(0, Math.min(100, ((toast.dismissAt - now) / DEFAULT_TOAST_MS) * 100))}%"
			></div>
		</div>
	{/each}
</div>
