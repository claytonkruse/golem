import {
	Events,
	MessageFlags,
	type ButtonInteraction,
	type ChatInputCommandInteraction,
	type InteractionReplyOptions
} from 'discord.js';
import type { Event } from '../lib/event.ts';
import { commands } from '../registry.ts';

async function reportFailure(
	interaction: ChatInputCommandInteraction | ButtonInteraction,
	what: string,
	error: unknown
): Promise<void> {
	console.error(`${what} failed.`, error);
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

export const event = {
	name: Events.InteractionCreate,
	async execute(interaction) {
		if (interaction.isButton()) {
			// Custom ids are "<command name>:…", so each command handles its own buttons.
			const name = interaction.customId.split(':', 1)[0];
			const command = commands.get(name);
			if (!command?.button) return;
			try {
				await command.button(interaction);
			} catch (error) {
				await reportFailure(interaction, `The ${interaction.customId} button`, error);
			}
			return;
		}

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
			await reportFailure(interaction, `/${interaction.commandName}`, error);
		}
	}
} satisfies Event<typeof Events.InteractionCreate>;
