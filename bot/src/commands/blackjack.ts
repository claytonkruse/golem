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
import { addToHold, getBalance, settleHold } from '../db/chips.ts';
import { gameBlocked } from '../db/guild-games.ts';
import { setTimeout as sleep } from 'node:timers/promises';
import {
	actionFrames,
	Blackjack,
	dealFrames,
	handValue,
	outcomeText,
	payout,
	renderTable,
	type TableView
} from '../games/blackjack.ts';
import { formatChips } from '../lib/chips.ts';
import type { Command } from '../lib/command.ts';
import { claimOnce, newMessage, release } from '../lib/messages.ts';
import { displayName, notEnoughChips, placeBet } from '../lib/players.ts';

// Games live in memory, keyed by the id of the interaction that dealt them. The bet sits
// in a chip hold until the hand settles; a restart refunds open holds.
type Game = {
	blackjack: Blackjack;
	playerId: string;
	playerName: string;
	// The chips set aside for the bet, or null for a hand played for fun.
	holdId: number | null;
	// The bet the hand was dealt with (0 for fun), and everything staked on it after doubling.
	baseBet: number;
	bet: number;
	// Edits the game's message through the latest interaction that touched it. Interaction
	// tokens last 15 minutes, so the idle timeout can't rely on the one that started the game.
	edit: (options: InteractionEditReplyOptions) => Promise<unknown>;
	timeout?: NodeJS.Timeout;
};

const games = new Map<string, Game>();
const IDLE_MS = 5 * 60 * 1000;

// The pause between cards as they're dealt. Exported so tests can skip it.
export const animation = { delayMs: 700 };

function moveButtons(gameId: string, game: Blackjack) {
	const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			.setCustomId(`blackjack:hit:${gameId}`)
			.setLabel('Hit')
			.setStyle(ButtonStyle.Primary),
		new ButtonBuilder()
			.setCustomId(`blackjack:stand:${gameId}`)
			.setLabel('Stand')
			.setStyle(ButtonStyle.Secondary)
	);
	if (game.canDouble) {
		row.addComponents(
			new ButtonBuilder()
				.setCustomId(`blackjack:double:${gameId}`)
				.setLabel('Double down')
				.setStyle(ButtonStyle.Secondary)
		);
	}
	return row;
}

// Carries the bet and the player in its id, since the finished game is no longer in memory.
function playAgainButton(bet: number, playerId: string) {
	return new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			.setCustomId(`blackjack:again:${bet}:${playerId}`)
			.setLabel(bet > 0 ? `Play again (${formatChips(bet)})` : 'Play again')
			.setStyle(ButtonStyle.Primary)
	);
}

// The table image, with alt text describing it for screen readers.
async function table(game: Game): Promise<AttachmentBuilder> {
	const { blackjack, bet } = game;
	const player = handValue(blackjack.player).total;
	const title = bet > 0 ? `Blackjack for ${formatChips(bet)}` : 'Blackjack for fun';
	const description = blackjack.outcome
		? `${title}: your ${player} against the dealer's ${handValue(blackjack.dealer).total}. ${outcomeText[blackjack.outcome]}`
		: `${title}: your ${player} against the dealer's ${handValue(blackjack.dealer.slice(0, 1)).total} showing.`;
	return new AttachmentBuilder(await renderTable(blackjack, game.playerName, bet), {
		name: 'blackjack.png',
		description
	});
}

// Shows the cards arriving one at a time, without buttons, before the message that follows.
async function animate(game: Game, frames: TableView[]): Promise<void> {
	for (const view of frames) {
		const image = await renderTable(game.blackjack, game.playerName, game.bet, view);
		await game.edit({
			content: '',
			files: [
				new AttachmentBuilder(image, {
					name: 'blackjack.png',
					description: `Blackjack: ${view.status}`
				})
			],
			attachments: [],
			components: []
		});
		await sleep(animation.delayMs);
	}
}

// Pays out a finished hand, ends its hold and returns its message: the result, the new
// balance and a button to play again.
async function finish(game: Game, gameId: string, note = ''): Promise<InteractionEditReplyOptions> {
	games.delete(gameId);
	clearTimeout(game.timeout);
	const outcome = game.blackjack.outcome;
	if (!outcome) throw new Error('Finished a hand that is still going.');
	let content = note.trim();
	if (game.holdId !== null) {
		const balance = settleHold(game.holdId, game.playerId, payout(outcome, game.bet));
		content = `${note}You have ${formatChips(balance)}.`;
	}
	return {
		content,
		files: [await table(game)],
		// Replace the previous table rather than adding a second image.
		attachments: [],
		components: [playAgainButton(game.baseBet, game.playerId)]
	};
}

async function inPlay(game: Game, gameId: string): Promise<InteractionEditReplyOptions> {
	clearTimeout(game.timeout);
	game.timeout = setTimeout(() => void endIdle(gameId), IDLE_MS);
	return {
		// Clears the last hand's balance line when a game is dealt again in the same message.
		content: '',
		files: [await table(game)],
		attachments: [],
		components: [moveButtons(gameId, game.blackjack)]
	};
}

async function endIdle(gameId: string): Promise<void> {
	const game = games.get(gameId);
	if (!game) return;
	// Standing settles the bet instead of leaving the chips held.
	game.blackjack.stand();
	try {
		await game.edit(await finish(game, gameId, 'Nobody moved for 5 minutes, so Golem stood. '));
	} catch (error) {
		console.error('Could not close an idle blackjack game.', error);
	}
}

// Deals a hand whose bet is already held and shows it through `edit`.
async function deal(
	gameId: string,
	player: { id: string; name: string },
	bet: number,
	holdId: number | null,
	edit: Game['edit']
): Promise<void> {
	const game: Game = {
		blackjack: new Blackjack(),
		playerId: player.id,
		playerName: player.name,
		holdId,
		baseBet: bet,
		bet,
		edit
	};
	// A natural blackjack on the deal ends the hand before anyone presses anything. The
	// final message is built first, so the chips settle before the cards finish arriving.
	if (!game.blackjack.finished) games.set(gameId, game);
	const final = game.blackjack.finished ? await finish(game, gameId) : await inPlay(game, gameId);
	await animate(game, dealFrames(game.blackjack));
	await edit(final);
}

async function playAgain(
	interaction: ButtonInteraction,
	bet: number,
	playerId: string
): Promise<void> {
	if (interaction.user.id !== playerId) {
		await interaction.reply({
			content: "That's someone else's table. Start your own with /blackjack.",
			flags: MessageFlags.Ephemeral
		});
		return;
	}
	const blocked = gameBlocked(interaction.guildId, 'blackjack');
	if (blocked) {
		await interaction.reply({ content: blocked, flags: MessageFlags.Ephemeral });
		return;
	}
	// Claiming and holding the bet happen with no await in between, so a double click can't
	// start two hands.
	const messageId = interaction.message.id;
	if (!claimOnce(messageId)) {
		await interaction.deferUpdate();
		return;
	}
	const holdId = placeBet(playerId, 'blackjack', bet);
	if (holdId === false) {
		release(messageId);
		await interaction.reply({ content: notEnoughChips(playerId), flags: MessageFlags.Ephemeral });
		return;
	}
	// The finished hand keeps its result; the next one starts in a new message below it.
	await interaction.update({ components: [] });
	await deal(
		interaction.id,
		{ id: playerId, name: displayName(interaction) },
		bet,
		holdId,
		newMessage(interaction)
	);
}

export const command = {
	data: new SlashCommandBuilder()
		.setName('blackjack')
		.setDescription('Play a hand of blackjack against Golem, for chips or for fun.')
		.setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
		.setContexts(InteractionContextType.Guild, InteractionContextType.BotDM)
		.addIntegerOption((option) =>
			option
				.setName('bet')
				.setDescription('How many chips to bet. Leave it out to play for fun.')
				.setMinValue(1)
		),

	async execute(interaction) {
		const blocked = gameBlocked(interaction.guildId, 'blackjack');
		if (blocked) {
			await interaction.reply({ content: blocked, flags: MessageFlags.Ephemeral });
			return;
		}
		const bet = interaction.options.getInteger('bet') ?? 0;
		const holdId = placeBet(interaction.user.id, 'blackjack', bet);
		if (holdId === false) {
			await interaction.reply({
				content: notEnoughChips(interaction.user.id),
				flags: MessageFlags.Ephemeral
			});
			return;
		}
		// Rendering the table can take about a second the first time after startup.
		await interaction.deferReply();
		await deal(
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
		const game = games.get(gameId);
		if (!game) {
			// Golem restarted or the game timed out; take the dead buttons away.
			await interaction.update({ components: [] });
			await interaction.followUp({
				content: 'That game has ended. Start a new one with /blackjack.',
				flags: MessageFlags.Ephemeral
			});
			return;
		}
		if (interaction.user.id !== game.playerId) {
			await interaction.reply({
				content: "That's someone else's game. Start your own with /blackjack.",
				flags: MessageFlags.Ephemeral
			});
			return;
		}
		if (action === 'double') {
			if (!game.blackjack.canDouble) return void (await interaction.deferUpdate());
			if (game.holdId !== null && !addToHold(game.holdId, game.playerId, game.bet)) {
				await interaction.reply({
					content: `Doubling needs another ${formatChips(game.bet)}, and you have ${formatChips(getBalance(game.playerId))}.`,
					flags: MessageFlags.Ephemeral
				});
				return;
			}
			game.bet *= 2;
		}

		await interaction.deferUpdate();
		game.edit = (options) => interaction.editReply(options);
		const cardsBefore = game.blackjack.player.length;
		if (action === 'hit') game.blackjack.hit();
		else if (action === 'stand') game.blackjack.stand();
		else if (action === 'double') game.blackjack.doubleDown();

		const final = game.blackjack.finished ? await finish(game, gameId) : await inPlay(game, gameId);
		await animate(game, actionFrames(game.blackjack, cardsBefore));
		await interaction.editReply(final);
	}
} satisfies Command;
