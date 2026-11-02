import {
	ApplicationIntegrationType,
	InteractionContextType,
	SlashCommandBuilder
} from 'discord.js';
import type { Command } from '../lib/command.ts';
import { replyLevel, scopeOf } from '../lib/leveling.ts';

export const command = {
	data: new SlashCommandBuilder()
		.setName('level')
		.setDescription('Show your level card for this server, or your global level in a DM.')
		.setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
		.setContexts(InteractionContextType.Guild, InteractionContextType.BotDM),
	async execute(interaction) {
		await replyLevel(interaction, scopeOf(interaction));
	}
} satisfies Command;
