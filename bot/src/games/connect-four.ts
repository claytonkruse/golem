import { ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { randomInt } from 'node:crypto';
import { formatChips } from '../lib/chips.ts';
import { box, colors, image, SANS, toPng, type Node } from '../lib/image.ts';
import type { Match, MatchGame, Seat, Winner } from '../lib/match.ts';

export const COLS = 7;
export const ROWS = 6;

export type Column = '0' | '1' | '2' | '3' | '4' | '5' | '6';

export type ConnectFour = {
	// Each column from the bottom up.
	columns: Seat[][];
	turn: Seat;
	winner: Winner;
	line: [col: number, row: number][] | null;
};

const directions = [
	[1, 0],
	[0, 1],
	[1, 1],
	[1, -1]
] as const;

function at(state: ConnectFour, col: number, row: number): Seat | undefined {
	return state.columns[col]?.[row];
}

// The four (or more) in a row through a disc, if there is one.
function lineThrough(state: ConnectFour, col: number, row: number): [number, number][] | null {
	const seat = at(state, col, row);
	if (seat === undefined) return null;
	for (const [dc, dr] of directions) {
		const cells: [number, number][] = [[col, row]];
		for (const sign of [1, -1]) {
			let c = col + dc * sign;
			let r = row + dr * sign;
			while (at(state, c, r) === seat) {
				cells.push([c, r]);
				c += dc * sign;
				r += dr * sign;
			}
		}
		if (cells.length >= 4) return cells;
	}
	return null;
}

function create(): ConnectFour {
	return { columns: Array.from({ length: COLS }, () => []), turn: 0, winner: null, line: null };
}

function legal(state: ConnectFour, move: string): boolean {
	const col = Number(move);
	return (
		state.winner === null &&
		Number.isInteger(col) &&
		col >= 0 &&
		col < COLS &&
		state.columns[col].length < ROWS
	);
}

function play(state: ConnectFour, move: string): void {
	if (!legal(state, move)) return;
	const col = Number(move);
	state.columns[col].push(state.turn);
	const line = lineThrough(state, col, state.columns[col].length - 1);
	if (line) {
		state.winner = state.turn;
		state.line = line;
	} else if (state.columns.every((column) => column.length === ROWS)) {
		state.winner = 'draw';
	}
	state.turn = (1 - state.turn) as Seat;
}

function copy(state: ConnectFour): ConnectFour {
	return { ...state, columns: state.columns.map((column) => [...column]) };
}

const moves = (state: ConnectFour) =>
	(['0', '1', '2', '3', '4', '5', '6'] as Column[]).filter((move) => legal(state, move));

function winsWith(state: ConnectFour, move: Column, seat: Seat): boolean {
	const next = copy(state);
	next.turn = seat;
	play(next, move);
	return next.winner === seat;
}

// Wins when it can, blocks when it must, avoids setting up the opponent's win, and
// otherwise leans toward the middle with some randomness. Good enough to be a fair game.
function ai(state: ConnectFour): Column {
	const me = state.turn;
	const them = (1 - me) as Seat;
	const options = moves(state);
	const win = options.find((move) => winsWith(state, move, me));
	if (win) return win;
	const block = options.find((move) => winsWith(state, move, them));
	if (block) return block;
	const safe = options.filter((move) => {
		const next = copy(state);
		play(next, move);
		return !moves(next).some((reply) => winsWith(next, reply, them));
	});
	const pool = safe.length > 0 ? safe : options;
	const score = (move: Column) => 10 - Math.abs(Number(move) - 3) * 2 + randomInt(4);
	return pool.reduce((best, move) => (score(move) > score(best) ? move : best));
}

// --- Drawing

const CELL = 62;
const DISC_COLOR: Record<Seat, string> = { 0: '#d946ef', 1: '#fbbf24' };

function boardSvg(state: ConnectFour, last: number | null): string {
	const width = COLS * CELL + 16;
	const height = ROWS * CELL + 16;
	const winning = new Set(state.line?.map(([c, r]) => `${c},${r}`));
	const cells: string[] = [];
	for (let col = 0; col < COLS; col++) {
		for (let row = 0; row < ROWS; row++) {
			const cx = 8 + col * CELL + CELL / 2;
			const cy = 8 + (ROWS - 1 - row) * CELL + CELL / 2;
			const seat = at(state, col, row);
			cells.push(
				`<circle cx="${cx}" cy="${cy}" r="${CELL / 2 - 6}" fill="${seat === undefined ? colors.background : DISC_COLOR[seat]}"/>`
			);
			if (winning.has(`${col},${row}`)) {
				cells.push(
					`<circle cx="${cx}" cy="${cy}" r="${CELL / 2 - 3}" fill="none" stroke="#f7f3f8" stroke-width="4"/>`
				);
			} else if (last === col && row === state.columns[col].length - 1) {
				cells.push(
					`<circle cx="${cx}" cy="${cy}" r="7" fill="${colors.background}" fill-opacity="0.45"/>`
				);
			}
		}
	}
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
		<rect width="${width}" height="${height}" rx="18" fill="${colors.panel}" stroke="${colors.track}" stroke-width="2"/>
		${cells.join('')}</svg>`;
}

const WIDTH = 934;
const HEIGHT = 556;
const PAD = 32;

function playerLabel(name: string, seat: Seat, active: boolean): Node {
	return box(
		{ alignItems: 'center', gap: 10, opacity: active ? 1 : 0.6 },
		box({ width: 18, height: 18, borderRadius: 9, backgroundColor: DISC_COLOR[seat] }),
		box({ fontSize: 24, fontWeight: active ? 600 : 400, color: colors.text }, name)
	);
}

async function render(match: Match<ConnectFour, Column>): Promise<Buffer> {
	const { state, seats, bet } = match;
	const last = match.lastMove ? Number(match.lastMove.move) : null;
	const svg = boardSvg(state, last);
	const boardWidth = COLS * CELL + 16;
	const status =
		state.winner === null
			? `${seats[state.turn].name}'s turn`
			: state.winner === 'draw'
				? 'Draw'
				: `${seats[state.winner].name} wins`;
	const tree = box(
		{ width: WIDTH, height: HEIGHT, backgroundColor: colors.background, borderRadius: 28 },
		box(
			{
				width: WIDTH - PAD * 2,
				height: HEIGHT - PAD * 2,
				margin: PAD,
				flexDirection: 'column',
				gap: 14,
				fontFamily: SANS
			},
			box(
				{ justifyContent: 'space-between', alignItems: 'center', height: 56, flexShrink: 0 },
				box(
					{ flexDirection: 'column', gap: 6 },
					box(
						{ fontSize: 20, color: colors.muted, letterSpacing: 2 },
						bet > 0 ? `CONNECT FOUR · ${formatChips(bet).toUpperCase()} EACH` : 'CONNECT FOUR'
					),
					box(
						{ gap: 24 },
						playerLabel(
							seats[0].name,
							0,
							state.winner === null ? state.turn === 0 : state.winner === 0
						),
						playerLabel(
							seats[1].name,
							1,
							state.winner === null ? state.turn === 1 : state.winner === 1
						)
					)
				),
				box(
					{
						fontSize: 28,
						fontWeight: 600,
						color: state.winner === null ? colors.muted : colors.text
					},
					status
				)
			),
			box(
				{ flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0 },
				image(
					`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`,
					boardWidth,
					ROWS * CELL + 16
				),
				box(
					{ width: boardWidth, paddingLeft: 8, paddingRight: 8 },
					...Array.from({ length: COLS }, (_, col) =>
						box(
							{ width: CELL, justifyContent: 'center', fontSize: 20, color: colors.muted },
							String(col + 1)
						)
					)
				)
			)
		)
	);
	return toPng(tree, WIDTH, HEIGHT);
}

export const connectFour: MatchGame<ConnectFour, Column> = {
	key: 'connect4',
	label: 'Connect Four',
	command: 'connect4',
	create,
	turn: (state) => state.turn,
	legal,
	play,
	winner: (state) => state.winner,
	ai,
	describe: (move) => `column ${Number(move) + 1}`,
	async view(match) {
		const over = match.state.winner !== null;
		const buttonFor = (col: number) =>
			new ButtonBuilder()
				.setCustomId(`connect4:move:${match.id}:${col}`)
				.setLabel(String(col + 1))
				.setStyle(ButtonStyle.Secondary)
				.setDisabled(over || match.state.columns[col].length >= ROWS);
		const rows = over
			? []
			: [
					new ActionRowBuilder<ButtonBuilder>().addComponents([0, 1, 2, 3].map(buttonFor)),
					new ActionRowBuilder<ButtonBuilder>().addComponents([4, 5, 6].map(buttonFor))
				];
		const description = `Connect Four between ${match.seats[0].name} and ${match.seats[1].name}.`;
		return {
			files: [new AttachmentBuilder(await render(match), { name: 'connect4.png', description })],
			rows
		};
	}
};
