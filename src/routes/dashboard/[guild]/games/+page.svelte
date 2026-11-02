<script lang="ts">
	import SettingSwitch from '#lib/components/setting-switch.svelte';
	import * as Card from '#lib/components/ui/card/index.js';

	let { data } = $props();
</script>

<div class="flex flex-col gap-1">
	<h1 class="font-heading text-2xl font-semibold tracking-tight">Games</h1>
	<p class="text-sm/relaxed text-muted-foreground">
		Off until you turn them on. Then choose which games members can start here. Games in DMs with
		Golem aren't affected.
	</p>
</div>
<Card.Root>
	<Card.Content class="flex flex-col gap-4">
		<SettingSwitch
			action="?/games"
			id="games-enabled"
			checked={data.games.enabled}
			label="Enable games"
			description="Lets members start Golem's games in this server."
		/>
		<div class="flex flex-col gap-4 border-t pt-4">
			{#each data.games.list as game (game.key)}
				<SettingSwitch
					action="?/game"
					id="game-{game.key}"
					fields={{ game: game.key }}
					checked={data.games.switches[game.key]}
					disabled={!data.games.enabled}
					label={game.label}
					description={game.description}
				/>
			{/each}
		</div>
	</Card.Content>
</Card.Root>
