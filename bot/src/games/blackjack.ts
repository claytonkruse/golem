import { formatChips } from '../lib/chips.ts';
import { box, colors, SERIF, toPng, type Node } from '../lib/image.ts';
import { CARD_WIDTH, cardBack, cardFace, shuffledDeck, type Card } from './cards.ts';

// One player against the dealer, for chips. The dealer stands on every 17, a natural
// blackjack on the deal ends the hand at once and pays 3:2, and doubling down is allowed
// on the first two cards. Splitting isn't supported yet.

export type Outcome =
	'blackjack' | 'win' | 'dealer_bust' | 'push' | 'lose' | 'bust' | 'dealer_blackjack';

export type HandValue = { total: number; soft: boolean };

const cardValue = (card: Card) =>
	card.rank === 'A' ? 11 : ['J', 'Q', 'K'].includes(card.rank) ? 10 : Number(card.rank);

// Aces count 11 until that would bust, then 1. "Soft" means an ace still counts 11.
export function handValue(cards: Card[]): HandValue {
	let total = cards.reduce((sum, card) => sum + cardValue(card), 0);
	let softAces = cards.filter((card) => card.rank === 'A').length;
	while (total > 21 && softAces > 0) {
		total -= 10;
		softAces--;
	}
	return { total, soft: softAces > 0 };
}

const isBlackjack = (cards: Card[]) => cards.length === 2 && handValue(cards).total === 21;

export class Blackjack {
	readonly player: Card[] = [];
	readonly dealer: Card[] = [];
	outcome: Outcome | null = null;
	doubled = false;
	readonly #deck: Card[];

	constructor(deck: Card[] = shuffledDeck()) {
		this.#deck = deck;
		this.player.push(this.#draw());
		this.dealer.push(this.#draw());
		this.player.push(this.#draw());
		this.dealer.push(this.#draw());

		if (isBlackjack(this.player) || isBlackjack(this.dealer)) {
			this.outcome = isBlackjack(this.player)
				? isBlackjack(this.dealer)
					? 'push'
					: 'blackjack'
				: 'dealer_blackjack';
		}
	}

	get finished(): boolean {
		return this.outcome !== null;
	}

	#draw(): Card {
		const card = this.#deck.pop();
		if (!card) throw new Error('The deck ran out.');
		return card;
	}

	hit(): void {
		if (this.finished) return;
		this.player.push(this.#draw());
		const { total } = handValue(this.player);
		if (total > 21) this.outcome = 'bust';
		// Nothing to gain by hitting on 21.
		else if (total === 21) this.stand();
	}

	get canDouble(): boolean {
		return !this.finished && this.player.length === 2;
	}

	// One more card for twice the bet, then the hand stands. The caller takes the extra chips.
	doubleDown(): void {
		if (!this.canDouble) return;
		this.doubled = true;
		this.hit();
		this.stand();
	}

	stand(): void {
		if (this.finished) return;
		while (handValue(this.dealer).total < 17) this.dealer.push(this.#draw());
		const player = handValue(this.player).total;
		const dealer = handValue(this.dealer).total;
		this.outcome =
			dealer > 21 ? 'dealer_bust' : player > dealer ? 'win' : player < dealer ? 'lose' : 'push';
	}
}

// Chips returned for a finished hand, including the stake: twice the bet for a win, 3:2 on
// top of the bet for a natural blackjack (rounded down), the bet back for a push.
export function payout(outcome: Outcome, bet: number): number {
	switch (outcome) {
		case 'blackjack':
			return bet + Math.floor(bet * 1.5);
		case 'win':
		case 'dealer_bust':
			return bet * 2;
		case 'push':
			return bet;
		default:
			return 0;
	}
}

export const outcomeText: Record<Outcome, string> = {
	blackjack: 'Blackjack! You win.',
	win: 'You win.',
	dealer_bust: 'Dealer busts. You win.',
	push: 'Push.',
	lose: 'Dealer wins.',
	bust: 'Bust. Dealer wins.',
	dealer_blackjack: 'Dealer has blackjack.'
};

const WIDTH = 934;
const HEIGHT = 548;
const PAD = 32;
const WIN = '#4ade80';

function outcomeColor(outcome: Outcome): string {
	if (outcome === 'push') return colors.muted;
	return ['blackjack', 'win', 'dealer_bust'].includes(outcome) ? WIN : colors.red;
}

// Cards fan out with a small gap, and overlap once a hand no longer fits across.
function hand(cards: Node[]): Node {
	const room = WIDTH - PAD * 2;
	const step =
		cards.length > 1 ? Math.min(CARD_WIDTH + 12, (room - CARD_WIDTH) / (cards.length - 1)) : 0;
	// flexShrink 0 so an empty hand keeps its height while the deal is in progress.
	return box(
		{ height: 146, flexShrink: 0, justifyContent: 'center' },
		...cards.map((card, index) =>
			box({ marginLeft: index === 0 ? 0 : step - CARD_WIDTH, flexShrink: 0 }, card)
		)
	);
}

function label(name: string, score: string): Node {
	return box(
		{ alignItems: 'baseline', justifyContent: 'center', gap: 12, flexShrink: 0 },
		box({ fontSize: 24, fontWeight: 700, color: colors.text }, name),
		// A no-break space keeps the line's height while a hand has no cards yet, so nothing
		// below it jumps when the first card lands.
		box({ fontSize: 22, color: colors.muted }, score || '\u00a0')
	);
}

function score({ total, soft }: HandValue): string {
	return soft && total < 21 ? `${total} (soft)` : String(total);
}

// One frame of the cards going out: how many of each hand's cards are on the table, whether
// the dealer's second card is still face down, and the line shown in the corner. The hand
// is already decided; frames only show it arriving one card at a time.
export type TableView = {
	player: number;
	dealer: number;
	holeHidden: boolean;
	status: string;
};

const DEALING = 'Dealing…';
const DEALER_TURN = "Dealer's turn";

// The opening deal in casino order: player, dealer, player, then the dealer's face-down card.
// The last card arrives with the buttons, except after a natural, where every card is shown
// before the hole card turns over.
export function dealFrames(game: Blackjack): TableView[] {
	const frames: TableView[] = [
		{ player: 1, dealer: 0, holeHidden: true, status: DEALING },
		{ player: 1, dealer: 1, holeHidden: true, status: DEALING },
		{ player: 2, dealer: 1, holeHidden: true, status: DEALING }
	];
	if (game.finished) frames.push({ player: 2, dealer: 2, holeHidden: true, status: DEALING });
	return frames;
}

// After a move that ends the hand without busting: the player's new card, if any, then the
// hole card turning over and each card the dealer draws. A plain hit or a bust shows its one
// new card in the final frame instead.
export function actionFrames(game: Blackjack, playerCardsBefore: number): TableView[] {
	if (!game.finished || game.outcome === 'bust') return [];
	const player = game.player.length;
	const frames: TableView[] = [];
	if (player > playerCardsBefore)
		frames.push({ player, dealer: 2, holeHidden: true, status: DEALING });
	frames.push({ player, dealer: 2, holeHidden: false, status: DEALER_TURN });
	for (let dealer = 3; dealer < game.dealer.length; dealer++) {
		frames.push({ player, dealer, holeHidden: false, status: DEALER_TURN });
	}
	return frames;
}

// `bet` is everything staked on the hand, including a double down, or 0 when playing for fun.
// Without a `view`, the table shows the hand as it stands, with the result once it's over.
export function renderTable(
	game: Blackjack,
	playerName: string,
	bet: number,
	view?: TableView
): Promise<Buffer> {
	// The dealer's second card stays face down until the hand is over.
	const holeHidden = view ? view.holeHidden : !game.finished;
	const dealerShown = view ? game.dealer.slice(0, view.dealer) : game.dealer;
	const playerCards = view ? game.player.slice(0, view.player) : game.player;
	const dealerFaces = holeHidden ? dealerShown.slice(0, 1) : dealerShown;
	const hiddenCards = holeHidden && dealerShown.length >= 2 ? [cardBack()] : [];
	const dealerScore =
		dealerShown.length === 0
			? ''
			: holeHidden && dealerShown.length >= 2
				? `${handValue(dealerFaces).total} + ?`
				: score(handValue(dealerShown));
	// A frame never shows the result; that waits for the last frame.
	const outcome = view ? null : game.outcome;

	const net = outcome ? payout(outcome, bet) - bet : 0;
	// Hands played for fun show the result without a chips line.
	const chipsLine =
		bet === 0
			? []
			: [
					box(
						{ fontSize: 22, color: outcomeColor(outcome ?? 'push') },
						net === 0 ? 'Bet returned' : `${net > 0 ? '+' : '−'}${formatChips(Math.abs(net))}`
					)
				];
	const status = outcome
		? box(
				{ flexDirection: 'column', alignItems: 'flex-end' },
				box(
					{ fontSize: 30, fontWeight: 700, color: outcomeColor(outcome), lineHeight: 1.1 },
					outcomeText[outcome]
				),
				...chipsLine
			)
		: box({ fontSize: 24, color: colors.muted }, view?.status ?? 'Your move.');

	const tree = box(
		{ width: WIDTH, height: HEIGHT, backgroundColor: colors.background, borderRadius: 28 },
		box(
			{
				width: WIDTH - PAD * 2,
				height: HEIGHT - PAD * 2,
				margin: PAD,
				flexDirection: 'column',
				gap: 12,
				fontFamily: SERIF
			},
			box(
				{ justifyContent: 'space-between', alignItems: 'center', height: 64 },
				box(
					{ flexDirection: 'column', gap: 4 },
					box({ fontSize: 20, color: colors.muted, letterSpacing: 2 }, 'BLACKJACK'),
					box(
						{ fontSize: 22, color: colors.text },
						bet === 0
							? 'Just for fun'
							: `Bet ${formatChips(bet)}${game.doubled ? ' (doubled)' : ''}`
					)
				),
				status
			),
			label('DEALER', dealerScore),
			hand([...dealerFaces.map(cardFace), ...hiddenCards]),
			box({ height: 8 }),
			label(playerName, playerCards.length > 0 ? score(handValue(playerCards)) : ''),
			hand(playerCards.map(cardFace))
		)
	);
	return toPng(tree, WIDTH, HEIGHT);
}
