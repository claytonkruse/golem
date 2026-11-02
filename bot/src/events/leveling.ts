import { Events, type Guild } from 'discord.js';
import { addGuilds } from '../db/guilds.ts';
import { getGuildSettings } from '../db/guild-settings.ts';
import { awardMemberXp, awardUserXp } from '../db/xp.ts';
import type { Event } from '../lib/event.ts';
import { COMMAND_XP_SETTING, randomXp, XP_COOLDOWN_MS } from '../lib/levels.ts';

// XP rows reference the server's row, which may be missing if Golem joined while
// offline. Checked once per server per run.
const knownGuilds = new Set<string>();

// Messages and commands share one cooldown, so mixing them earns no more than either.
// Server and global amounts are rolled separately, so the totals drift apart a little.
function award(guild: Guild, userId: string, { server }: { server: boolean }): void {
	if (server) {
		if (!knownGuilds.has(guild.id)) {
			addGuilds([{ id: guild.id, joinedAt: guild.joinedAt }]);
			knownGuilds.add(guild.id);
		}
		awardMemberXp(guild.id, userId, randomXp(), XP_COOLDOWN_MS);
	}
	awardUserXp(userId, randomXp(), XP_COOLDOWN_MS);
}

export const events = [
	{
		name: Events.MessageCreate,
		execute(message) {
			// Only people chatting in servers earn XP: not bots, webhooks, "X joined" notices or DMs.
			if (!message.inGuild() || message.author.bot || message.webhookId || message.system) return;
			award(message.guild, message.author.id, { server: true });
		}
	} satisfies Event<typeof Events.MessageCreate>,

	{
		name: Events.InteractionCreate,
		execute(interaction) {
			// Golem's slash commands in a server. Servers can turn off command XP for themselves
			// only while COMMAND_XP_SETTING is on; global XP counts commands either way.
			if (!interaction.isChatInputCommand() || !interaction.inCachedGuild()) return;
			const server = COMMAND_XP_SETTING ? getGuildSettings(interaction.guildId).commandXp : true;
			award(interaction.guild, interaction.user.id, { server });
		}
	} satisfies Event<typeof Events.InteractionCreate>
];
