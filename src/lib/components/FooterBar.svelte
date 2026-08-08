<script lang="ts">
	import { Trophy } from "@lucide/svelte";
	import { env } from "$lib/env";
</script>

<footer
	class="border-t border-slate-800 bg-[#05070d]"
	aria-label="Footer arena"
>
	<div
		class="flex min-w-0 w-full flex-col items-center gap-2 px-4 py-5 text-center text-xs text-slate-500 sm:px-4 lg:px-8"
	>
		<a
			href="/"
			class="inline-flex items-center gap-2 font-display font-bold uppercase tracking-wider text-slate-200 transition-colors hover:text-cyan-200"
		>
			<Trophy class="h-4 w-4 text-cyan-300" aria-hidden="true" />
			{env.appName || "Arena Lomba"}
		</a>
		<span>© {env.appYear} · Arena warga</span>
	</div>
</footer>
