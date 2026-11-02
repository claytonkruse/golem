import {
	ApplicationIntegrationType,
	InteractionContextType,
	SlashCommandBuilder
} from 'discord.js';
import type { Command } from '../lib/command.ts';
import { replyRank, scopeOf } from '../lib/leveling.ts';

export const command = {
	data: new SlashCommandBuilder()
		.setName('rank')
		.setDescription("Show your place in this server's ranking, or the global one in a DM.")
		.setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
		.setContexts(InteractionContextType.Guild, InteractionContextType.BotDM),
	async execute(interaction) {
		await replyRank(interaction, scopeOf(interaction));
	}
} satisfies Command;
