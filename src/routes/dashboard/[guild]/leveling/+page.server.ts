import { error, fail } from '@sveltejs/kit';
import { levelCommandSwitches, setLevelCommandEnabled } from '#bot/db/guild-level-commands.ts';
import { getGuildSettings, updateGuildSettings } from '#bot/db/guild-settings.ts';
import { COMMAND_XP_SETTING, isLevelCommand, levelCommands } from '#bot/lib/levels.ts';
import { joinedGuild } from '#lib/server/guilds.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const guild = await joinedGuild(event, event.params.guild);
	const settings = getGuildSettings(guild.id);
	return {
		enabled: settings.levelCommands,
		commands: levelCommands,
		switches: levelCommandSwitches(guild.id),
		// The command-XP switch is hidden while COMMAND_XP_SETTING is off in bot/src/lib/levels.ts.
		commandXp: COMMAND_XP_SETTING ? settings.commandXp : null
	};
};

// The switches only send a value while they are on.
export const actions: Actions = {
	// The master switch for leveling commands.
	commands: async (event) => {
		const guild = await joinedGuild(event, event.params.guild);
		const form = await event.request.formData();
		updateGuildSettings(guild.id, { levelCommands: form.has('enabled') });
	},
	command: async (event) => {
		const guild = await joinedGuild(event, event.params.guild);
		const form = await event.request.formData();
		const command = String(form.get('command') ?? '');
		if (!isLevelCommand(command)) return fail(400, { message: 'Unknown command.' });
		setLevelCommandEnabled(guild.id, command, form.has('enabled'));
	},
	settings: async (event) => {
		if (!COMMAND_XP_SETTING) error(404, 'Not found');
		const guild = await joinedGuild(event, event.params.guild);
		const form = await event.request.formData();
		updateGuildSettings(guild.id, { commandXp: form.has('enabled') });
	}
};
