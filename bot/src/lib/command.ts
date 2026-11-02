import {
	ApplicationCommandOptionType,
	type ButtonInteraction,
	type ChatInputCommandInteraction,
	type RESTPostAPIChatInputApplicationCommandsJSONBody,
	type SlashCommandBuilder,
	type SlashCommandOptionsOnlyBuilder,
	type SlashCommandSubcommandsOnlyBuilder
} from 'discord.js';

export type CommandData =
	SlashCommandBuilder | SlashCommandOptionsOnlyBuilder | SlashCommandSubcommandsOnlyBuilder;

export type Command = {
	data: CommandData;
	execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
	// Buttons whose custom id starts with "<command name>:" are sent here.
	button?: (interaction: ButtonInteraction) => Promise<void>;
};

export type CommandSummary = {
	name: string;
	description: string;
};

export function commandJson(command: Command): RESTPostAPIChatInputApplicationCommandsJSONBody {
	return command.data.toJSON();
}

// One entry per invocable path, so `/config set` and `/config reset` are listed
// separately instead of as a bare `/config`.
export function commandSummaries(command: Command): CommandSummary[] {
	const json = commandJson(command);
	const nested = (json.options ?? []).flatMap((option): CommandSummary[] => {
		if (option.type === ApplicationCommandOptionType.Subcommand) {
			return [{ name: `${json.name} ${option.name}`, description: option.description }];
		}
		if (option.type === ApplicationCommandOptionType.SubcommandGroup) {
			return (option.options ?? []).map((sub) => ({
				name: `${json.name} ${option.name} ${sub.name}`,
				description: sub.description
			}));
		}
		return [];
	});
	return nested.length > 0 ? nested : [{ name: json.name, description: json.description }];
}
