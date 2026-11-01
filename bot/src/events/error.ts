import { Events } from 'discord.js';
import type { Event } from '../lib/event.ts';

// Without a listener, Node throws on an emitted 'error' and the process exits.
export const event = {
	name: Events.Error,
	execute(error) {
		console.error('Discord client error.', error);
	}
} satisfies Event<typeof Events.Error>;
