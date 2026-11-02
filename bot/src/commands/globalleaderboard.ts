import {
	ApplicationIntegrationType,
	InteractionContextType,
	SlashCommandBuilder
} from 'discord.js';
import type { Command } from '../lib/command.ts';
import { replyLeaderboard } from '../lib/leaderboard.ts';

export const command = {
	data: new SlashCommandBuilder()
		.setName('globalleaderboard')
		.setDescription('Show the top members by XP across every server.')
		.setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
		.setContexts(InteractionContextType.Guild, InteractionContextType.BotDM),
	async execute(interaction) {
		await replyLeaderboard(interaction, 'global');
	}
} satisfies Command;
