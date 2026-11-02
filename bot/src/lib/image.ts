import { Resvg } from '@resvg/resvg-js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import satori from 'satori';

// Shared by every image Golem draws (level and rank cards, game tables). Satori lays out
// a tree of styled boxes like a small subset of HTML and CSS and turns text into shapes,
// so resvg needs no system fonts to draw it.

export const colors = {
	background: '#17121a',
	panel: '#211a24',
	track: '#352b39',
	text: '#f7f3f8',
	muted: '#a99bad',
	accent: '#c026d3',
	accentEnd: '#e879f9',
	red: '#fb7185'
};

export const accentGradient = `linear-gradient(90deg, ${colors.accent}, ${colors.accentEnd})`;

function load(pkg: string, file: string): Buffer {
	return readFileSync(fileURLToPath(import.meta.resolve(`@fontsource/${pkg}/files/${file}`)));
}

// latin-ext covers accented names; other scripts and emoji fall back to nothing.
function family(name: string, pkg: string, weights: (400 | 600 | 700)[]) {
	return weights.flatMap((weight) =>
		['latin', 'latin-ext'].map((subset) => ({
			name,
			data: load(pkg, `${pkg}-${subset}-${weight}-normal.woff`),
			weight,
			style: 'normal' as const
		}))
	);
}

// Set with fontFamily on any box. Outfit matches the website; the serif is for games.
export const SANS = 'Outfit';
export const SERIF = 'Playfair Display';

const fonts = [
	...family(SANS, 'outfit', [400, 600]),
	...family(SERIF, 'playfair-display', [400, 700])
];

export type Node = { type: string; props: Record<string, unknown> };

// A flex box: satori needs display: flex on anything with more than one child.
export function box(style: Record<string, unknown>, ...children: (Node | string)[]): Node {
	return { type: 'div', props: { style: { display: 'flex', ...style }, children } };
}

export function image(
	src: string,
	width: number,
	height: number,
	style: Record<string, unknown> = {}
): Node {
	return { type: 'img', props: { src, width, height, style } };
}

export async function toPng(tree: Node, width: number, height: number): Promise<Buffer> {
	// satori's types describe React elements; these plain objects have the same shape.
	const svg = await satori(tree as unknown as Parameters<typeof satori>[0], {
		width,
		height,
		fonts
	});
	return new Resvg(svg).render().asPng();
}

// Plain SVG straight to an image, for drawings with no text. Faster than going through
// satori, and resvg needs no fonts when nothing is written.
export function svgToPng(svg: string): Buffer {
	return new Resvg(svg).render().asPng();
}

export function svgToPixels(svg: string): { width: number; height: number; pixels: Buffer } {
	const image = new Resvg(svg).render();
	return { width: image.width, height: image.height, pixels: image.pixels };
}

// Downloads an image, such as an avatar, as a data URL to draw. Null if it can't be had
// within three seconds, so a slow CDN never holds a card up.
export async function imageData(url: string): Promise<string | null> {
	try {
		const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
		if (!response.ok) return null;
		const type = response.headers.get('content-type') ?? 'image/png';
		return `data:${type};base64,${Buffer.from(await response.arrayBuffer()).toString('base64')}`;
	} catch {
		return null;
	}
}
