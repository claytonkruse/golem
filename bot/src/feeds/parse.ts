import { XMLParser } from 'fast-xml-parser';

// RSS 2.0, RSS 1.0 (RDF) and Atom, read into one shape.

export type FeedItem = {
	id: string;
	title: string;
	link: string | null;
	published: Date | null;
	summary: string;
	image: string | null;
	// YouTube's feeds name the video and channel.
	videoId: string | null;
	author: string | null;
};

export type ParsedFeed = { title: string; link: string | null; items: FeedItem[] };

const LISTS = new Set([
	'item',
	'entry',
	'link',
	'enclosure',
	'media:content',
	'media:thumbnail',
	'category'
]);

const parser = new XMLParser({
	ignoreAttributes: false,
	attributeNamePrefix: '@_',
	textNodeName: '#text',
	parseTagValue: false,
	parseAttributeValue: false,
	trimValues: true,
	isArray: (name) => LISTS.has(name)
});

type Node = Record<string, unknown>;

function text(value: unknown): string {
	if (value === undefined || value === null) return '';
	if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
	if (Array.isArray(value)) return text(value[0]);
	if (typeof value === 'object' && '#text' in value) return text((value as Node)['#text']);
	return '';
}

function list(value: unknown): Node[] {
	if (value === undefined || value === null) return [];
	return (Array.isArray(value) ? value : [value]).filter(
		(entry): entry is Node => typeof entry === 'object' && entry !== null
	);
}

// RSS links are text; Atom links are elements with rel and href.
function linkOf(value: unknown): string | null {
	const links = Array.isArray(value) ? value : value === undefined ? [] : [value];
	for (const link of links) {
		if (typeof link === 'string' && link.trim()) return link.trim();
	}
	const atom = links.filter((link): link is Node => typeof link === 'object' && link !== null);
	const preferred = atom.find((link) => !link['@_rel'] || link['@_rel'] === 'alternate') ?? atom[0];
	return preferred ? text(preferred['@_href']) || text(preferred) || null : null;
}

const ENTITIES: Record<string, string> = {
	amp: '&',
	lt: '<',
	gt: '>',
	quot: '"',
	apos: "'",
	nbsp: ' '
};

// Descriptions are often HTML. Discord gets plain text.
export function plainText(html: string, max = 300): string {
	const stripped = html
		.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
		.replace(/<br\s*\/?>|<\/p>/gi, '\n')
		.replace(/<[^>]+>/g, ' ')
		.replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (entity, name: string) => {
			if (name.startsWith('#x')) return String.fromCodePoint(parseInt(name.slice(2), 16));
			if (name.startsWith('#')) return String.fromCodePoint(Number(name.slice(1)));
			return ENTITIES[name.toLowerCase()] ?? entity;
		})
		.replace(/[ \t\u00a0]+/g, ' ')
		.replace(/\s*\n\s*/g, '\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
	return stripped.length > max ? `${stripped.slice(0, max - 1).trimEnd()}…` : stripped;
}

function date(...values: unknown[]): Date | null {
	for (const value of values) {
		const parsed = new Date(text(value));
		if (text(value) && !Number.isNaN(parsed.getTime())) return parsed;
	}
	return null;
}

function image(item: Node): string | null {
	const group = (item['media:group'] ?? {}) as Node;
	const candidates = [
		...list(item['media:thumbnail']),
		...list(group['media:thumbnail']),
		...list(item['media:content']).filter(
			(media) => text(media['@_medium']) === 'image' || /^image\//.test(text(media['@_type']))
		),
		...list(item.enclosure).filter((enclosure) => /^image\//.test(text(enclosure['@_type'])))
	];
	for (const candidate of candidates) {
		const url = text(candidate['@_url']);
		if (/^https?:\/\//.test(url)) return url;
	}
	return null;
}

function item(node: Node): FeedItem {
	const link = linkOf(node.link);
	const title = plainText(text(node.title), 256);
	const group = (node['media:group'] ?? {}) as Node;
	const summary = plainText(
		text(node.description) ||
			text(node.summary) ||
			text(node.content) ||
			text(node['content:encoded']) ||
			text(group['media:description'])
	);
	const id = text(node.guid) || text(node.id) || link || title;
	const author = (node.author ?? {}) as Node;
	return {
		id,
		title,
		link,
		published: date(node.pubDate, node.published, node.updated, node['dc:date']),
		summary,
		image: image(node),
		videoId: text(node['yt:videoId']) || null,
		author: text(author.name) || text(node['dc:creator']) || null
	};
}

export function parseFeed(xml: string): ParsedFeed | null {
	let root: Node;
	try {
		root = parser.parse(xml) as Node;
	} catch {
		return null;
	}
	const rss = root.rss as Node | undefined;
	if (rss?.channel) {
		const channel = list(rss.channel)[0] ?? {};
		return {
			title: plainText(text(channel.title), 256),
			link: linkOf(channel.link),
			items: list(channel.item).map(item)
		};
	}
	const rdf = root['rdf:RDF'] as Node | undefined;
	if (rdf) {
		const channel = list(rdf.channel)[0] ?? {};
		return {
			title: plainText(text(channel.title), 256),
			link: linkOf(channel.link),
			items: list(rdf.item).map(item)
		};
	}
	const atom = root.feed as Node | undefined;
	if (atom) {
		return {
			title: plainText(text(atom.title), 256),
			link: linkOf(atom.link),
			items: list(atom.entry).map(item)
		};
	}
	return null;
}

// <link rel="alternate" type="application/rss+xml" href="…"> on an ordinary web page.
export function discoverFeed(html: string, base: URL): URL | null {
	for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
		const attribute = (name: string) =>
			new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i')
				.exec(tag)
				?.slice(1)
				.find((value) => value !== undefined);
		const rel = attribute('rel')?.toLowerCase().split(/\s+/) ?? [];
		const type = attribute('type')?.toLowerCase() ?? '';
		const href = attribute('href');
		if (!rel.includes('alternate') || !href) continue;
		if (!/application\/(rss|atom)\+xml/.test(type)) continue;
		try {
			return new URL(href.replace(/&amp;/g, '&'), base);
		} catch {
			continue;
		}
	}
	return null;
}
