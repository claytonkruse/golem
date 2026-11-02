import {
	AttachmentBuilder,
	MessageFlags,
	type ButtonInteraction,
	type ChatInputCommandInteraction
} from 'discord.js';
import { levelCommandSwitches } from '../db/guild-level-commands.ts';
import { getGuildSettings } from '../db/guild-settings.ts';
import { memberStanding, userStanding, type XpStanding } from '../db/xp.ts';
import { renderLevelCard, renderRankCard } from './level-card.ts';
import { isLevelCommand, levelFromXp } from './levels.ts';

// Shared by /level, /rank and their global versions. In a DM there is no server, so
// /level and /rank answer with the global numbers.

export type Scope = 'server' | 'global';

export function scopeOf(interaction: ChatInputCommandInteraction): Scope {
	return interaction.inCachedGuild() ? 'server' : 'global';
}

function standing(interaction: ChatInputCommandInteraction, scope: Scope): XpStanding | null {
	return scope === 'server' && interaction.inCachedGuild()
		? memberStanding(interaction.guildId, interaction.user.id)
		: userStanding(interaction.user.id);
}

async function replyNoXp(interaction: ChatInputCommandInteraction, scope: Scope): Promise<void> {
	await interaction.reply({
		content:
			scope === 'server'
				? "You haven't earned any XP in this server yet. Chat here to start."
				: "You haven't earned any XP yet. Chat in any server with Golem to start.",
		flags: MessageFlags.Ephemeral
	});
}

function profile(interaction: ChatInputCommandInteraction, scope: Scope) {
	const inServer = scope === 'server' && interaction.inCachedGuild();
	return {
		name: inServer
			? interaction.member.displayName
			: (interaction.user.globalName ?? interaction.user.username),
		avatarUrl: (inServer ? interaction.member : interaction.user).displayAvatarURL({
			extension: 'png',
			size: 256
		}),
		scope: inServer ? `In ${interaction.guild.name}` : 'Global'
	};
}

// Leveling commands are off in a server until a manager turns them on, and each one can be
// turned off on its own. XP is earned either way; DMs belong to no server and are always
// allowed. Returns true when it replied that the command is off. Buttons pass the name of
// the command that made them, so turning a command off also stops its old buttons.
export async function commandsOff(
	interaction: ChatInputCommandInteraction | ButtonInteraction,
	command = interaction.isChatInputCommand() ? interaction.commandName : ''
): Promise<boolean> {
	if (!interaction.inCachedGuild()) return false;
	let content: string | null = null;
	if (!getGuildSettings(interaction.guildId).levelCommands) {
		content = 'Leveling commands are turned off in this server. You still earn XP here.';
	} else {
		if (isLevelCommand(command) && !levelCommandSwitches(interaction.guildId)[command]) {
			content = `/${command} is turned off in this server.`;
		}
	}
	if (content === null) return false;
	await interaction.reply({ content, flags: MessageFlags.Ephemeral });
	return true;
}

// Both cards take about a second to render the first time after startup, and Discord
// only waits three, so the reply is deferred first.

export async function replyLevel(
	interaction: ChatInputCommandInteraction,
	scope: Scope
): Promise<void> {
	if (await commandsOff(interaction)) return;
	const current = standing(interaction, scope);
	if (!current) return replyNoXp(interaction, scope);
	await interaction.deferReply();
	const png = await renderLevelCard(profile(interaction, scope), levelFromXp(current.xp));
	await interaction.editReply({ files: [new AttachmentBuilder(png, { name: 'level.png' })] });
}

export async function replyRank(
	interaction: ChatInputCommandInteraction,
	scope: Scope
): Promise<void> {
	if (await commandsOff(interaction)) return;
	const current = standing(interaction, scope);
	if (!current) return replyNoXp(interaction, scope);
	await interaction.deferReply();
	const { level } = levelFromXp(current.xp);
	const png = await renderRankCard(profile(interaction, scope), current.rank, level);
	await interaction.editReply({ files: [new AttachmentBuilder(png, { name: 'rank.png' })] });
}
