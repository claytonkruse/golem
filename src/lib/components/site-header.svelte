<script lang="ts">
	import { resolve } from '$app/paths';
	import golem from '#lib/assets/golem.jpg';
	import ModeToggle from '#lib/components/mode-toggle.svelte';
	import type { Snippet } from 'svelte';

	let { nav, actions }: { nav?: Snippet; actions?: Snippet } = $props();
</script>

<header class="sticky top-0 z-10 border-b border-transparent backdrop-blur-md">
	<div class="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
		<a href={resolve('/')} class="flex items-center gap-2">
			<img src={golem} alt="" width="28" height="28" class="size-7 rounded-md" />
			<span class="font-heading text-sm font-semibold tracking-tight">Golem</span>
		</a>
		<nav class="flex items-center gap-1">
			{@render nav?.()}
			<ModeToggle />
			{@render actions?.()}
		</nav>
	</div>
</header>
