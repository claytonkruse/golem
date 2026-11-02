import { fail } from '@sveltejs/kit';
import { addLogChannel, logSettings, removeLogChannel } from '#bot/db/log-channels.ts';
import { logOptionSettings, setLogOption } from '#bot/db/log-options.ts';
import {
	isLogEventKey,
	isLogOption,
	logEventOptions,
	logEvents,
	logGroups
} from '#bot/lib/log-events.ts';
import { joinedGuild } from '#lib/server/guilds.js';
import { logChannelOptions } from '#lib/server/logging.js';
import type { Actions, PageServerLoad, RequestEvent } from './$types';

export const load: PageServerLoad = async (event) => {
	const guild = await joinedGuild(event, event.params.guild);
	return {
		logging: {
			groups: logGroups,
			events: logEvents,
			channels: await logChannelOptions(guild.id),
			settings: Object.fromEntries(logSettings(guild.id)),
			options: logEventOptions,
			enabledOptions: logOptionSettings(guild.id)
		}
	};
};

// Every action re-checks access: form posts do not go through the page's load.
async function readForm(event: RequestEvent) {
	const guild = await joinedGuild(event, event.params.guild);
	const form = await event.request.formData();
	const logEvent = String(form.get('event') ?? '');
	const channelId = String(form.get('channel') ?? '');
	if (!isLogEventKey(logEvent)) return { failure: fail(400, { message: 'Unknown event.' }) };
	if (!channelId) return { failure: fail(400, { message: 'Pick a channel.' }) };
	return { guild, logEvent, channelId };
}

export const actions: Actions = {
	add: async (event) => {
		const form = await readForm(event);
		if ('failure' in form) return form.failure;
		const channels = await logChannelOptions(form.guild.id);
		if (!channels.some((channel) => channel.id === form.channelId)) {
			return fail(400, { message: 'That channel cannot receive logs.' });
		}
		addLogChannel(form.guild.id, [form.logEvent], form.channelId);
	},
	// Removal skips the channel check so a deleted channel can still be cleared.
	remove: async (event) => {
		const form = await readForm(event);
		if ('failure' in form) return form.failure;
		removeLogChannel(form.guild.id, [form.logEvent], form.channelId);
	},
	option: async (event) => {
		const guild = await joinedGuild(event, event.params.guild);
		const form = await event.request.formData();
		const logEvent = String(form.get('event') ?? '');
		const option = String(form.get('option') ?? '');
		if (!isLogEventKey(logEvent) || !isLogOption(logEvent, option)) {
			return fail(400, { message: 'Unknown setting.' });
		}
		// The switch only sends a value while it is on.
		setLogOption(guild.id, logEvent, option, form.has('enabled'));
	}
};
