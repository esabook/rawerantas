<script lang="ts">
	import { page } from "$app/state";
	import DaftarFlow from "$lib/components/DaftarFlow.svelte";
</script>

<DaftarFlow lockedSlug={page.params.slug} />
