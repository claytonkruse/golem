import {
	ApplicationIntegrationType,
	InteractionContextType,
	MessageFlags,
	SlashCommandBuilder,
	time,
	TimestampStyles
} from 'discord.js';
import { claimDaily } from '../db/chips.ts';
import { DAILY_CHIPS, formatChips } from '../lib/chips.ts';
import type { Command } from '../lib/command.ts';

export const command = {
	data: new SlashCommandBuilder()
		.setName('daily')
		.setDescription(`Collect ${DAILY_CHIPS} free chips, once every 24 hours.`)
		.setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
		.setContexts(InteractionContextType.Guild, InteractionContextType.BotDM),
	async execute(interaction) {
		const result = claimDaily(interaction.user.id);
		await interaction.reply({
			content: result.claimed
				? `You collected ${formatChips(DAILY_CHIPS)} and now have ${formatChips(result.balance)}.`
				: `You already collected today's chips. Come back ${time(result.nextAt, TimestampStyles.RelativeTime)}.`,
			flags: MessageFlags.Ephemeral
		});
	}
} satisfies Command;
