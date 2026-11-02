import {
	ApplicationIntegrationType,
	InteractionContextType,
	SlashCommandBuilder,
	userMention
} from 'discord.js';
import { inviterLeaderboard } from '../db/invite-joins.ts';
import type { Command } from '../lib/command.ts';

// The same leaderboard as Top inviters on the dashboard's Analytics page.
const SHOWN = 10;

export const command = {
	data: new SlashCommandBuilder()
		.setName('topinviters')
		.setDescription('Show who has invited the most members who are still here.')
		.setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
		.setContexts(InteractionContextType.Guild),
	async execute(interaction) {
		if (!interaction.inCachedGuild()) return;
		const leaderboard = inviterLeaderboard(interaction.guildId);
		if (leaderboard.length === 0) {
			await interaction.reply(
				'No invites are tracked here yet. Golem tracks them while "Show who invited the member" is on in the logs or the welcome message uses {inviter}, {invitername} or {invitecount}.'
			);
			return;
		}
		const line = (entry: (typeof leaderboard)[number]) =>
			`**${entry.rank}.** ${userMention(entry.inviterId)} · ${entry.invites} ${entry.invites === 1 ? 'member' : 'members'}`;
		const lines = leaderboard.slice(0, SHOWN).map(line);
		const own = leaderboard.find((entry) => entry.inviterId === interaction.user.id);
		if (own && !leaderboard.slice(0, SHOWN).includes(own)) lines.push('', `You: ${line(own)}`);
		// Mentions show names without pinging anyone; the client's default allows none.
		await interaction.reply(`**Top inviters**\n${lines.join('\n')}`);
	}
} satisfies Command;
