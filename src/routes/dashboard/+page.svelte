<script lang="ts">
	import { resolve } from '$app/paths';
	import GuildIcon from '#lib/components/guild-icon.svelte';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Card from '#lib/components/ui/card/index.js';
	import ChevronRight from '@tabler/icons-svelte/icons/chevron-right';
	import Plus from '@tabler/icons-svelte/icons/plus';

	let { data } = $props();
</script>

<svelte:head>
	<title>Dashboard · Golem</title>
</svelte:head>

<div class="flex flex-col gap-2">
	<h1 class="font-heading text-2xl font-semibold tracking-tight">Your servers</h1>
	<p class="text-sm/relaxed text-muted-foreground">
		Servers where you own the server or have Manage Server. Add Golem to one to configure it here.
	</p>
</div>

{#if data.guilds.length === 0}
	<Card.Root class="mt-8">
		<Card.Header>
			<Card.Title>No servers to manage</Card.Title>
			<Card.Description>
				You need to own a server or have the Manage Server permission in it before you can add
				Golem.
			</Card.Description>
		</Card.Header>
	</Card.Root>
{:else}
	<ul class="mt-8 grid gap-3 sm:grid-cols-2">
		{#each data.guilds as guild (guild.id)}
			<li>
				{#if guild.joinedAt}
					<a
						href={resolve(`dashboard/${guild.id}/`)}
						class="group flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-muted/50"
					>
						<GuildIcon name={guild.name} iconUrl={guild.iconUrl} />
						<div class="flex min-w-0 flex-1 flex-col gap-0.5">
							<span class="truncate text-sm font-medium">{guild.name}</span>
							<span class="text-xs text-muted-foreground">Added {guild.joinedAt}</span>
						</div>
						<ChevronRight
							class="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
						/>
					</a>
				{:else}
					<div class="flex items-center gap-3 rounded-lg border border-dashed p-3">
						<GuildIcon name={guild.name} iconUrl={guild.iconUrl} class="opacity-70" />
						<div class="flex min-w-0 flex-1 flex-col gap-0.5">
							<span class="truncate text-sm font-medium">{guild.name}</span>
							<Badge variant="outline" class="w-fit">Not added</Badge>
						</div>
						<Button href={guild.invite} target="_blank" rel="noreferrer" variant="outline">
							<Plus data-icon="inline-start" />
							Add Golem
						</Button>
					</div>
				{/if}
			</li>
		{/each}
	</ul>
{/if}
