import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	MessageFlags,
	userMention,
	type AttachmentBuilder,
	type ButtonInteraction,
	type ChatInputCommandInteraction,
	type InteractionEditReplyOptions
} from 'discord.js';
import { settleHold } from '../db/chips.ts';
import { gameBlocked } from '../db/guild-games.ts';
import { randomInt } from 'node:crypto';
import { formatChips } from './chips.ts';
import type { GameKey } from './games.ts';
import { claimOnce, newMessage, release, type EditMessage } from './messages.ts';
import { displayName, notEnoughChips, placeBet, userName } from './players.ts';

// Two-player turn-based games: a challenge another member accepts or declines, or a game
// against Golem. Each game supplies its rules and drawing as a MatchGame; this file handles
// challenges, turns, stakes, timeouts and rematches the same way for all of them.

export type Seat = 0 | 1;
export type Winner = Seat | 'draw' | null;

export type MatchGame<State, Move extends string> = {
	key: GameKey;
	label: string;
	// The slash command, for messages like "Start your own with /connect4".
	command: string;
	create(): State;
	turn(state: State): Seat;
	legal(state: State, move: Move): boolean;
	play(state: State, move: Move): void;
	winner(state: State): Winner;
	// Golem's move when it's playing.
	ai(state: State): Move;
	// How a move reads in a sentence: "column 4", "the top left".
	describe(move: Move): string;
	// The board for the message: an image and/or button rows. Move buttons use the id
	// `${key}:move:${matchId}:${move}` and are disabled once the game is over.
	view(match: Match<State, Move>): Promise<{
		files?: AttachmentBuilder[];
		rows: ActionRowBuilder<ButtonBuilder>[];
	}>;
};

export type Player = { id: string; name: string; holdId: number | null; golem: boolean };

export type Match<State, Move extends string> = {
	id: string;
	game: MatchGame<State, Move>;
	// Seat 0 moves first.
	seats: [Player, Player];
	bet: number;
	state: State;
	phase: 'challenge' | 'playing' | 'over';
	lastMove: { seat: Seat; move: Move } | null;
	edit: EditMessage;
	timer?: NodeJS.Timeout;
};

// Exported so tests can shorten them.
export const matchTiming = { challengeMs: 2 * 60 * 1000, turnMs: 5 * 60 * 1000 };

const matches = new Map<string, Match<unknown, string>>();

function button(id: string, label: string, style: ButtonStyle) {
	return new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style);
}

function stakeText(bet: number): string {
	return bet > 0 ? ` for ${formatChips(bet)} each` : '';
}

// Returns a finished match's stakes: the pot to the winner, or each stake back on a draw.
// Golem's seat never holds chips; beating it pays double the stake, as a member would.
function settle(match: Match<unknown, string>, winner: Winner): string {
	if (match.bet === 0) return '';
	const lines: string[] = [];
	match.seats.forEach((player, seat) => {
		if (player.holdId === null) return;
		const payout = winner === 'draw' ? match.bet : winner === seat ? match.bet * 2 : 0;
		const balance = settleHold(player.holdId, player.id, payout);
		lines.push(`${player.name} has ${formatChips(balance)}.`);
	});
	return lines.length > 0 ? ` ${lines.join(' ')}` : '';
}

function refund(player: Player, bet: number): void {
	if (player.holdId !== null) settleHold(player.holdId, player.id, bet);
}

function mention(player: Player): string {
	return player.golem ? 'Golem' : userMention(player.id);
}

async function show<State, Move extends string>(
	match: Match<State, Move>,
	content: string,
	extraRows: ActionRowBuilder<ButtonBuilder>[] = []
): Promise<void> {
	const view = await match.game.view(match);
	const options: InteractionEditReplyOptions = {
		content,
		files: view.files ?? [],
		attachments: [],
		components: [...view.rows, ...extraRows],
		// Mentions name the players without pinging them.
		allowedMentions: { parse: [] }
	};
	await match.edit(options);
}

function rematchRow(match: Match<unknown, string>) {
	return new ActionRowBuilder<ButtonBuilder>().addComponents(
		button(`${match.game.key}:rematch:${match.id}`, 'Rematch', ButtonStyle.Primary)
	);
}

// Rematches are offered from memory, so finished matches are kept for a while.
const REMATCH_MS = 10 * 60 * 1000;

async function end<State, Move extends string>(
	match: Match<State, Move>,
	note: string
): Promise<void> {
	match.phase = 'over';
	clearTimeout(match.timer);
	setTimeout(() => matches.delete(match.id), REMATCH_MS).unref();
	await show(match, note, [rematchRow(match as Match<unknown, string>)]);
}

function turnText<State, Move extends string>(match: Match<State, Move>): string {
	const [a, b] = match.seats;
	const next = match.seats[match.game.turn(match.state)];
	const last = match.lastMove
		? `${match.seats[match.lastMove.seat].name} played ${match.game.describe(match.lastMove.move)}. `
		: '';
	return `**${match.game.label}**${stakeText(match.bet)}: ${mention(a)} vs ${mention(b)}. ${last}**${next.name}**'s turn.`;
}

// Starts the turn clock; whoever lets it run out forfeits.
function startTurn<State, Move extends string>(match: Match<State, Move>): void {
	clearTimeout(match.timer);
	match.timer = setTimeout(() => {
		if (match.phase !== 'playing') return;
		const seat = match.game.turn(match.state);
		const winner = (1 - seat) as Seat;
		const note = `**${match.seats[winner].name} wins**: ${match.seats[seat].name} didn't move for 5 minutes.${settle(match as Match<unknown, string>, winner)}`;
		end(match, note).catch((error: unknown) =>
			console.error('Could not end a stalled match.', error)
		);
	}, matchTiming.turnMs);
}

// Plays Golem's move if it's Golem's turn, then either ends the game or waits for the human.
async function advance<State, Move extends string>(match: Match<State, Move>): Promise<void> {
	let winner = match.game.winner(match.state);
	if (winner === null && match.seats[match.game.turn(match.state)].golem) {
		const seat = match.game.turn(match.state);
		const move = match.game.ai(match.state);
		match.game.play(match.state, move);
		match.lastMove = { seat, move };
		winner = match.game.winner(match.state);
	}
	if (winner === null) {
		startTurn(match);
		await show(match, turnText(match));
		return;
	}
	const result = winner === 'draw' ? "**It's a draw.**" : `**${match.seats[winner].name} wins!**`;
	await end(match, `${result}${settle(match as Match<unknown, string>, winner)}`);
}

async function beginPlay<State, Move extends string>(match: Match<State, Move>): Promise<void> {
	// Who goes first is a coin flip.
	if (randomInt(2) === 1) match.seats.reverse();
	match.phase = 'playing';
	match.state = match.game.create();
	await advance(match);
}

type Opponent = { id: string; name: string; golem: boolean };

// Opens a match from a slash command or a Rematch button. Against a member it posts a
// challenge; against Golem it starts at once. The challenger's stake is already held.
async function open<State, Move extends string>(
	game: MatchGame<State, Move>,
	id: string,
	challenger: { id: string; name: string; holdId: number | null },
	opponent: Opponent,
	bet: number,
	edit: EditMessage
): Promise<void> {
	const match: Match<State, Move> = {
		id,
		game,
		seats: [
			{ ...challenger, golem: false },
			{ ...opponent, holdId: null }
		],
		bet,
		state: game.create(),
		phase: opponent.golem ? 'playing' : 'challenge',
		lastMove: null,
		edit
	};
	matches.set(id, match as Match<unknown, string>);

	if (opponent.golem) {
		await beginPlay(match);
		return;
	}
	match.timer = setTimeout(() => {
		if (match.phase !== 'challenge') return;
		match.phase = 'over';
		matches.delete(id);
		refund(match.seats[0], bet);
		edit({
			content: `${challenger.name}'s ${game.label} challenge to ${opponent.name} expired.`,
			components: [],
			allowedMentions: { parse: [] }
		}).catch((error: unknown) => console.error('Could not expire a challenge.', error));
	}, matchTiming.challengeMs);
	await edit({
		content: `${userMention(opponent.id)}, ${challenger.name} challenges you to **${game.label}**${stakeText(bet)}.`,
		files: [],
		attachments: [],
		components: [
			new ActionRowBuilder<ButtonBuilder>().addComponents(
				button(`${game.key}:accept:${id}`, 'Accept', ButtonStyle.Success),
				button(`${game.key}:decline:${id}`, 'Decline', ButtonStyle.Danger)
			)
		],
		// The person challenged is the only one pinged.
		allowedMentions: { users: [opponent.id] }
	});
}

// /connect4 and /tictactoe. With an opponent it challenges them; without one, Golem plays.
export async function startFromCommand<State, Move extends string>(
	game: MatchGame<State, Move>,
	interaction: ChatInputCommandInteraction
): Promise<void> {
	const blocked = gameBlocked(interaction.guildId, game.key);
	if (blocked) {
		await interaction.reply({ content: blocked, flags: MessageFlags.Ephemeral });
		return;
	}
	const target = interaction.options.getUser('opponent');
	const bet = interaction.options.getInteger('bet') ?? 0;
	const vsGolem = !target || target.id === interaction.client.user.id;
	const refuse = (content: string) => interaction.reply({ content, flags: MessageFlags.Ephemeral });

	if (target && !vsGolem) {
		if (!interaction.inGuild())
			return void (await refuse('Challenge people in a server. Here you can play Golem.'));
		if (target.id === interaction.user.id)
			return void (await refuse("You can't challenge yourself."));
		if (target.bot)
			return void (await refuse("Bots can't play. Leave out the opponent to play Golem."));
	}
	const holdId = placeBet(interaction.user.id, game.key, bet);
	if (holdId === false) return void (await refuse(notEnoughChips(interaction.user.id)));

	await interaction.deferReply();
	await open(
		game,
		interaction.id,
		{ id: interaction.user.id, name: displayName(interaction), holdId },
		vsGolem
			? { id: interaction.client.user.id, name: 'Golem', golem: true }
			: { id: target.id, name: userName(target), golem: false },
		bet,
		(options) => interaction.editReply(options)
	);
}

function find(id: string): Match<unknown, string> | undefined {
	return matches.get(id);
}

async function ephemeral(interaction: ButtonInteraction, content: string): Promise<void> {
	await interaction.reply({ content, flags: MessageFlags.Ephemeral });
}

// Every button a match game has: accept, decline, move and rematch.
export async function handleButton<State, Move extends string>(
	game: MatchGame<State, Move>,
	interaction: ButtonInteraction
): Promise<void> {
	const [, action, matchId, move] = interaction.customId.split(':');
	const match = find(matchId) as Match<State, Move> | undefined;
	if (!match) {
		await interaction.update({ components: [] });
		await interaction.followUp({
			content: `That game has ended. Start a new one with /${game.command}.`,
			flags: MessageFlags.Ephemeral
		});
		return;
	}
	const [first, second] = match.seats;
	const seatOf = (userId: string): Seat | null =>
		first.id === userId && !first.golem ? 0 : second.id === userId && !second.golem ? 1 : null;

	if (action === 'accept' || action === 'decline') {
		if (match.phase !== 'challenge') return void (await interaction.deferUpdate());
		const [challenger, opponent] = match.seats;
		const isOpponent = interaction.user.id === opponent.id;
		const isChallenger = interaction.user.id === challenger.id;
		if (action === 'decline' && (isOpponent || isChallenger)) {
			match.phase = 'over';
			clearTimeout(match.timer);
			matches.delete(match.id);
			refund(challenger, match.bet);
			await interaction.update({
				content: isOpponent
					? `${opponent.name} declined ${challenger.name}'s ${game.label} challenge.`
					: `${challenger.name} withdrew the ${game.label} challenge.`,
				components: [],
				allowedMentions: { parse: [] }
			});
			return;
		}
		if (!isOpponent)
			return void (await ephemeral(interaction, 'This challenge is for someone else.'));
		const blocked = gameBlocked(interaction.guildId, game.key);
		if (blocked) return void (await ephemeral(interaction, blocked));
		const holdId = placeBet(opponent.id, game.key, match.bet);
		if (holdId === false) return void (await ephemeral(interaction, notEnoughChips(opponent.id)));
		opponent.holdId = holdId;
		// Before any await, so a second Accept press finds the challenge already taken.
		match.phase = 'playing';
		clearTimeout(match.timer);
		await interaction.deferUpdate();
		match.edit = (options) => interaction.editReply(options);
		await beginPlay(match);
		return;
	}

	if (action === 'rematch') {
		const seat = seatOf(interaction.user.id);
		if (seat === null)
			return void (await ephemeral(interaction, `Start your own game with /${game.command}.`));
		const blocked = gameBlocked(interaction.guildId, game.key);
		if (blocked) return void (await ephemeral(interaction, blocked));
		if (!claimOnce(interaction.message.id)) return void (await interaction.deferUpdate());
		const holdId = placeBet(interaction.user.id, game.key, match.bet);
		if (holdId === false) {
			release(interaction.message.id);
			return void (await ephemeral(interaction, notEnoughChips(interaction.user.id)));
		}
		const other = match.seats[1 - seat];
		await interaction.update({ components: [] });
		await open(
			game,
			interaction.id,
			{ id: interaction.user.id, name: displayName(interaction), holdId },
			{ id: other.id, name: other.name, golem: other.golem },
			match.bet,
			newMessage(interaction)
		);
		return;
	}

	// A move.
	if (match.phase !== 'playing') return void (await interaction.deferUpdate());
	const seat = seatOf(interaction.user.id);
	if (seat === null)
		return void (await ephemeral(
			interaction,
			`This isn't your game. Start your own with /${game.command}.`
		));
	if (game.turn(match.state) !== seat)
		return void (await ephemeral(interaction, "It isn't your turn."));
	if (!game.legal(match.state, move as Move)) return void (await interaction.deferUpdate());

	game.play(match.state, move as Move);
	match.lastMove = { seat, move: move as Move };
	await interaction.deferUpdate();
	match.edit = (options) => interaction.editReply(options);
	await advance(match);
}
