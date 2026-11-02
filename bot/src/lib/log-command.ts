import type { ChatInputCommandInteraction, SlashCommandStringOption } from 'discord.js';
import { logEvents, type LogEventKey } from './log-events.ts';

const ALL = 'all';

// The `event` option shared by /loghere and /logstop: every event, plus "All events".
export function eventOption(option: SlashCommandStringOption): SlashCommandStringOption {
	return option
		.setName('event')
		.setDescription('Which event')
		.setRequired(true)
		.addChoices(
			{ name: 'All events', value: ALL },
			...logEvents.map((event) => ({ name: event.label, value: event.key }))
		);
}

export function chosenEvents(interaction: ChatInputCommandInteraction): {
	events: LogEventKey[];
	label: string;
} {
	const value = interaction.options.getString('event', true);
	if (value === ALL) {
		return { events: logEvents.map((event) => event.key), label: 'every event' };
	}
	const event = logEvents.find((entry) => entry.key === value);
	if (!event) throw new Error(`Unknown log event: ${value}`);
	return { events: [event.key], label: `**${event.label}**` };
}
