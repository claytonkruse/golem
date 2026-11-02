import {
	ApplicationIntegrationType,
	InteractionContextType,
	SlashCommandBuilder
} from 'discord.js';
import type { Command } from '../lib/command.ts';
import { replyLeaderboard, turnLeaderboardPage } from '../lib/leaderboard.ts';

export const command = {
	data: new SlashCommandBuilder()
		.setName('leaderboard')
		.setDescription("Show this server's top members by XP, or the global board in a DM.")
		.setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
		.setContexts(InteractionContextType.Guild, InteractionContextType.BotDM),
	async execute(interaction) {
		await replyLeaderboard(interaction, 'server');
	},
	// Both leaderboards page with "leaderboard:" buttons.
	async button(interaction) {
		await turnLeaderboardPage(interaction);
	}
} satisfies Command;
