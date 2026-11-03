import { fail } from '@sveltejs/kit';
import { forgetGuildRoles } from '#bot/db/member-roles.ts';
import { getGuildSettings, updateGuildSettings } from '#bot/db/guild-settings.ts';
import { fetchRoleOptions } from '#lib/server/discord.js';
import { joinedGuild } from '#lib/server/guilds.js';
import type { Actions, PageServerLoad } from './$types';

const restoreSettings = ['restoreRoles', 'restoreKicked', 'restoreBanned'] as const;

export const load: PageServerLoad = async (event) => {
	const guild = await joinedGuild(event, event.params.guild);
	const settings = getGuildSettings(guild.id);
	return {
		restoreRoles: settings.restoreRoles,
		restoreKicked: settings.restoreKicked,
		restoreBanned: settings.restoreBanned,
		joinRoleId: settings.joinRoleId,
		...(await fetchRoleOptions(guild.id))
	};
};

// Every action re-checks access: form posts do not go through the page's load.
export const actions: Actions = {
	joinRole: async (event) => {
		const guild = await joinedGuild(event, event.params.guild);
		const form = await event.request.formData();
		const roleId = String(form.get('role') ?? '');
		if (!roleId) {
			updateGuildSettings(guild.id, { joinRoleId: null });
			return { saved: true };
		}
		const role = (await fetchRoleOptions(guild.id)).roles.find((option) => option.id === roleId);
		if (!role) return fail(400, { message: 'That role no longer exists.' });
		if (role.blocked) return fail(400, { message: `Golem can't give that role: ${role.blocked}.` });
		updateGuildSettings(guild.id, { joinRoleId: roleId });
		return { saved: true };
	},
	// The switches only send a value while they are on.
	restore: async (event) => {
		const guild = await joinedGuild(event, event.params.guild);
		const form = await event.request.formData();
		const setting = restoreSettings.find((name) => name === form.get('setting'));
		if (!setting) return fail(400, { message: 'Unknown setting.' });
		const enabled = form.has('enabled');
		updateGuildSettings(guild.id, { [setting]: enabled });
		// Roles are only kept while the setting is on.
		if (setting === 'restoreRoles' && !enabled) forgetGuildRoles(guild.id);
	}
};
