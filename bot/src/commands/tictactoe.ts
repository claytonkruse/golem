import {
	ApplicationIntegrationType,
	InteractionContextType,
	SlashCommandBuilder
} from 'discord.js';
import { ticTacToe } from '../games/tic-tac-toe.ts';
import type { Command } from '../lib/command.ts';
import { handleButton, startFromCommand } from '../lib/match.ts';

export const command = {
	data: new SlashCommandBuilder()
		.setName('tictactoe')
		.setDescription('Play Tic-Tac-Toe against a member or Golem.')
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
	execute: (interaction) => startFromCommand(ticTacToe, interaction),
	button: (interaction) => handleButton(ticTacToe, interaction)
} satisfies Command;
