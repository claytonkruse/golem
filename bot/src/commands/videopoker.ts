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
import { cardName, type Card } from '../games/cards.ts';
import { renderTable, VideoPoker } from '../games/video-poker.ts';
import { formatChips } from '../lib/chips.ts';
import type { Command } from '../lib/command.ts';
import { claimOnce, newMessage, release, type EditMessage } from '../lib/messages.ts';
import { displayName, notEnoughChips, placeBet } from '../lib/players.ts';

// Games live in memory, keyed by the id of the interaction that dealt them. The bet sits in
// a chip hold until the draw; a restart refunds open holds.
type Game = {
	game: VideoPoker;
	playerId: string;
	playerName: string;
	holdId: number | null;
	bet: number;
	edit: EditMessage;
	timeout?: NodeJS.Timeout;
};

const games = new Map<string, Game>();
const IDLE_MS = 5 * 60 * 1000;

const suitSymbols: Record<Card['suit'], string> = {
	spades: '♠',
	hearts: '♥',
	diamonds: '♦',
	clubs: '♣'
};

// One toggle per card, labelled with the card, green while held; then Draw.
function buttons(gameId: string, game: VideoPoker) {
	const holds = new ActionRowBuilder<ButtonBuilder>().addComponents(
		game.hand.map((card, index) =>
			new ButtonBuilder()
				.setCustomId(`videopoker:hold:${gameId}:${index}`)
				.setLabel(`${card.rank}${suitSymbols[card.suit]}`)
				.setStyle(game.held[index] ? ButtonStyle.Success : ButtonStyle.Secondary)
		)
	);
	const draw = new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			.setCustomId(`videopoker:draw:${gameId}`)
			.setLabel('Draw')
			.setStyle(ButtonStyle.Primary)
	);
	return [holds, draw];
}

function playAgainButton(bet: number, playerId: string) {
	return new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			.setCustomId(`videopoker:again:${bet}:${playerId}`)
			.setLabel(bet > 0 ? `Play again (${formatChips(bet)})` : 'Play again')
			.setStyle(ButtonStyle.Primary)
	);
}

async function table(entry: Game): Promise<AttachmentBuilder> {
	const { game } = entry;
	const hand = game.hand.map(cardName).join(', ');
	const description = game.drawn
		? `Video poker: ${hand}. ${game.result ?? 'No win.'}`
		: `Video poker: ${hand}.`;
	return new AttachmentBuilder(await renderTable(game, entry.playerName, entry.bet), {
		name: 'videopoker.png',
		description
	});
}

async function finish(
	entry: Game,
	gameId: string,
	note = ''
): Promise<InteractionEditReplyOptions> {
	games.delete(gameId);
	clearTimeout(entry.timeout);
	let content = entry.game.result ? `**${entry.game.result}!**` : 'No win this time.';
	if (entry.holdId !== null) {
		const balance = settleHold(entry.holdId, entry.playerId, entry.game.payout(entry.bet));
		content += ` You have ${formatChips(balance)}.`;
	}
	return {
		content: `${note}${content}`,
		files: [await table(entry)],
		attachments: [],
		components: [playAgainButton(entry.bet, entry.playerId)]
	};
}

function idleTimer(gameId: string): NodeJS.Timeout {
	return setTimeout(async () => {
		const entry = games.get(gameId);
		if (!entry) return;
		// Drawing with whatever is held settles the bet instead of leaving the chips held.
		entry.game.draw();
		try {
			await entry.edit(await finish(entry, gameId, 'Nobody moved for 5 minutes, so Golem drew. '));
		} catch (error) {
			console.error('Could not close an idle video poker game.', error);
		}
	}, IDLE_MS);
}

async function start(
	gameId: string,
	player: { id: string; name: string },
	bet: number,
	holdId: number | null,
	edit: EditMessage
): Promise<void> {
	const entry: Game = {
		game: new VideoPoker(),
		playerId: player.id,
		playerName: player.name,
		holdId,
		bet,
		edit
	};
	games.set(gameId, entry);
	entry.timeout = idleTimer(gameId);
	await edit({
		content: '',
		files: [await table(entry)],
		attachments: [],
		components: buttons(gameId, entry.game)
	});
}

async function playAgain(
	interaction: ButtonInteraction,
	bet: number,
	playerId: string
): Promise<void> {
	if (interaction.user.id !== playerId) {
		await interaction.reply({
			content: "That's someone else's game. Start your own with /videopoker.",
			flags: MessageFlags.Ephemeral
		});
		return;
	}
	const blocked = gameBlocked(interaction.guildId, 'videopoker');
	if (blocked) {
		await interaction.reply({ content: blocked, flags: MessageFlags.Ephemeral });
		return;
	}
	const messageId = interaction.message.id;
	if (!claimOnce(messageId)) {
		await interaction.deferUpdate();
		return;
	}
	const holdId = placeBet(playerId, 'videopoker', bet);
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
		.setName('videopoker')
		.setDescription('Play Jacks or Better: hold the cards you want and draw once.')
		.setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
		.setContexts(InteractionContextType.Guild, InteractionContextType.BotDM)
		.addIntegerOption((option) =>
			option
				.setName('bet')
				.setDescription('How many chips to bet. Leave it out to play for fun.')
				.setMinValue(1)
		),

	async execute(interaction) {
		const blocked = gameBlocked(interaction.guildId, 'videopoker');
		if (blocked) {
			await interaction.reply({ content: blocked, flags: MessageFlags.Ephemeral });
			return;
		}
		const bet = interaction.options.getInteger('bet') ?? 0;
		const holdId = placeBet(interaction.user.id, 'videopoker', bet);
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
				content: 'That game has ended. Start a new one with /videopoker.',
				flags: MessageFlags.Ephemeral
			});
			return;
		}
		if (interaction.user.id !== entry.playerId) {
			await interaction.reply({
				content: "That's someone else's game. Start your own with /videopoker.",
				flags: MessageFlags.Ephemeral
			});
			return;
		}
		clearTimeout(entry.timeout);
		entry.timeout = idleTimer(gameId);

		if (action === 'hold') {
			// Only the buttons change, so there's no image to redraw and the toggle is instant.
			entry.game.toggle(Number(rest[1]));
			await interaction.update({ components: buttons(gameId, entry.game) });
			return;
		}
		await interaction.deferUpdate();
		entry.edit = (options) => interaction.editReply(options);
		entry.game.draw();
		await interaction.editReply(await finish(entry, gameId));
	}
} satisfies Command;
