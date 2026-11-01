<script lang="ts">
	import { resolve } from '$app/paths';
	import GuildIcon from '#lib/components/guild-icon.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Card from '#lib/components/ui/card/index.js';
	import ArrowLeft from '@tabler/icons-svelte/icons/arrow-left';
	import Plus from '@tabler/icons-svelte/icons/plus';

	let { data } = $props();
</script>

<svelte:head>
	<title>{data.guild.name} · Golem</title>
</svelte:head>

<Button href={resolve('dashboard/')} variant="ghost" class="-ml-2">
	<ArrowLeft data-icon="inline-start" />
	All servers
</Button>

<div class="mt-6 flex items-center gap-4">
	<GuildIcon name={data.guild.name} iconUrl={data.guild.iconUrl} class="size-14 text-sm" />
	<div class="flex min-w-0 flex-col gap-1">
		<h1 class="truncate font-heading text-2xl font-semibold tracking-tight">{data.guild.name}</h1>
		<p class="text-sm text-muted-foreground">
			{data.guild.joinedAt ? `Golem joined ${data.guild.joinedAt}` : 'Golem is not in this server.'}
		</p>
	</div>
</div>

{#if data.guild.joinedAt}
	<Card.Root class="mt-8">
		<Card.Header>
			<Card.Title>Settings</Card.Title>
			<Card.Description>
				Nothing to configure yet. Settings for this server will appear here as commands that need
				them are added.
			</Card.Description>
		</Card.Header>
	</Card.Root>
{:else}
	<Card.Root class="mt-8">
		<Card.Header>
			<Card.Title>Add Golem first</Card.Title>
			<Card.Description>
				Once Golem is in {data.guild.name}, its settings will show up here.
			</Card.Description>
		</Card.Header>
		<Card.Footer>
			<Button href={data.guild.invite} target="_blank" rel="noreferrer">
				<Plus data-icon="inline-start" />
				Add Golem
			</Button>
		</Card.Footer>
	</Card.Root>
{/if}
