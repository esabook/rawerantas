<script lang="ts">
	import { Lock } from "@lucide/svelte";
	import { sfx, vibrate } from "$lib/audio/sfx";
	import { grantStillValid, readGrant, verifyPin, type PinKind } from "$lib/security/pin";

	let {
		kind = "juri",
		title = "Masukkan PIN",
		children,
	}: {
		kind?: PinKind;
		title?: string;
		children: import("svelte").Snippet;
	} = $props();

	let pin = $state("");
	let locked = $state(false);
	let lockMessage = $state("");
	let error = $state("");
	let verifying = $state(false);

	let unlocked = $state(false);

	$effect(() => {
		unlocked = grantStillValid(readGrant(kind));
	});
	const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];
	const dots = Array.from({ length: 4 }, (_, i) => i);

	const press = async (digit: string) => {
		if (locked || verifying || pin.length >= 4) {
			return;
		}
		sfx.tap();
		vibrate(10);
		pin += digit;
		if (pin.length === 4) {
			await submit();
		}
	};

	const backspace = () => {
		if (verifying || locked) {
			return;
		}
		sfx.backspace();
		pin = pin.slice(0, -1);
		error = "";
	};

	const submit = async () => {
		if (verifying || locked || pin.length !== 4) {
			return;
		}
		verifying = true;
		error = "";
		try {
			await verifyPin(kind, pin);
			unlocked = true;
			pin = "";
			sfx.coin();
			vibrate([40, 30, 60]);
		} catch (e) {
			pin = "";
			sfx.error();
			vibrate([120, 60, 120]);
			if (e instanceof Error) {
				if (e.message.includes("Kunci")) {
					locked = true;
					lockMessage = e.message;
				} else {
					error = e.message;
				}
			}
		} finally {
			verifying = false;
		}
	};

	const resetLock = () => {
		locked = false;
		lockMessage = "";
	};
</script>

{#if unlocked}
	{@render children()}
{:else}
	<div class="mx-auto flex w-full max-w-sm flex-col items-center gap-4 px-4 py-8">
		<Lock class="h-10 w-10 text-secondary" aria-hidden="true" />
		<h1 class="text-xl font-semibold">{title}</h1>
		<p class="text-sm text-muted-foreground">
			PIN {kind === "admin" ? "admin" : "juri"} 4 digit
		</p>

		{#if locked}
			<div role="alert" class="w-full rounded-lg bg-destructive/15 p-4 text-center">
				<p class="text-sm font-semibold text-destructive">{lockMessage}</p>
				<p class="mt-1 text-xs text-muted-foreground">Coba lagi nanti.</p>
				<button type="button" class="btn btn-ghost mt-3 text-sm" onclick={resetLock}>
					Reset
				</button>
			</div>
		{:else}
			<div class="flex gap-2" aria-label="PIN dots">
				{#each dots as i}
					<div
						class="h-3 w-3 rounded-full {pin.length > i ? 'bg-secondary' : 'bg-muted'} transition-colors"
					></div>
				{/each}
			</div>

			{#if error}
				<p role="alert" class="text-sm font-medium text-destructive">{error}</p>
			{/if}

			<div class="grid w-full grid-cols-3 gap-2" aria-label="keypad">
				{#each keys as key}
					{#if key === "⌫"}
						<button
							type="button"
							class="btn btn-ghost h-14 text-xl"
							onclick={backspace}
							disabled={verifying || pin.length === 0}
						>
							{key}
						</button>
					{:else if key === ""}
						<span></span>
					{:else}
						<button
							type="button"
							class="btn h-14 text-xl"
							onclick={() => press(key)}
							disabled={verifying || pin.length >= 4}
						>
							{key}
						</button>
					{/if}
				{/each}
			</div>

			<button
				type="button"
				class="btn btn-ghost text-sm"
				onclick={backspace}
				disabled={verifying || pin.length === 0}
			>
				Hapus digit
			</button>
		{/if}
	</div>
{/if}
