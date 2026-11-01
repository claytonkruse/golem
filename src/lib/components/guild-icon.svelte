<script lang="ts">
	import { cn } from '#lib/utils.js';

	let {
		name,
		iconUrl,
		class: className
	}: { name: string; iconUrl: string | null; class?: string } = $props();

	// Discord shows the first letter of each word when a server has no icon.
	const initials = $derived(
		name
			.split(/\s+/)
			.map((word) => word[0])
			.join('')
			.slice(0, 3)
	);
</script>

{#if iconUrl}
	<img src={iconUrl} alt="" class={cn('size-10 shrink-0 rounded-xl object-cover', className)} />
{:else}
	<span
		aria-hidden="true"
		class={cn(
			'flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-xs font-medium text-muted-foreground',
			className
		)}
	>
		{initials}
	</span>
{/if}
