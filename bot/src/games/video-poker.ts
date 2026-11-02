import { formatChips } from '../lib/chips.ts';
import { box, colors, SERIF, toPng, type Node } from '../lib/image.ts';
import { cardFace, shuffledDeck, type Card, type Rank } from './cards.ts';

// Jacks or Better on the common 9/6 paytable: five cards, hold any of them, draw once.

const value: Record<Rank, number> = {
	'2': 2,
	'3': 3,
	'4': 4,
	'5': 5,
	'6': 6,
	'7': 7,
	'8': 8,
	'9': 9,
	'10': 10,
	J: 11,
	Q: 12,
	K: 13,
	A: 14
};

// Chips returned per chip bet, including the stake. Jacks or Better gives the bet back.
export const paytable = [
	{ hand: 'Royal Flush', pays: 800 },
	{ hand: 'Straight Flush', pays: 50 },
	{ hand: 'Four of a Kind', pays: 25 },
	{ hand: 'Full House', pays: 9 },
	{ hand: 'Flush', pays: 6 },
	{ hand: 'Straight', pays: 4 },
	{ hand: 'Three of a Kind', pays: 3 },
	{ hand: 'Two Pair', pays: 2 },
	{ hand: 'Jacks or Better', pays: 1 }
] as const;

export type HandName = (typeof paytable)[number]['hand'];

// The best paying hand in five cards, or null when it pays nothing.
export function evaluate(cards: Card[]): HandName | null {
	const values = cards.map((card) => value[card.rank]).sort((a, b) => a - b);
	const counts = [
		...new Map(values.map((v) => [v, values.filter((x) => x === v).length])).values()
	].sort((a, b) => b - a);
	const flush = cards.every((card) => card.suit === cards[0].suit);
	const distinct = new Set(values).size === 5;
	// Ace-low straight: A-2-3-4-5.
	const wheel = values.join() === '2,3,4,5,14';
	const straight = distinct && (values[4] - values[0] === 4 || wheel);

	if (straight && flush) return values[0] === 10 ? 'Royal Flush' : 'Straight Flush';
	if (counts[0] === 4) return 'Four of a Kind';
	if (counts[0] === 3 && counts[1] === 2) return 'Full House';
	if (flush) return 'Flush';
	if (straight) return 'Straight';
	if (counts[0] === 3) return 'Three of a Kind';
	if (counts[0] === 2 && counts[1] === 2) return 'Two Pair';
	if (counts[0] === 2) {
		const pair = values.find((v) => values.filter((x) => x === v).length === 2) ?? 0;
		if (pair >= value.J) return 'Jacks or Better';
	}
	return null;
}

export class VideoPoker {
	readonly hand: Card[] = [];
	readonly held = [false, false, false, false, false];
	drawn = false;
	readonly #deck: Card[];

	constructor(deck: Card[] = shuffledDeck()) {
		this.#deck = deck;
		for (let i = 0; i < 5; i++) this.hand.push(this.#draw());
	}

	#draw(): Card {
		const card = this.#deck.pop();
		if (!card) throw new Error('The deck ran out.');
		return card;
	}

	toggle(index: number): void {
		if (!this.drawn && index >= 0 && index < 5) this.held[index] = !this.held[index];
	}

	// Replaces every card not held. Only once per game.
	draw(): void {
		if (this.drawn) return;
		for (let i = 0; i < 5; i++) if (!this.held[i]) this.hand[i] = this.#draw();
		this.drawn = true;
	}

	get result(): HandName | null {
		return evaluate(this.hand);
	}

	// Chips returned for the bet after the draw, including the stake.
	payout(bet: number): number {
		const hand = this.result;
		return hand ? bet * (paytable.find((row) => row.hand === hand)?.pays ?? 0) : 0;
	}
}

const WIDTH = 934;
const HEIGHT = 360;
const PAD = 32;
const WIN = '#4ade80';

function cards(game: VideoPoker): Node {
	return box(
		{ gap: 10, flexShrink: 0 },
		...game.hand.map((card, index) =>
			box(
				{ flexDirection: 'column', alignItems: 'center', gap: 8, flexShrink: 0 },
				cardFace(card),
				box(
					{
						fontSize: 16,
						letterSpacing: 2,
						color: game.held[index] ? colors.accentEnd : 'transparent'
					},
					'HELD'
				)
			)
		)
	);
}

function paytableColumn(highlight: HandName | null): Node {
	return box(
		{ flexDirection: 'column', gap: 3, width: 270, flexShrink: 0 },
		...paytable.map((row) => {
			const color = row.hand === highlight ? WIN : colors.muted;
			return box(
				{ justifyContent: 'space-between', fontSize: 17, color },
				box({}, row.hand),
				box({}, `×${row.pays}`)
			);
		})
	);
}

// `bet` is 0 when playing for fun.
export function renderTable(game: VideoPoker, playerName: string, bet: number): Promise<Buffer> {
	const result = game.drawn ? game.result : null;
	let status: Node;
	if (!game.drawn) {
		status = box({ fontSize: 24, color: colors.muted }, 'Hold cards, then draw.');
	} else {
		const net = game.payout(bet) - bet;
		const color = result ? WIN : colors.red;
		status = box(
			{ flexDirection: 'column', alignItems: 'flex-end' },
			box({ fontSize: 30, fontWeight: 700, color, lineHeight: 1.1 }, result ?? 'No win.'),
			...(bet > 0
				? [
						box(
							{ fontSize: 22, color: net === 0 ? colors.muted : color },
							net === 0 ? 'Bet returned' : `${net > 0 ? '+' : '−'}${formatChips(Math.abs(net))}`
						)
					]
				: [])
		);
	}

	const tree = box(
		{ width: WIDTH, height: HEIGHT, backgroundColor: colors.background, borderRadius: 28 },
		box(
			{
				width: WIDTH - PAD * 2,
				height: HEIGHT - PAD * 2,
				margin: PAD,
				flexDirection: 'column',
				gap: 20,
				fontFamily: SERIF
			},
			box(
				{ justifyContent: 'space-between', alignItems: 'center', height: 64, flexShrink: 0 },
				box(
					{ flexDirection: 'column', gap: 4 },
					box({ fontSize: 20, color: colors.muted, letterSpacing: 2 }, 'VIDEO POKER'),
					box(
						{ fontSize: 22, color: colors.text },
						bet === 0 ? `${playerName}, just for fun` : `${playerName}, bet ${formatChips(bet)}`
					)
				),
				status
			),
			box(
				{ justifyContent: 'space-between', alignItems: 'flex-start' },
				cards(game),
				paytableColumn(result)
			)
		)
	);
	return toPng(tree, WIDTH, HEIGHT);
}
