import { Events, type Guild } from 'discord.js';
import { addGuilds } from '../db/guilds.ts';
import { getGuildSettings } from '../db/guild-settings.ts';
import { getInviteJoin } from '../db/invite-joins.ts';
import { addMemberXp, addUserXp, awardMemberXp, awardUserXp } from '../db/xp.ts';
import type { Event } from '../lib/event.ts';
import { COMMAND_XP_SETTING, INVITER_XP_SHARE, randomXp, XP_COOLDOWN_MS } from '../lib/levels.ts';

// XP rows reference the server's row, which may be missing if Golem joined while
// offline. Checked once per server per run.
const knownGuilds = new Set<string>();

// Messages and commands share one cooldown, so mixing them earns no more than either.
// Server and global amounts are rolled separately, so the totals drift apart a little.
async function award(guild: Guild, userId: string, { server }: { server: boolean }): Promise<void> {
	const globalAmount = randomXp();
	const earned = {
		global: awardUserXp(userId, globalAmount, XP_COOLDOWN_MS) ? globalAmount : 0,
		server: 0
	};
	if (server) {
		if (!knownGuilds.has(guild.id)) {
			addGuilds([{ id: guild.id, joinedAt: guild.joinedAt }]);
			knownGuilds.add(guild.id);
		}
		const amount = randomXp();
		if (awardMemberXp(guild.id, userId, amount, XP_COOLDOWN_MS)) earned.server = amount;
	}
	if (earned.global > 0 || earned.server > 0) await rewardInviter(guild, userId, earned);
}

// The member's inviter in this server gets a share of what the member just earned, server
// and global XP each, on top of the inviter's own. Only invites Golem tracked count, and only
// while the inviter is still here. The server's switch turns off both.
async function rewardInviter(
	guild: Guild,
	userId: string,
	earned: { global: number; server: number }
): Promise<void> {
	if (!getGuildSettings(guild.id).inviterXp) return;
	const inviterId = getInviteJoin(guild.id, userId)?.inviterId;
	if (!inviterId || inviterId === userId) return;
	const inviter = await guild.members.fetch(inviterId).catch(() => null);
	if (!inviter || inviter.user.bot) return;
	const serverShare = Math.round(earned.server * INVITER_XP_SHARE);
	if (serverShare > 0) addMemberXp(guild.id, inviterId, serverShare);
	const globalShare = Math.round(earned.global * INVITER_XP_SHARE);
	if (globalShare > 0) addUserXp(inviterId, globalShare);
}

export const events = [
	{
		name: Events.MessageCreate,
		execute(message) {
			// Only people chatting in servers earn XP: not bots, webhooks, "X joined" notices or DMs.
			if (!message.inGuild() || message.author.bot || message.webhookId || message.system) return;
			return award(message.guild, message.author.id, { server: true });
		}
	} satisfies Event<typeof Events.MessageCreate>,

	{
		name: Events.InteractionCreate,
		execute(interaction) {
			// Golem's slash commands in a server. Servers can turn off command XP for themselves
			// only while COMMAND_XP_SETTING is on; global XP counts commands either way.
			if (!interaction.isChatInputCommand() || !interaction.inCachedGuild()) return;
			const server = COMMAND_XP_SETTING ? getGuildSettings(interaction.guildId).commandXp : true;
			return award(interaction.guild, interaction.user.id, { server });
		}
	} satisfies Event<typeof Events.InteractionCreate>
];
