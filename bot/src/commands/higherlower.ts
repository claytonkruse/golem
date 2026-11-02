import {
	ActionRowBuilder,
	ApplicationIntegrationType,
	AttachmentBuilder,
	ButtonBuilder,
	ButtonStyle,
	InteractionContextType,
	MessageFlags,
	SlashCommandBuilder,
	type ButtonInteraction,
	type InteractionEditReplyOptions
} from 'discord.js';
import { settleHold } from '../db/chips.ts';
import { gameBlocked } from '../db/guild-games.ts';
import { cardName } from '../games/cards.ts';
import { formatMultiplier, HigherLower, renderTable, type Guess } from '../games/higher-lower.ts';
import { formatChips } from '../lib/chips.ts';
import type { Command } from '../lib/command.ts';
import { claimOnce, newMessage, release, type EditMessage } from '../lib/messages.ts';
import { displayName, notEnoughChips, placeBet } from '../lib/players.ts';

// Games live in memory, keyed by the id of the interaction that started them. The bet sits
// in a chip hold until the game ends; a restart refunds open holds.
type Game = {
	game: HigherLower;
	playerId: string;
	playerName: string;
	holdId: number | null;
	bet: number;
	edit: EditMessage;
	timeout?: NodeJS.Timeout;
};

const games = new Map<string, Game>();
const IDLE_MS = 5 * 60 * 1000;

function buttons(gameId: string, { game, bet }: Game) {
	const guess = (direction: Guess, label: string) => {
		const gain = game.gain(direction);
		return (
			new ButtonBuilder()
				.setCustomId(`higherlower:${direction}:${gameId}`)
				.setLabel(gain === 0 ? label : `${label} ${formatMultiplier(gain)}`)
				.setStyle(ButtonStyle.Primary)
				// A guess that can't win, like Higher on an ace.
				.setDisabled(gain === 0)
		);
	};
	const cashOut = new ButtonBuilder()
		.setCustomId(`higherlower:cash:${gameId}`)
		.setLabel(bet > 0 ? `Cash out ${formatChips(Math.floor(bet * game.multiplier))}` : 'Cash out')
		.setStyle(ButtonStyle.Success)
		.setDisabled(game.correct === 0);
	return new ActionRowBuilder<ButtonBuilder>().addComponents(
		guess('higher', 'Higher'),
		guess('lower', 'Lower'),
		cashOut
	);
}

function playAgainButton(bet: number, playerId: string) {
	return new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			.setCustomId(`higherlower:again:${bet}:${playerId}`)
			.setLabel(bet > 0 ? `Play again (${formatChips(bet)})` : 'Play again')
			.setStyle(ButtonStyle.Primary)
	);
}

async function table(entry: Game): Promise<AttachmentBuilder> {
	const { game } = entry;
	const description = game.finished
		? `Higher or lower ended on the ${cardName(game.current)} at ${formatMultiplier(game.multiplier)}.`
		: `Higher or lower: the ${cardName(game.current)}, at ${formatMultiplier(game.multiplier)}.`;
	return new AttachmentBuilder(await renderTable(game, entry.playerName, entry.bet), {
		name: 'higherlower.png',
		description
	});
}

// Pays out a finished game and returns its message.
async function finish(
	entry: Game,
	gameId: string,
	note = ''
): Promise<InteractionEditReplyOptions> {
	games.delete(gameId);
	clearTimeout(entry.timeout);
	const { game } = entry;
	let content =
		game.outcome === 'lost'
			? `It was the ${cardName(game.current)}.`
			: `Cashed out at ${formatMultiplier(game.multiplier)} after ${game.correct} correct ${game.correct === 1 ? 'guess' : 'guesses'}.`;
	if (entry.holdId !== null) {
		const balance = settleHold(entry.holdId, entry.playerId, game.payout(entry.bet));
		content += ` You have ${formatChips(balance)}.`;
	}
	return {
		content: `${note}${content}`,
		files: [await table(entry)],
		attachments: [],
		components: [playAgainButton(entry.bet, entry.playerId)]
	};
}

async function inPlay(entry: Game, gameId: string): Promise<InteractionEditReplyOptions> {
	clearTimeout(entry.timeout);
	entry.timeout = setTimeout(() => void endIdle(gameId), IDLE_MS);
	return {
		content: '',
		files: [await table(entry)],
		attachments: [],
		components: [buttons(gameId, entry)]
	};
}

async function endIdle(gameId: string): Promise<void> {
	const entry = games.get(gameId);
	if (!entry) return;
	// Cashing out keeps what was won instead of leaving the chips held.
	entry.game.cashOut();
	try {
		await entry.edit(
			await finish(entry, gameId, 'Nobody moved for 5 minutes, so Golem cashed out. ')
		);
	} catch (error) {
		console.error('Could not close an idle higher or lower game.', error);
	}
}

async function start(
	gameId: string,
	player: { id: string; name: string },
	bet: number,
	holdId: number | null,
	edit: EditMessage
): Promise<void> {
	const entry: Game = {
		game: new HigherLower(),
		playerId: player.id,
		playerName: player.name,
		holdId,
		bet,
		edit
	};
	games.set(gameId, entry);
	await edit(await inPlay(entry, gameId));
}

async function playAgain(
	interaction: ButtonInteraction,
	bet: number,
	playerId: string
): Promise<void> {
	if (interaction.user.id !== playerId) {
		await interaction.reply({
			content: "That's someone else's game. Start your own with /higherlower.",
			flags: MessageFlags.Ephemeral
		});
		return;
	}
	const blocked = gameBlocked(interaction.guildId, 'higherlower');
	if (blocked) {
		await interaction.reply({ content: blocked, flags: MessageFlags.Ephemeral });
		return;
	}
	const messageId = interaction.message.id;
	if (!claimOnce(messageId)) {
		await interaction.deferUpdate();
		return;
	}
	const holdId = placeBet(playerId, 'higherlower', bet);
	if (holdId === false) {
		release(messageId);
		await interaction.reply({ content: notEnoughChips(playerId), flags: MessageFlags.Ephemeral });
		return;
	}
	await interaction.update({ components: [] });
	await start(
		interaction.id,
		{ id: playerId, name: displayName(interaction) },
		bet,
		holdId,
		newMessage(interaction)
	);
}

export const command = {
	data: new SlashCommandBuilder()
		.setName('higherlower')
		.setDescription('Guess whether the next card is higher or lower, and cash out before you miss.')
		.setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
		.setContexts(InteractionContextType.Guild, InteractionContextType.BotDM)
		.addIntegerOption((option) =>
			option
				.setName('bet')
				.setDescription('How many chips to bet. Leave it out to play for fun.')
				.setMinValue(1)
		),

	async execute(interaction) {
		const blocked = gameBlocked(interaction.guildId, 'higherlower');
		if (blocked) {
			await interaction.reply({ content: blocked, flags: MessageFlags.Ephemeral });
			return;
		}
		const bet = interaction.options.getInteger('bet') ?? 0;
		const holdId = placeBet(interaction.user.id, 'higherlower', bet);
		if (holdId === false) {
			await interaction.reply({
				content: notEnoughChips(interaction.user.id),
				flags: MessageFlags.Ephemeral
			});
			return;
		}
		await interaction.deferReply();
		await start(
			interaction.id,
			{ id: interaction.user.id, name: displayName(interaction) },
			bet,
			holdId,
			(options) => interaction.editReply(options)
		);
	},

	async button(interaction) {
		const [, action, ...rest] = interaction.customId.split(':');
		if (action === 'again') return playAgain(interaction, Number(rest[0]), rest[1]);

		const gameId = rest[0];
		const entry = games.get(gameId);
		if (!entry) {
			await interaction.update({ components: [] });
			await interaction.followUp({
				content: 'That game has ended. Start a new one with /higherlower.',
				flags: MessageFlags.Ephemeral
			});
			return;
		}
		if (interaction.user.id !== entry.playerId) {
			await interaction.reply({
				content: "That's someone else's game. Start your own with /higherlower.",
				flags: MessageFlags.Ephemeral
			});
			return;
		}
		await interaction.deferUpdate();
		entry.edit = (options) => interaction.editReply(options);
		if (action === 'cash') entry.game.cashOut();
		else if (action === 'higher' || action === 'lower') entry.game.guess(action);

		await interaction.editReply(
			entry.game.finished ? await finish(entry, gameId) : await inPlay(entry, gameId)
		);
	}
} satisfies Command;
