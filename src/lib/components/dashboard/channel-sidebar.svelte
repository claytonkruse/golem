<script lang="ts">
	import { page } from '$app/state';
	import ServerRail from '#lib/components/dashboard/server-rail.svelte';
	import UserPanel from '#lib/components/dashboard/user-panel.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Sheet from '#lib/components/ui/sheet/index.js';
	import * as Sidebar from '#lib/components/ui/sidebar/index.js';
	import Menu2 from '@tabler/icons-svelte/icons/menu-2';
	import type Icon from '@tabler/icons-svelte/icons/list-details';
	import type { Snippet } from 'svelte';

	// The second column, like Discord's channel list: a title, a list of pages and the user
	// panel, with the page content beside it. On phones both columns slide out together.
	// Any Tabler icon; they all share one component type.
	type Section = { href: string; label: string; icon: typeof Icon };
	type Props = {
		title: string;
		subtitle?: string;
		groupLabel?: string;
		sections?: Section[];
		children: Snippet;
	};

	let { title, subtitle, groupLabel, sections = [], children }: Props = $props();
	let menuOpen = $state(false);

	const isActive = (href: string) => {
		const path = new URL(href, page.url.href).pathname;
		return page.url.pathname === path;
	};
</script>

{#snippet column()}
	<Sidebar.Header class="h-14 justify-center border-b px-4 py-0">
		<div class="flex min-w-0 flex-col">
			<span class="truncate text-sm font-semibold">{title}</span>
			{#if subtitle}
				<span class="truncate text-xs text-muted-foreground">{subtitle}</span>
			{/if}
		</div>
	</Sidebar.Header>
	<Sidebar.Content>
		{#if sections.length > 0}
			<Sidebar.Group>
				{#if groupLabel}
					<Sidebar.GroupLabel class="tracking-wide uppercase">{groupLabel}</Sidebar.GroupLabel>
				{/if}
				<Sidebar.Menu>
					{#each sections as section (section.href)}
						<Sidebar.MenuItem>
							<Sidebar.MenuButton isActive={isActive(section.href)}>
								{#snippet child({ props })}
									<!-- Section links are built with resolve() by each page. -->
									<!-- eslint-disable svelte/no-navigation-without-resolve -->
									<a
										{...props}
										href={section.href}
										aria-current={isActive(section.href) ? 'page' : undefined}
										onclick={() => (menuOpen = false)}
									>
										<section.icon />
										<span>{section.label}</span>
									</a>
									<!-- eslint-enable svelte/no-navigation-without-resolve -->
								{/snippet}
							</Sidebar.MenuButton>
						</Sidebar.MenuItem>
					{/each}
				</Sidebar.Menu>
			</Sidebar.Group>
		{/if}
	</Sidebar.Content>
	<Sidebar.Footer class="border-t p-2">
		<UserPanel />
	</Sidebar.Footer>
{/snippet}

<Sidebar.Provider class="h-svh min-h-0" style="--sidebar-width: 15rem">
	<Sidebar.Root collapsible="none" class="hidden h-svh border-r md:flex">
		{@render column()}
	</Sidebar.Root>

	<main class="flex min-w-0 flex-1 flex-col overflow-y-auto">
		<div class="flex h-14 shrink-0 items-center gap-3 border-b px-4 md:hidden">
			<Sheet.Root bind:open={menuOpen}>
				<Sheet.Trigger>
					{#snippet child({ props })}
						<Button {...props} variant="ghost" size="icon" aria-label="Open navigation">
							<Menu2 />
						</Button>
					{/snippet}
				</Sheet.Trigger>
				<Sheet.Content side="left" class="w-auto max-w-full flex-row gap-0 p-0">
					<Sheet.Title class="sr-only">Navigation</Sheet.Title>
					<ServerRail onnavigate={() => (menuOpen = false)} />
					<div class="flex w-60 flex-col bg-sidebar">{@render column()}</div>
				</Sheet.Content>
			</Sheet.Root>
			<span class="truncate text-sm font-semibold">{title}</span>
		</div>
		<div class="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-8">
			{@render children()}
		</div>
	</main>
</Sidebar.Provider>
