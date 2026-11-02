import { Events, type Client } from 'discord.js';
import { guildsWithLogOption } from '../db/log-options.ts';
import { guildsWithWelcomeInvites } from '../db/welcome.ts';
import type { Event } from '../lib/event.ts';
import { forgetInvites, primeInvites } from '../lib/invites.ts';

const PRIME_EVERY_MS = 5 * 60 * 1000;
const primed = new Set<string>();

// Reads invite counts for servers that turned "Show who invited them" on or use {inviter}
// or {invitecount} in their welcome message, so their next join can be traced. Re-checked
// periodically because the dashboard can turn these on while Golem is running.
async function primeEnabled(client: Client<true>): Promise<void> {
	const enabled = new Set([
		...guildsWithLogOption('member_join', 'show_inviter'),
		...guildsWithWelcomeInvites()
	]);
	for (const id of primed) {
		if (!enabled.has(id)) {
			primed.delete(id);
			forgetInvites(id);
		}
	}
	for (const id of enabled) {
		const guild = client.guilds.cache.get(id);
		if (!guild || primed.has(id)) continue;
		await primeInvites(guild);
		primed.add(id);
	}
}

export const events = [
	{
		name: Events.ClientReady,
		once: true,
		async execute(client) {
			await primeEnabled(client);
			setInterval(() => {
				primeEnabled(client).catch((error: unknown) => {
					console.error('Could not refresh invite tracking.', error);
				});
			}, PRIME_EVERY_MS).unref();
		}
	} satisfies Event<typeof Events.ClientReady>,

	{
		name: Events.GuildDelete,
		execute(guild) {
			primed.delete(guild.id);
			forgetInvites(guild.id);
		}
	} satisfies Event<typeof Events.GuildDelete>
];
