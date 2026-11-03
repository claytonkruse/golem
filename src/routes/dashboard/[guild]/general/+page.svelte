<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '#lib/components/ui/button/index.js';
	import SettingSwitch from '#lib/components/setting-switch.svelte';
	import * as Card from '#lib/components/ui/card/index.js';

	let { data, form } = $props();

	let saving = $state(false);
	const savedRole = $derived(data.roles.find((role) => role.id === data.joinRoleId));
</script>

<div class="flex flex-col gap-1">
	<h1 class="font-heading text-2xl font-semibold tracking-tight">General</h1>
	<p class="text-sm/relaxed text-muted-foreground">
		Settings for how Golem treats your members. Everything here is off until you turn it on, so
		Discord behaves as usual.
	</p>
</div>
{#if form?.saved}
	<p class="rounded-md bg-secondary px-3 py-2 text-xs text-secondary-foreground" role="status">
		Saved.
	</p>
{/if}
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

<Card.Root>
	<Card.Header>
		<Card.Title>Join role</Card.Title>
		<Card.Description>
			Give everyone who joins a role. Apps aren't given it, and members who still have to accept the
			server's rules get it once they do.
		</Card.Description>
	</Card.Header>
	<Card.Content class="flex flex-col gap-3">
		{#if !data.canManageRoles}
			<p class="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive" role="alert">
				Golem doesn't have the Manage Roles permission here, so it can't give any role yet.
			</p>
		{:else if savedRole?.blocked}
			<p class="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive" role="alert">
				Golem can't give {savedRole.name} right now: {savedRole.blocked.toLowerCase()}.
			</p>
		{/if}
		<form
			method="POST"
			action="?/joinRole"
			class="flex flex-wrap items-end gap-2"
			use:enhance={() => {
				saving = true;
				return async ({ update }) => {
					await update({ reset: false });
					saving = false;
				};
			}}
		>
			<label class="flex min-w-48 flex-col gap-1.5 text-xs font-medium">
				Role
				<select
					name="role"
					value={data.joinRoleId ?? ''}
					class="h-7 w-full min-w-0 rounded-md border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 dark:bg-input/30"
				>
					<option value="">None</option>
					{#each data.roles as role (role.id)}
						<option value={role.id} disabled={role.blocked !== null && role.id !== data.joinRoleId}>
							@{role.name}{role.blocked ? ` (${role.blocked.toLowerCase()})` : ''}
						</option>
					{/each}
				</select>
			</label>
			<Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
		</form>
	</Card.Content>
</Card.Root>
