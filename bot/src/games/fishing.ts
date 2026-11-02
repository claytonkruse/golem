import gifenc from 'gifenc';
import { randomInt } from 'node:crypto';
import { box, colors, image, SANS, svgToPixels, svgToPng, toPng } from '../lib/image.ts';

// /fish: fish swim under a bobber until one bites, then the line pulls tight in one of three
// directions and the player has a moment to pull the same way. Bigger fish fight longer:
// each correct pull sends the line a new way, until the fish is landed or gets away.

export const directions = ['left', 'down', 'right'] as const;
export type Direction = (typeof directions)[number];

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

type Species = {
	name: string;
	rarity: Rarity;
	// Pounds.
	weight: [min: number, max: number];
	color: string;
};

const species: Species[] = [
	{ name: 'Minnow', rarity: 'common', weight: [0.1, 0.3], color: '#9ca3af' },
	{ name: 'Perch', rarity: 'common', weight: [0.3, 1.5], color: '#d9a91a' },
	{ name: 'Bluegill', rarity: 'common', weight: [0.2, 1], color: '#3b82f6' },
	{ name: 'Largemouth Bass', rarity: 'uncommon', weight: [1, 6], color: '#65a30d' },
	{ name: 'Rainbow Trout', rarity: 'uncommon', weight: [1, 5], color: '#f472b6' },
	{ name: 'Catfish', rarity: 'rare', weight: [3, 25], color: '#a8a29e' },
	{ name: 'Salmon', rarity: 'rare', weight: [4, 20], color: '#fb7185' },
	{ name: 'Northern Pike', rarity: 'epic', weight: [5, 25], color: '#84cc16' },
	{ name: 'Golden Koi', rarity: 'legendary', weight: [2, 12], color: '#fbbf24' }
];

// Out of 100: half of all catches are common, one in a hundred is legendary.
const rarityOdds: Record<Rarity, number> = {
	common: 50,
	uncommon: 30,
	rare: 14,
	epic: 5,
	legendary: 1
};

export const rarityColor: Record<Rarity, string> = {
	common: colors.muted,
	uncommon: '#4ade80',
	rare: '#38bdf8',
	epic: '#a78bfa',
	legendary: '#fbbf24'
};

export type Catch = { name: string; rarity: Rarity; pounds: number; color: string };

export function rollCatch(): Catch {
	let roll = randomInt(100);
	let rarity: Rarity = 'common';
	for (const [name, odds] of Object.entries(rarityOdds) as [Rarity, number][]) {
		if (roll < odds) {
			rarity = name;
			break;
		}
		roll -= odds;
	}
	const pool = species.filter((fish) => fish.rarity === rarity);
	const fish = pool[randomInt(pool.length)];
	const [min, max] = fish.weight;
	const pounds = Math.round((min + (max - min) * (randomInt(1000) / 999)) * 10) / 10;
	return { name: fish.name, rarity, pounds, color: fish.color };
}

// A direction other than the last one, so every pull looks different from the one before.
export function randomDirection(previous?: Direction): Direction {
	const choices = directions.filter((direction) => direction !== previous);
	return choices[randomInt(choices.length)];
}

// How many correct pulls it takes to land a fish. Rarer fish fight longer, up to 9.
const pullRange: Record<Rarity, [min: number, max: number]> = {
	common: [1, 3],
	uncommon: [2, 4],
	rare: [3, 6],
	epic: [5, 8],
	legendary: [7, 9]
};

export function pullsFor(rarity: Rarity): number {
	const [min, max] = pullRange[rarity];
	return min + randomInt(max - min + 1);
}

// --- Drawing. The underwater scenes are plain SVG shapes; no text, so no fonts needed.

const W = 560;
const H = 300;
const SURFACE = 64;
const ROD_X = 280;

// A fish facing right, centred on the origin, about 60 wide.
function fishShape(color: string, outline = 'rgba(0,0,0,0.35)'): string {
	return `<path d="M-21,0 L-37,-12 L-33,0 L-37,12 Z" fill="${outline}"/>
		<ellipse cx="0" cy="0" rx="24" ry="11.5" fill="${color}"/>
		<path d="M-6,-10 Q3,-19 11,-9 Z" fill="${outline}"/>
		<circle cx="13" cy="-3" r="2.6" fill="#0b0b0f"/>`;
}

function fishAt(x: number, y: number, scale: number, facing: 1 | -1, color: string): string {
	return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${facing * scale} ${scale})">${fishShape(color)}</g>`;
}

function water(phase: number): string {
	const wave = Array.from({ length: 29 }, (_, i) => {
		const x = i * 20;
		return `${x},${(SURFACE + 3 * Math.sin(x / 38 + phase)).toFixed(1)}`;
	}).join(' L');
	return `<defs>
			<linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
				<stop offset="0" stop-color="#0f4c5f"/><stop offset="1" stop-color="#061a24"/>
			</linearGradient>
		</defs>
		<rect width="${W}" height="${H}" fill="${colors.background}"/>
		<path d="M${wave} L${W},${H} L0,${H} Z" fill="url(#sea)"/>
		<path d="M${wave}" fill="none" stroke="#5eead4" stroke-opacity="0.35" stroke-width="2"/>
		<ellipse cx="${W / 2}" cy="${H + 30}" rx="${W * 0.7}" ry="60" fill="#14232a"/>`;
}

function seaweed(phase: number): string {
	return [70, 120, 430, 495]
		.map((x, i) => {
			const sway = 9 * Math.sin(phase + i * 1.7);
			return `<path d="M${x},${H} Q${x + sway},${H - 40} ${x},${H - 70} T${x + sway * 0.6},${H - 125}" fill="none" stroke="#1f6f4a" stroke-width="7" stroke-linecap="round"/>`;
		})
		.join('');
}

function bobber(y: number): string {
	return `<line x1="${ROD_X}" y1="0" x2="${ROD_X}" y2="${y}" stroke="#e7e2e8" stroke-width="1.5"/>
		<circle cx="${ROD_X}" cy="${y}" r="9" fill="#f7f3f8"/>
		<path d="M${ROD_X - 9},${y} A9,9 0 0 1 ${ROD_X + 9},${y} Z" fill="${colors.accent}"/>`;
}

type Swimmer = {
	cx: number;
	y: number;
	reach: number;
	offset: number;
	scale: number;
	color: string;
};

function randomSwimmers(): Swimmer[] {
	return Array.from({ length: 5 }, () => {
		const fish = species[randomInt(species.length - 1)];
		return {
			cx: 90 + randomInt(380),
			y: 120 + randomInt(140),
			reach: 50 + randomInt(90),
			offset: randomInt(628) / 100,
			scale: 0.7 + randomInt(50) / 100,
			color: fish.color
		};
	});
}

// One frame of the swimming loop, `t` from 0 to 1. Every motion is a whole number of sine
// cycles over the loop, so the GIF repeats without a jump.
function swimFrame(swimmers: Swimmer[], t: number): string {
	const phase = 2 * Math.PI * t;
	const fish = swimmers
		.map((s) => {
			const x = s.cx + s.reach * Math.sin(phase + s.offset);
			const facing = Math.cos(phase + s.offset) >= 0 ? 1 : -1;
			return fishAt(x, s.y + 6 * Math.sin(2 * phase + s.offset), s.scale, facing, s.color);
		})
		.join('');
	const bubbles = [150, 330, 410]
		.map((x, i) => {
			const y = H - ((t + i / 3) % 1) * (H - SURFACE);
			return `<circle cx="${x + 4 * Math.sin(phase * 2 + i)}" cy="${y.toFixed(1)}" r="${3 + i}" fill="none" stroke="#a5f3fc" stroke-opacity="0.5" stroke-width="1.5"/>`;
		})
		.join('');
	const bob = SURFACE + 2 * Math.sin(phase * 2);
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
		${water(phase)}${seaweed(phase)}${bubbles}${fish}
		<line x1="${ROD_X}" y1="${bob}" x2="${ROD_X}" y2="${bob + 70}" stroke="#e7e2e8" stroke-opacity="0.3"/>
		${bobber(bob)}</svg>`;
}

const FRAMES = 30;
const FRAME_MS = 90;

function encodeGif(svgFrames: string[]): Buffer {
	const gif = gifenc.GIFEncoder();
	// One palette from the first frame keeps colours steady across the loop and the file small.
	let palette: number[][] | undefined;
	for (const svg of svgFrames) {
		const { width, height, pixels } = svgToPixels(svg);
		palette ??= gifenc.quantize(pixels, 128);
		const index = gifenc.applyPalette(pixels, palette);
		gif.writeFrame(index, width, height, { palette, delay: FRAME_MS, repeat: 0 });
	}
	gif.finish();
	return Buffer.from(gif.bytes());
}

// A couple of seconds to draw, so the first few casts each draw a new scene and later
// casts reuse one.
const gifPool: Buffer[] = [];
const POOL_SIZE = 4;

export function swimmingGif(): Buffer {
	if (gifPool.length < POOL_SIZE) {
		const swimmers = randomSwimmers();
		const gif = encodeGif(
			Array.from({ length: FRAMES }, (_, i) => swimFrame(swimmers, i / FRAMES))
		);
		gifPool.push(gif);
		return gif;
	}
	return gifPool[randomInt(gifPool.length)];
}

const hookedAt: Record<Direction, [x: number, y: number]> = {
	left: [90, 178],
	down: [ROD_X, 238],
	right: [470, 178]
};

// The bite: the bobber pulled under, ripples, and the line pulled tight to a fish that is
// still only a silhouette.
// Dots in the top-left corner: filled for pulls made, hollow for pulls to go.
function progressDots(done: number, total: number): string {
	return Array.from({ length: total }, (_, i) => {
		const cx = 24 + i * 20;
		return i < done
			? `<circle cx="${cx}" cy="24" r="6" fill="${colors.accent}"/>`
			: `<circle cx="${cx}" cy="24" r="5" fill="none" stroke="${colors.muted}" stroke-width="2"/>`;
	}).join('');
}

export function biteScene(direction: Direction, done = 0, total = 1): Buffer {
	const [fx, fy] = hookedAt[direction];
	const bobY = SURFACE + 16;
	// The fish faces away from the bobber, along the line.
	const angle = (Math.atan2(fy - bobY, fx - ROD_X) * 180) / Math.PI;
	const ripples = [18, 34, 52]
		.map(
			(r, i) =>
				`<ellipse cx="${ROD_X}" cy="${SURFACE}" rx="${r}" ry="${r / 4}" fill="none" stroke="#e0f2fe" stroke-opacity="${0.7 - i * 0.2}" stroke-width="2"/>`
		)
		.join('');
	const splash = [-1, 1]
		.map(
			(side) =>
				`<path d="M${ROD_X + side * 6},${SURFACE - 4} q${side * 10},-18 ${side * 22},-14" fill="none" stroke="#e0f2fe" stroke-width="3" stroke-linecap="round"/>`
		)
		.join('');
	const strain = [0, 1, 2]
		.map((i) => {
			const dx = Math.cos((angle * Math.PI) / 180);
			const dy = Math.sin((angle * Math.PI) / 180);
			const ox = fx + dx * (46 + i * 10) - dy * (i - 1) * 14;
			const oy = fy + dy * (46 + i * 10) + dx * (i - 1) * 14;
			return `<line x1="${ox}" y1="${oy}" x2="${ox + dx * 16}" y2="${oy + dy * 16}" stroke="#e0f2fe" stroke-opacity="0.6" stroke-width="2.5" stroke-linecap="round"/>`;
		})
		.join('');
	return svgToPng(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
		${water(0)}${seaweed(0)}${ripples}${splash}
		<line x1="${ROD_X}" y1="${bobY}" x2="${fx}" y2="${fy}" stroke="#f7f3f8" stroke-width="3"/>
		<g transform="translate(${fx} ${fy}) rotate(${angle.toFixed(1)}) scale(1.4)">${fishShape('#3a7486', '#24515f')}</g>
		${strain}${bobber(bobY)}${total > 1 ? progressDots(done, total) : ''}</svg>`);
}

function fishImage(color: string, faded: boolean): string {
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-40 -22 80 44" width="240" height="132"><g opacity="${faded ? 0.35 : 1}">${fishShape(color)}</g></svg>`;
	return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

// The card shown when a cast ends: the fish and its weight, or the one that got away.
export function resultCard(result: { caught: Catch } | { lost: string }): Promise<Buffer> {
	const PAD = 36;
	const caught = 'caught' in result ? result.caught : null;
	const details = caught
		? [
				box({ fontSize: 20, color: colors.muted, letterSpacing: 2 }, 'YOU CAUGHT'),
				box({ fontSize: 44, fontWeight: 600, color: colors.text, lineHeight: 1.1 }, caught.name),
				box(
					{ gap: 14, alignItems: 'baseline', marginTop: 6 },
					box({ fontSize: 24, color: rarityColor[caught.rarity] }, caught.rarity.toUpperCase()),
					box({ fontSize: 24, color: colors.muted }, `${caught.pounds.toFixed(1)} lb`)
				)
			]
		: [
				box({ fontSize: 20, color: colors.muted, letterSpacing: 2 }, 'IT GOT AWAY'),
				box(
					{ fontSize: 34, fontWeight: 600, color: colors.text, lineHeight: 1.2 },
					(result as { lost: string }).lost
				)
			];
	const tree = box(
		{ width: W, height: H, backgroundColor: colors.background, borderRadius: 28 },
		box(
			{
				width: W - PAD * 2,
				height: H - PAD * 2,
				margin: PAD,
				gap: 24,
				alignItems: 'center',
				fontFamily: SANS
			},
			image(fishImage(caught?.color ?? colors.muted, !caught), 220, 121, { flexShrink: 0 }),
			box({ flexDirection: 'column', flexGrow: 1, minWidth: 0 }, ...details)
		)
	);
	return toPng(tree, W, H);
}
