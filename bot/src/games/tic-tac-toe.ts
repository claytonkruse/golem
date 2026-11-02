import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { randomInt } from 'node:crypto';
import type { MatchGame, Seat, Winner } from '../lib/match.ts';

// Tic-Tac-Toe on Discord's buttons: the nine buttons are the board.

export type Square = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8';

export type TicTacToe = {
	cells: (Seat | null)[];
	turn: Seat;
	winner: Winner;
	line: number[] | null;
};

const lines = [
	[0, 1, 2],
	[3, 4, 5],
	[6, 7, 8],
	[0, 3, 6],
	[1, 4, 7],
	[2, 5, 8],
	[0, 4, 8],
	[2, 4, 6]
];

function create(): TicTacToe {
	return { cells: Array(9).fill(null), turn: 0, winner: null, line: null };
}

function legal(state: TicTacToe, move: string): boolean {
	const i = Number(move);
	return state.winner === null && Number.isInteger(i) && i >= 0 && i < 9 && state.cells[i] === null;
}

function play(state: TicTacToe, move: string): void {
	if (!legal(state, move)) return;
	state.cells[Number(move)] = state.turn;
	const line = lines.find((cells) => cells.every((i) => state.cells[i] === state.turn));
	if (line) {
		state.winner = state.turn;
		state.line = line;
	} else if (state.cells.every((cell) => cell !== null)) {
		state.winner = 'draw';
	}
	state.turn = (1 - state.turn) as Seat;
}

const open = (state: TicTacToe) =>
	state.cells.flatMap((cell, i) => (cell === null ? [String(i) as Square] : []));

function completes(state: TicTacToe, seat: Seat): Square | undefined {
	for (const line of lines) {
		const mine = line.filter((i) => state.cells[i] === seat).length;
		const empty = line.find((i) => state.cells[i] === null);
		if (mine === 2 && empty !== undefined) return String(empty) as Square;
	}
	return undefined;
}

// Wins, blocks, then takes the centre or a corner, but a quarter of the time it plays any
// open square instead, so it can be beaten.
function ai(state: TicTacToe): Square {
	const me = state.turn;
	const choices = open(state);
	if (randomInt(4) === 0) return choices[randomInt(choices.length)];
	const win = completes(state, me);
	if (win) return win;
	const block = completes(state, (1 - me) as Seat);
	if (block) return block;
	if (state.cells[4] === null) return '4';
	const corners = choices.filter((square) => ['0', '2', '6', '8'].includes(square));
	const pool = corners.length > 0 ? corners : choices;
	return pool[randomInt(pool.length)];
}

const names = [
	'the top left',
	'the top middle',
	'the top right',
	'the middle left',
	'the centre',
	'the middle right',
	'the bottom left',
	'the bottom middle',
	'the bottom right'
];

const marks: Record<Seat, string> = { 0: '❌', 1: '⭕' };

export const ticTacToe: MatchGame<TicTacToe, Square> = {
	key: 'tictactoe',
	label: 'Tic-Tac-Toe',
	command: 'tictactoe',
	create,
	turn: (state) => state.turn,
	legal,
	play,
	winner: (state) => state.winner,
	ai,
	describe: (move) => names[Number(move)],
	async view(match) {
		const { state } = match;
		const over = state.winner !== null;
		const winning = new Set(state.line ?? []);
		const rows = [0, 1, 2].map((row) =>
			new ActionRowBuilder<ButtonBuilder>().addComponents(
				[0, 1, 2].map((col) => {
					const i = row * 3 + col;
					const seat = state.cells[i];
					const square = new ButtonBuilder()
						.setCustomId(`tictactoe:move:${match.id}:${i}`)
						.setStyle(winning.has(i) ? ButtonStyle.Success : ButtonStyle.Secondary)
						.setDisabled(over || seat !== null);
					// Buttons need a label or an emoji; an empty square shows a faint dot.
					return seat === null ? square.setLabel('·') : square.setEmoji(marks[seat]);
				})
			)
		);
		return { rows };
	}
};
