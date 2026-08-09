<script lang="ts">
	import { Scale, X } from "@lucide/svelte";
	import termsMd from "$lib/content/terms.md?raw";

	let {
		open,
		title = "Syarat & Ketentuan",
		subtitle = "",
		onclose,
	}: {
		open: boolean;
		title?: string;
		subtitle?: string;
		onclose: () => void;
	} = $props();

	interface InlineNode {
		kind: "text" | "bold" | "link";
		text: string;
		href?: string;
	}

	interface Block {
		kind: "h2" | "h3" | "p" | "list";
		text?: string;
		items?: string[];
		ordered?: boolean;
	}

	const INLINE_TOKEN = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;

	function inlineNodes(text: string): InlineNode[] {
		const parts = text.split(INLINE_TOKEN);
		const nodes: InlineNode[] = [];
		for (const part of parts) {
			if (!part) continue;
			if (part.startsWith("**") && part.endsWith("**")) {
				nodes.push({ kind: "bold", text: part.slice(2, -2) });
			} else {
				const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
				if (link) {
					nodes.push({ kind: "link", text: link[1], href: link[2] });
				} else {
					nodes.push({ kind: "text", text: part });
				}
			}
		}
		return nodes;
	}

	function parseBlocks(md: string): Block[] {
		const blocks: Block[] = [];
		const lines = md.split(/\r?\n/);
		for (let i = 0; i < lines.length; i += 1) {
			const line = lines[i].trim();
			if (!line) continue;
			if (line.startsWith("## ")) {
				blocks.push({ kind: "h2", text: line.slice(3) });
			} else if (line.startsWith("### ")) {
				blocks.push({ kind: "h3", text: line.slice(4) });
			} else if (line.startsWith("- ")) {
				const items: string[] = [line.slice(2)];
				while (i + 1 < lines.length && lines[i + 1].trim().startsWith("- ")) {
					i += 1;
					items.push(lines[i].trim().slice(2));
				}
				blocks.push({ kind: "list", items, ordered: false });
			} else if (/^\d+\.\s/.test(line)) {
				const items: string[] = [line.replace(/^\d+\.\s/, "")];
				while (
					i + 1 < lines.length &&
					/^\d+\.\s/.test(lines[i + 1].trim())
				) {
					i += 1;
					items.push(lines[i].trim().replace(/^\d+\.\s/, ""));
				}
				blocks.push({ kind: "list", items, ordered: true });
			} else {
				blocks.push({ kind: "p", text: line });
			}
		}
		return blocks;
	}

	const blocks = $derived(parseBlocks(termsMd));

	$effect(() => {
		if (!open) return;
		const previousBodyOverflow = document.body.style.overflow;
		const previousDocumentOverflow =
			document.documentElement.style.overflow;
		document.body.style.overflow = "hidden";
		document.documentElement.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = previousBodyOverflow;
			document.documentElement.style.overflow = previousDocumentOverflow;
		};
	});
</script>

<svelte:window
	onkeydown={(e) => {
		if (open && e.key === "Escape") onclose();
	}}
/>

{#if open}
	<div
		class="fixed inset-0 z-50 flex overscroll-none items-center justify-center overflow-hidden bg-slate-950/80 px-2 py-4 backdrop-blur-sm"
		role="presentation"
	>
		<div
			class="flex max-h-[88dvh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-cyan-300/30 bg-[#0a0f1c] shadow-[0_0_40px_rgba(34,211,238,0.16)]"
			role="dialog"
			aria-modal="true"
			aria-label={title}
			tabindex="-1"
		>
			<div
				class="flex items-start justify-between gap-3 border-b border-slate-800 p-4"
			>
				<div class="flex min-w-0 items-center gap-3">
					<div
						class="rounded-xl border border-cyan-300/20 bg-cyan-300/10 p-2.5 text-cyan-200"
					>
						<Scale class="h-5 w-5" aria-hidden="true" />
					</div>
					<div class="min-w-0">
						<p
							class="text-[10px] font-bold uppercase tracking-widest text-cyan-300"
						>
							{title}
						</p>
						{#if subtitle}
							<h2
								class="font-display mt-0.5 break-words text-lg font-extrabold uppercase leading-tight text-slate-100"
							>
								{subtitle}
							</h2>
						{/if}
					</div>
				</div>
				<button
					type="button"
					class="btn btn-ghost btn-sm shrink-0"
					aria-label="Tutup syarat dan ketentuan"
					onclick={onclose}
				>
					<X class="h-4 w-4" aria-hidden="true" />
				</button>
			</div>
			<div
				class="min-h-0 overflow-y-auto overscroll-contain p-4 [touch-action:pan-y]"
			>
				{#each blocks as block}
					{#if block.kind === "h2"}
						<h3
							class="font-display mt-4 text-sm font-bold uppercase tracking-wider text-cyan-200 first:mt-0"
						>
							{block.text}
						</h3>
					{:else if block.kind === "h3"}
						<h4
							class="mt-3 text-sm font-bold uppercase tracking-wider text-slate-100"
						>
							{block.text}
						</h4>
					{:else if block.kind === "p"}
						<p class="mt-2 text-sm leading-relaxed text-slate-300">
							{#each inlineNodes(block.text ?? "") as node (node.text + node.kind + (node.href ?? ""))}
								{#if node.kind === "bold"}
									<strong class="font-semibold text-slate-100"
										>{node.text}</strong
									>
								{:else if node.kind === "link"}
									<a
										class="text-cyan-300 underline underline-offset-2 hover:text-cyan-200"
										href={node.href}
										target="_blank"
										rel="noreferrer"
										>{node.text}</a
									>
								{:else}
									{node.text}
								{/if}
							{/each}
						</p>
					{:else}
						<ol
							class:list-disc={!block.ordered}
							class:list-decimal={block.ordered}
							class="mt-2 space-y-2 pl-5 text-sm leading-relaxed text-slate-300"
						>
							{#each block.items ?? [] as item (item)}
								<li class="pl-1">
									{#each inlineNodes(item) as node (node.text + node.kind + (node.href ?? ""))}
										{#if node.kind === "bold"}
											<strong
												class="font-semibold text-slate-100"
												>{node.text}</strong
											>
										{:else if node.kind === "link"}
											<a
												class="text-cyan-300 underline underline-offset-2 hover:text-cyan-200"
												href={node.href}
												target="_blank"
												rel="noreferrer"
												>{node.text}</a
											>
										{:else}
											{node.text}
										{/if}
									{/each}
								</li>
							{/each}
						</ol>
					{/if}
				{/each}
			</div>
		</div>
	</div>
{/if}
