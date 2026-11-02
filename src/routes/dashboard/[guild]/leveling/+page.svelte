<script lang="ts">
	import SettingSwitch from '#lib/components/setting-switch.svelte';
	import * as Card from '#lib/components/ui/card/index.js';

	let { data } = $props();
</script>

<div class="flex flex-col gap-1">
	<h1 class="font-heading text-2xl font-semibold tracking-tight">Leveling</h1>
	<p class="text-sm/relaxed text-muted-foreground">
		Members always earn XP for chatting and using Golem's commands, at most once a minute. These
		switches only decide which leveling commands can be used here; DMs with Golem aren't affected.
	</p>
</div>
<Card.Root>
	<Card.Content class="flex flex-col gap-4">
		<SettingSwitch
			action="?/commands"
			id="level-commands"
			checked={data.enabled}
			label="Enable leveling commands"
			description="Off until you turn it on. Lets members check their level and rank here."
		/>
		<div class="flex flex-col gap-4 border-t pt-4">
			{#each data.commands as command (command.key)}
				<SettingSwitch
					action="?/command"
					id="level-command-{command.key}"
					fields={{ command: command.key }}
					checked={data.switches[command.key]}
					disabled={!data.enabled}
					label={command.label}
					description={command.description}
				/>
			{/each}
		</div>
	</Card.Content>
</Card.Root>
<Card.Root>
	<Card.Content>
		<SettingSwitch
			action="?/inviterXp"
			id="inviter-xp"
			checked={data.inviterXp}
			label="Reward inviters with XP"
			description="When a member earns XP here, whoever invited the member gets an extra 10% of it, rounded, in both this server's levels and global levels, without the member losing any. Only invites Golem tracked count, and only while the inviter is still in the server. On by default."
		/>
	</Card.Content>
</Card.Root>
{#if data.commandXp !== null}
	<Card.Root>
		<Card.Content>
			<SettingSwitch
				action="?/settings"
				id="command-xp"
				checked={data.commandXp}
				label="Count slash commands toward levels"
				description="Using Golem's commands here earns XP, sharing the once-a-minute limit with messages. Turning this off only affects this server's levels; commands still count toward global levels."
			/>
		</Card.Content>
	</Card.Root>
{/if}
