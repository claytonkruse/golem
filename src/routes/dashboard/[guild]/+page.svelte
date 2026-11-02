<script lang="ts">
	import GuildIcon from '#lib/components/guild-icon.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Card from '#lib/components/ui/card/index.js';
	import Plus from '@tabler/icons-svelte/icons/plus';

	let { data } = $props();
</script>

<div class="flex items-center gap-4">
	<GuildIcon name={data.guild.name} iconUrl={data.guild.iconUrl} class="size-14 text-sm" />
	<h1 class="truncate font-heading text-2xl font-semibold tracking-tight">{data.guild.name}</h1>
</div>

<Card.Root>
	<Card.Header>
		<Card.Title>Add Golem first</Card.Title>
		<Card.Description
			>Once Golem is in {data.guild.name}, its settings will show up here.</Card.Description
		>
	</Card.Header>
	<Card.Footer>
		<Button href={data.guild.invite} target="_blank" rel="noreferrer">
			<Plus data-icon="inline-start" />
			Add Golem
		</Button>
	</Card.Footer>
</Card.Root>
