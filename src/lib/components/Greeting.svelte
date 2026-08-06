<script lang="ts">
	let { name = 'dunia' }: { name?: string } = $props();
</script>

<p class="greeting">Halo, {name}!</p>
