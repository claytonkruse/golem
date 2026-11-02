import {
	ApplicationIntegrationType,
	InteractionContextType,
	SlashCommandBuilder
} from 'discord.js';
import { connectFour } from '../games/connect-four.ts';
import type { Command } from '../lib/command.ts';
import { handleButton, startFromCommand } from '../lib/match.ts';

export const command = {
	data: new SlashCommandBuilder()
		.setName('connect4')
		.setDescription('Play Connect Four against a member or Golem.')
		.setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
		.setContexts(InteractionContextType.Guild, InteractionContextType.BotDM)
		.addUserOption((option) =>
			option.setName('opponent').setDescription('Who to challenge. Leave it out to play Golem.')
		)
		.addIntegerOption((option) =>
			option
				.setName('bet')
				.setDescription(
					'Chips each player puts in; the winner takes both. Leave it out to play for fun.'
				)
				.setMinValue(1)
		),
	execute: (interaction) => startFromCommand(connectFour, interaction),
	button: (interaction) => handleButton(connectFour, interaction)
} satisfies Command;
