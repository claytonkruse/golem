import { Events, MessageFlags, type InteractionReplyOptions } from 'discord.js';
import type { Event } from '../lib/event.ts';
import { commands } from '../registry.ts';

export const event = {
	name: Events.InteractionCreate,
	async execute(interaction) {
		if (!interaction.isChatInputCommand()) return;

		const command = commands.get(interaction.commandName);
		if (!command) {
			await interaction.reply({
				content: 'That command is not loaded.',
				flags: MessageFlags.Ephemeral
			});
			return;
		}

		try {
			await command.execute(interaction);
		} catch (error) {
			console.error(`/${interaction.commandName} failed.`, error);
			const payload: InteractionReplyOptions = {
				content: 'Golem could not finish that command.',
				flags: MessageFlags.Ephemeral
			};
			if (interaction.replied || interaction.deferred) {
				await interaction.followUp(payload);
			} else {
				await interaction.reply(payload);
			}
		}
	}
} satisfies Event<typeof Events.InteractionCreate>;
