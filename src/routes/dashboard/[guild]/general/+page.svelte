<script lang="ts">
	import SettingSwitch from '#lib/components/setting-switch.svelte';
	import * as Card from '#lib/components/ui/card/index.js';

	let { data, form } = $props();
</script>

<div class="flex flex-col gap-1">
	<h1 class="font-heading text-2xl font-semibold tracking-tight">General</h1>
	<p class="text-sm/relaxed text-muted-foreground">
		Settings for how Golem treats your members. Everything here is off until you turn it on, so
		Discord behaves as usual.
	</p>
</div>
{#if form?.message}
	<p class="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive" role="alert">
		{form.message}
	</p>
{/if}
<Card.Root>
	<Card.Content class="flex flex-col gap-4">
		<SettingSwitch
			action="?/restore"
			id="restore-roles"
			fields={{ setting: 'restoreRoles' }}
			checked={data.restoreRoles}
			label="Restore roles on rejoin"
			description="Members who leave and come back get their roles back. Golem needs Manage Roles and can only give roles below its own highest role. Roles are remembered from a few minutes after you turn this on, and forgotten when you turn it off."
		/>
		<div class="flex flex-col gap-4 border-t pt-4">
			<SettingSwitch
				action="?/restore"
				id="restore-kicked"
				fields={{ setting: 'restoreKicked' }}
				checked={data.restoreKicked}
				disabled={!data.restoreRoles}
				label="Include kicked members"
				description="Also give roles back to members who were kicked. Golem needs View Audit Log to tell a kick from someone leaving; without it, nobody gets roles back unless this is on."
			/>
			<SettingSwitch
				action="?/restore"
				id="restore-banned"
				fields={{ setting: 'restoreBanned' }}
				checked={data.restoreBanned}
				disabled={!data.restoreRoles}
				label="Include banned members"
				description="Also give roles back to members who were banned, once they are unbanned and rejoin."
			/>
		</div>
	</Card.Content>
</Card.Root>
