import { fail } from '@sveltejs/kit';
import { gameSwitches, setGameEnabled } from '#bot/db/guild-games.ts';
import { getGuildSettings, updateGuildSettings } from '#bot/db/guild-settings.ts';
import { games, isGameKey } from '#bot/lib/games.ts';
import { joinedGuild } from '#lib/server/guilds.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const guild = await joinedGuild(event, event.params.guild);
	return {
		games: {
			enabled: getGuildSettings(guild.id).gamesEnabled,
			list: games,
			switches: gameSwitches(guild.id)
		}
	};
};

// The switches only send a value while they are on.
export const actions: Actions = {
	games: async (event) => {
		const guild = await joinedGuild(event, event.params.guild);
		const form = await event.request.formData();
		updateGuildSettings(guild.id, { gamesEnabled: form.has('enabled') });
	},
	game: async (event) => {
		const guild = await joinedGuild(event, event.params.guild);
		const form = await event.request.formData();
		const game = String(form.get('game') ?? '');
		if (!isGameKey(game)) return fail(400, { message: 'Unknown game.' });
		setGameEnabled(guild.id, game, form.has('enabled'));
	}
};
