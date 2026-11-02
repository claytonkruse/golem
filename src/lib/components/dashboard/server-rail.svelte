<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import golem from '#lib/assets/golem.jpg';
	import * as Tooltip from '#lib/components/ui/tooltip/index.js';
	import Plus from '@tabler/icons-svelte/icons/plus';
	import type { Snippet } from 'svelte';

	// The far-left column of round server icons, like Discord's: Golem's logo for the
	// server list, then every server with Golem, then a button to add Golem to more.
	let { onnavigate }: { onnavigate?: () => void } = $props();

	type Guild = { id: string; name: string; iconUrl: string | null; joinedAt: string | null };
	const guilds = $derived(
		((page.data.guilds ?? []) as Guild[]).filter((guild) => guild.joinedAt !== null)
	);
	const activeId = $derived(page.params.guild ?? null);

	const initials = (name: string) =>
		name
			.split(/\s+/)
			.map((word) => word[0])
			.join('')
			.slice(0, 3);
</script>

{#snippet item(href: string, label: string, active: boolean, face: Snippet)}
	<Tooltip.Root>
		<Tooltip.Trigger>
			{#snippet child({ props })}
				<!-- Every caller passes a path already built with resolve(). -->
				<!-- eslint-disable svelte/no-navigation-without-resolve -->
				<a
					{...props}
					{href}
					aria-label={label}
					aria-current={active ? 'page' : undefined}
					class="group relative flex w-full justify-center"
					onclick={onnavigate}
				>
					<!-- The pill on the left edge: tall for the open server, short on hover. -->
					<span
						class={[
							'absolute top-1/2 left-0 w-1 -translate-y-1/2 rounded-r-full bg-foreground transition-all',
							active ? 'h-10' : 'h-0 group-hover:h-5'
						]}
					></span>
					<span
						class={[
							'flex size-12 items-center justify-center overflow-hidden bg-background text-sm font-medium text-muted-foreground transition-all group-hover:rounded-[14px]',
							active ? 'rounded-[14px]' : 'rounded-[24px]'
						]}
					>
						{@render face()}
					</span>
				</a>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
			{/snippet}
		</Tooltip.Trigger>
		<Tooltip.Content side="right">{label}</Tooltip.Content>
	</Tooltip.Root>
{/snippet}

<nav
	aria-label="Servers"
	class="flex h-full w-[72px] shrink-0 flex-col items-center gap-2 overflow-y-auto border-r bg-muted/60 py-3 dark:bg-background"
>
	{#snippet home()}
		<img src={golem} alt="" class="size-full object-cover" />
	{/snippet}
	{@render item(resolve('dashboard/'), 'Your servers', activeId === null, home)}

	<div class="h-0.5 w-8 shrink-0 rounded-full bg-border"></div>

	{#each guilds as guild (guild.id)}
		{#snippet face()}
			{#if guild.iconUrl}
				<img src={guild.iconUrl} alt="" class="size-full object-cover" />
			{:else}
				{initials(guild.name)}
			{/if}
		{/snippet}
		{@render item(resolve(`dashboard/${guild.id}/`), guild.name, activeId === guild.id, face)}
	{/each}

	{#snippet add()}
		<Plus class="size-5 text-emerald-600 dark:text-emerald-400" />
	{/snippet}
	{@render item(resolve('dashboard/'), 'Add Golem to a server', false, add)}
</nav>
