import {
	ApplicationIntegrationType,
	InteractionContextType,
	SlashCommandBuilder
} from 'discord.js';
import type { Command } from '../lib/command.ts';
import { replyRank } from '../lib/leveling.ts';

export const command = {
	data: new SlashCommandBuilder()
		.setName('globalrank')
		.setDescription('Show your place in the ranking across every server.')
		.setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
		.setContexts(InteractionContextType.Guild, InteractionContextType.BotDM),
	async execute(interaction) {
		await replyRank(interaction, 'global');
	}
} satisfies Command;
