import { fail } from '@sveltejs/kit';
import { getWelcome, updateWelcome } from '#bot/db/welcome.ts';
import { MAX_WELCOME_LENGTH, welcomeVariables } from '#bot/lib/welcome.ts';
import { joinedGuild } from '#lib/server/guilds.js';
import { logChannelOptions } from '#lib/server/logging.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const guild = await joinedGuild(event, event.params.guild);
	return {
		welcome: {
			...getWelcome(guild.id),
			channels: await logChannelOptions(guild.id),
			variables: welcomeVariables,
			maxLength: MAX_WELCOME_LENGTH
		}
	};
};

// Every action re-checks access: form posts do not go through the page's load.
export const actions: Actions = {
	// The switch only sends a value while it is on.
	enabled: async (event) => {
		const guild = await joinedGuild(event, event.params.guild);
		const form = await event.request.formData();
		const enabled = form.has('enabled');
		if (enabled && !getWelcome(guild.id).channelId) {
			return fail(400, { message: 'Pick a channel and save before turning welcome messages on.' });
		}
		updateWelcome(guild.id, { enabled });
	},
	pings: async (event) => {
		const guild = await joinedGuild(event, event.params.guild);
		const form = await event.request.formData();
		updateWelcome(guild.id, { pingMentions: form.has('enabled') });
	},
	save: async (event) => {
		const guild = await joinedGuild(event, event.params.guild);
		const form = await event.request.formData();
		const channelId = String(form.get('channel') ?? '');
		// Browsers send line breaks in a textarea as \r\n.
		const message = String(form.get('message') ?? '')
			.replaceAll('\r\n', '\n')
			.trim();
		const channels = await logChannelOptions(guild.id);
		if (!channels.some((channel) => channel.id === channelId)) {
			return fail(400, { message: 'Pick a channel to post in.' });
		}
		if (!message) return fail(400, { message: 'Write a message.' });
		if (message.length > MAX_WELCOME_LENGTH) {
			return fail(400, { message: `Keep the message under ${MAX_WELCOME_LENGTH} characters.` });
		}
		updateWelcome(guild.id, { channelId, message });
		return { saved: true };
	}
};
