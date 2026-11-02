import { randomInt } from 'node:crypto';
import { accentGradient, box, colors, image, type Node } from '../lib/image.ts';

// A standard 52-card deck and the playing card drawing every card game shares.

export const suits = ['spades', 'hearts', 'diamonds', 'clubs'] as const;
export const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;

export type Suit = (typeof suits)[number];
export type Rank = (typeof ranks)[number];
export type Card = { rank: Rank; suit: Suit };

// A freshly shuffled deck. Fisher–Yates with crypto randomness, so no order is likelier
// than another.
export function shuffledDeck(): Card[] {
	const deck = suits.flatMap((suit) => ranks.map((rank) => ({ rank, suit })));
	for (let i = deck.length - 1; i > 0; i--) {
		const j = randomInt(i + 1);
		[deck[i], deck[j]] = [deck[j], deck[i]];
	}
	return deck;
}

// Outfit has no suit glyphs, so the symbols are drawn as shapes on a 24×24 grid.
const suitPaths: Record<Suit, string> = {
	hearts:
		'M12 21.3s-7.9-4.9-10-9.7C.4 8 2.7 3.8 6.6 3.8c2.3 0 4.2 1.3 5.4 3.1 1.2-1.8 3.1-3.1 5.4-3.1 3.9 0 6.2 4.2 4.6 7.8-2.1 4.8-10 9.7-10 9.7z',
	diamonds: 'M12 1.5 20.5 12 12 22.5 3.5 12z',
	spades:
		'M12 1.8s-8.1 5.9-10 10.6c-1.5 3.6.8 7.2 4.4 7.2 1.9 0 3.4-.9 4.3-2.2-.3 1.9-1.1 3.4-2.4 4.6h7.4c-1.3-1.2-2.1-2.7-2.4-4.6.9 1.3 2.4 2.2 4.3 2.2 3.6 0 5.9-3.6 4.4-7.2C20.1 7.7 12 1.8 12 1.8z',
	clubs:
		'M12 2a4.6 4.6 0 0 0-4.2 6.5A4.6 4.6 0 1 0 9.7 17c.3-.1.6-.3.9-.5-.3 2-1.1 3.6-2.4 4.8h7.6c-1.3-1.2-2.1-2.8-2.4-4.8.3.2.6.4.9.5a4.6 4.6 0 1 0 1.9-8.5A4.6 4.6 0 0 0 12 2z'
};

function suitColor(suit: Suit): string {
	return suit === 'hearts' || suit === 'diamonds' ? colors.red : colors.text;
}

function suitIcon(suit: Suit, size: number): Node {
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${suitColor(suit)}" d="${suitPaths[suit]}"/></svg>`;
	return image(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`, size, size);
}

export const CARD_WIDTH = 104;
export const CARD_HEIGHT = 146;

// Satori adds padding and borders outside the given size, so each card's content area is
// sized to leave the whole card exactly CARD_WIDTH × CARD_HEIGHT.
function cardFrame(inset: number) {
	return {
		width: CARD_WIDTH - inset * 2,
		height: CARD_HEIGHT - inset * 2,
		flexShrink: 0,
		borderRadius: 14
	};
}

export function cardFace(card: Card): Node {
	const corner = (flip: boolean) =>
		box(
			{
				flexDirection: 'column',
				alignItems: 'center',
				gap: 2,
				...(flip ? { transform: 'rotate(180deg)' } : {})
			},
			box(
				{
					fontSize: card.rank === '10' ? 24 : 28,
					fontWeight: 700,
					lineHeight: 1,
					color: suitColor(card.suit)
				},
				card.rank
			),
			suitIcon(card.suit, 16)
		);
	return box(
		{
			...cardFrame(12),
			flexDirection: 'column',
			justifyContent: 'space-between',
			padding: 10,
			backgroundColor: colors.panel,
			border: `2px solid ${colors.track}`
		},
		box({ justifyContent: 'flex-start' }, corner(false)),
		box({ justifyContent: 'center' }, suitIcon(card.suit, 44)),
		box({ justifyContent: 'flex-end' }, corner(true))
	);
}

// The back of a card: Golem's magenta with a darker inset.
export function cardBack(): Node {
	return box(
		{ ...cardFrame(8), padding: 8, backgroundImage: accentGradient },
		box({
			flexGrow: 1,
			borderRadius: 8,
			border: `2px solid ${colors.accentEnd}`,
			backgroundImage: `repeating-linear-gradient(45deg, ${colors.accent} 0px, ${colors.accent} 6px, #a21caf 6px, #a21caf 12px)`
		})
	);
}

const rankNames: Record<Rank, string> = {
	A: 'Ace',
	J: 'Jack',
	Q: 'Queen',
	K: 'King',
	'2': '2',
	'3': '3',
	'4': '4',
	'5': '5',
	'6': '6',
	'7': '7',
	'8': '8',
	'9': '9',
	'10': '10'
};

// "Queen of hearts", for alt text and messages.
export function cardName(card: Card): string {
	return `${rankNames[card.rank]} of ${card.suit}`;
}

// A card with a magenta ring, for the one that matters right now.
export function highlighted(card: Node): Node {
	return box({ padding: 3, borderRadius: 17, backgroundColor: colors.accent, flexShrink: 0 }, card);
}
