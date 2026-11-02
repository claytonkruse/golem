import { fail } from '@sveltejs/kit';
import { forgetGuildRoles } from '#bot/db/member-roles.ts';
import { getGuildSettings, updateGuildSettings } from '#bot/db/guild-settings.ts';
import { joinedGuild } from '#lib/server/guilds.js';
import type { Actions, PageServerLoad } from './$types';

const restoreSettings = ['restoreRoles', 'restoreKicked', 'restoreBanned'] as const;

export const load: PageServerLoad = async (event) => {
	const guild = await joinedGuild(event, event.params.guild);
	const settings = getGuildSettings(guild.id);
	return {
		restoreRoles: settings.restoreRoles,
		restoreKicked: settings.restoreKicked,
		restoreBanned: settings.restoreBanned
	};
};

// Every action re-checks access: form posts do not go through the page's load.
export const actions: Actions = {
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
