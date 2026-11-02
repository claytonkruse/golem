import { formatChips } from '../lib/chips.ts';
import { box, colors, SERIF, toPng, type Node } from '../lib/image.ts';
import { CARD_WIDTH, cardFace, highlighted, shuffledDeck, type Card, type Rank } from './cards.ts';

// Golem shows a card and the player guesses whether the next is higher or lower. Aces are
// high, and a tie is drawn again with nothing lost. Each correct guess multiplies the
// payout by the inverse of the chance it had, less a 3% edge, so long shots pay more.
// The player can cash out after any correct guess.

export type Guess = 'higher' | 'lower';
export type Outcome = 'lost' | 'cashed';

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

const EDGE = 0.97;
// A streak stops here and cashes out, so one lucky run can't create millions of chips.
export const MAX_MULTIPLIER = 100;

export class HigherLower {
	readonly history: Card[] = [];
	current: Card;
	multiplier = 1;
	correct = 0;
	outcome: Outcome | null = null;
	// What happened on the last guess, for the status line.
	last: { guess: Guess; result: 'win' | 'tie' | 'loss' } | null = null;
	readonly #deck: Card[];

	constructor(deck: Card[] = shuffledDeck()) {
		this.#deck = deck;
		this.current = this.#draw();
	}

	get finished(): boolean {
		return this.outcome !== null;
	}

	#draw(): Card {
		const card = this.#deck.pop();
		if (!card) throw new Error('The deck ran out.');
		return card;
	}

	// The chance a guess wins, counting only the cards left. Ties are redrawn, so they
	// don't count either way.
	chance(guess: Guess): number {
		const here = value[this.current.rank];
		let higher = 0;
		let lower = 0;
		for (const card of this.#deck) {
			if (value[card.rank] > here) higher++;
			else if (value[card.rank] < here) lower++;
		}
		const total = higher + lower;
		if (total === 0) return 0;
		return (guess === 'higher' ? higher : lower) / total;
	}

	// What a correct guess multiplies the payout by. A sure thing never lowers it.
	gain(guess: Guess): number {
		const chance = this.chance(guess);
		return chance === 0 ? 0 : Math.max(1, EDGE / chance);
	}

	guess(guess: Guess): void {
		if (this.finished || this.chance(guess) === 0) return;
		const gain = this.gain(guess);
		const before = value[this.current.rank];
		this.history.push(this.current);
		this.current = this.#draw();
		const after = value[this.current.rank];

		if (after === before) {
			this.last = { guess, result: 'tie' };
		} else if ((guess === 'higher') === after > before) {
			this.last = { guess, result: 'win' };
			this.correct++;
			this.multiplier = Math.min(MAX_MULTIPLIER, this.multiplier * gain);
			if (this.multiplier >= MAX_MULTIPLIER) this.outcome = 'cashed';
		} else {
			this.last = { guess, result: 'loss' };
			this.outcome = 'lost';
		}
		// Every card has been seen; nothing left to guess.
		if (!this.finished && this.#deck.length === 0) this.outcome = 'cashed';
	}

	cashOut(): void {
		if (!this.finished) this.outcome = 'cashed';
	}

	// Chips returned for the bet, including the stake.
	payout(bet: number): number {
		return this.outcome === 'cashed' ? Math.floor(bet * this.multiplier) : 0;
	}
}

export function formatMultiplier(multiplier: number): string {
	return `×${multiplier.toFixed(2)}`;
}

const WIDTH = 934;
const HEIGHT = 330;
const PAD = 32;

// Earlier cards fan out to the left and overlap; the current card is ringed in magenta.
function row(game: HigherLower): Node {
	const earlier = game.history.slice(-6);
	const step = earlier.length > 3 ? CARD_WIDTH * 0.45 : CARD_WIDTH + 12;
	return box(
		{ justifyContent: 'center', alignItems: 'center', height: 152, flexShrink: 0 },
		...earlier.map((card, index) =>
			box(
				{ marginLeft: index === 0 ? 0 : step - CARD_WIDTH, opacity: 0.55, flexShrink: 0 },
				cardFace(card)
			)
		),
		box(
			{ marginLeft: earlier.length > 0 ? 28 : 0, flexShrink: 0 },
			highlighted(cardFace(game.current))
		)
	);
}

// `bet` is 0 when playing for fun.
export function renderTable(game: HigherLower, playerName: string, bet: number): Promise<Buffer> {
	let status: Node;
	if (game.outcome === 'lost') {
		status = box(
			{ flexDirection: 'column', alignItems: 'flex-end' },
			box({ fontSize: 30, fontWeight: 700, color: colors.red, lineHeight: 1.1 }, 'Wrong guess.'),
			...(bet > 0 ? [box({ fontSize: 22, color: colors.red }, `−${formatChips(bet)}`)] : [])
		);
	} else if (game.outcome === 'cashed') {
		const net = game.payout(bet) - bet;
		status = box(
			{ flexDirection: 'column', alignItems: 'flex-end' },
			box(
				{ fontSize: 30, fontWeight: 700, color: '#4ade80', lineHeight: 1.1 },
				`Cashed out at ${formatMultiplier(game.multiplier)}`
			),
			...(bet > 0
				? [
						box(
							{ fontSize: 22, color: '#4ade80' },
							`${net >= 0 ? '+' : '−'}${formatChips(Math.abs(net))}`
						)
					]
				: [])
		);
	} else {
		status = box(
			{ flexDirection: 'column', alignItems: 'flex-end' },
			box(
				{ fontSize: 30, fontWeight: 700, color: colors.text, lineHeight: 1.1 },
				formatMultiplier(game.multiplier)
			),
			box(
				{ fontSize: 22, color: colors.muted },
				game.last?.result === 'tie' ? 'A tie. Guess again.' : 'Higher or lower?'
			)
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
				gap: 18,
				fontFamily: SERIF
			},
			box(
				{ justifyContent: 'space-between', alignItems: 'center', height: 64, flexShrink: 0 },
				box(
					{ flexDirection: 'column', gap: 4 },
					box({ fontSize: 20, color: colors.muted, letterSpacing: 2 }, 'HIGHER OR LOWER'),
					box(
						{ fontSize: 22, color: colors.text },
						bet === 0 ? `${playerName}, just for fun` : `${playerName}, bet ${formatChips(bet)}`
					)
				),
				status
			),
			row(game)
		)
	);
	return toPng(tree, WIDTH, HEIGHT);
}
