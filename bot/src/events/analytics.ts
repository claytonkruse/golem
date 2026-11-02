import { Events, type Guild } from 'discord.js';
import { recordMemberEvent, recordMessage } from '../db/analytics.ts';
import { addGuilds } from '../db/guilds.ts';
import type { Event } from '../lib/event.ts';

// Records joins, leaves and messages for the dashboard's analytics, in every server whether
// or not anyone looks at them. Apps, webhooks and system messages aren't counted.

// Rows reference the server's row, which may be missing if Golem joined while offline.
// Checked once per server per run.
const knownGuilds = new Set<string>();

function ensureGuild(guild: Guild): void {
	if (knownGuilds.has(guild.id)) return;
	addGuilds([{ id: guild.id, joinedAt: guild.joinedAt }]);
	knownGuilds.add(guild.id);
}

export const events = [
	{
		name: Events.GuildMemberAdd,
		execute(member) {
			if (member.user.bot) return;
			ensureGuild(member.guild);
			recordMemberEvent(member.guild.id, member.id, 'join');
		}
	} satisfies Event<typeof Events.GuildMemberAdd>,

	{
		name: Events.GuildMemberRemove,
		execute(member) {
			// Golem itself leaving is handled by GuildDelete, which deletes the server's rows.
			if (member.user.bot || member.id === member.client.user.id) return;
			ensureGuild(member.guild);
			recordMemberEvent(member.guild.id, member.id, 'leave');
		}
	} satisfies Event<typeof Events.GuildMemberRemove>,

	{
		name: Events.MessageCreate,
		execute(message) {
			if (!message.inGuild() || message.author.bot || message.webhookId || message.system) return;
			ensureGuild(message.guild);
			recordMessage(message.guild.id, message.author.id);
		}
	} satisfies Event<typeof Events.MessageCreate>
];
