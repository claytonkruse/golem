import type { APIEmbed } from 'discord.js';
import type { FeedState } from '../db/schema.ts';
import { FeedError, fetchPublic } from './fetch.ts';
import type { FeedKeys } from './keys.ts';
import { kickChannelById, kickChannelBySlug, kickLiveSession } from './kick.ts';
import { discoverFeed, parseFeed, plainText, type FeedItem, type ParsedFeed } from './parse.ts';
import { twitchStream, twitchUser, type TwitchStream } from './twitch.ts';

// What Golem can follow, how a typed-in name becomes something to check, and what a check
// posts.

export const feedKinds = {
	rss: {
		label: 'RSS or Atom',
		input: 'Feed or website link',
		placeholder: 'https://example.com/feed.xml',
		help: 'A feed link, or a website that links to its feed. New posts are checked every 10 minutes.',
		everyMs: 10 * 60_000
	},
	youtube: {
		label: 'YouTube',
		input: 'Channel',
		placeholder: '@handle or youtube.com/@handle',
		help: 'A channel handle or link. New videos are checked every 10 minutes.',
		everyMs: 10 * 60_000
	},
	twitch: {
		label: 'Twitch',
		input: 'Streamer',
		placeholder: 'username or twitch.tv/username',
		help: 'Posts when the streamer goes live. Checked every 2 minutes.',
		everyMs: 2 * 60_000
	},
	kick: {
		label: 'Kick',
		input: 'Streamer',
		placeholder: 'username or kick.com/username',
		help: 'Posts when the streamer goes live. Checked every 2 minutes.',
		everyMs: 2 * 60_000
	}
} as const;

export type FeedKind = keyof typeof feedKinds;

export function isFeedKind(value: string): value is FeedKind {
	return Object.hasOwn(feedKinds, value);
}

// Twitch and Kick need keys; the others always work.
export function feedKindAvailable(kind: FeedKind, keys: FeedKeys): boolean {
	return kind === 'twitch' ? keys.twitch !== null : kind === 'kick' ? keys.kick !== null : true;
}

export const KEY_NAMES = {
	twitch: 'TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET',
	kick: 'KICK_CLIENT_ID and KICK_CLIENT_SECRET'
} as const;

export type FeedSourceInfo = {
	kind: FeedKind;
	key: string;
	title: string;
	url: string;
	state: FeedState;
};

export type FeedPost = { content?: string; embeds?: APIEmbed[] };

export type FeedCheck = Omit<FeedSourceInfo, 'kind' | 'key'> & { posts: FeedPost[] };

// At most this many posts per check, so a feed that renumbers its items can't flood a channel.
const MAX_POSTS = 5;
// Item ids remembered per feed. More than any feed lists at once.
const MAX_SEEN = 500;

const RSS_COLOR = 0xf26522;
const TWITCH_COLOR = 0x9146ff;
const KICK_COLOR = 0x53fc18;

const FEED_ACCEPT =
	'application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.9, text/html;q=0.8, */*;q=0.5';

function withScheme(input: string): string {
	return /^[a-z][\w+.-]*:\/\//i.test(input) ? input : `https://${input}`;
}

async function getFeed(
	url: string | URL
): Promise<{ url: URL; feed: ParsedFeed | null; body: string }> {
	const fetched = await fetchPublic(url, { accept: FEED_ACCEPT });
	if (fetched.status === 404 || fetched.status === 410) {
		throw new FeedError(`Nothing was found at ${fetched.url.hostname}${fetched.url.pathname}.`);
	}
	if (fetched.status >= 400)
		throw new FeedError(`${fetched.url.hostname} answered ${fetched.status}.`);
	return { url: fetched.url, feed: parseFeed(fetched.body), body: fetched.body };
}

// Items not seen before, oldest first, and the ids to remember. A feed checked for the first
// time posts nothing: subscribing shouldn't replay its history.
function fresh(items: FeedItem[], seen: string[] | undefined) {
	const ids = items.map((entry) => entry.id).filter(Boolean);
	const remembered = [...new Set([...ids, ...(seen ?? [])])].slice(0, MAX_SEEN);
	if (!seen) return { items: [], seen: remembered };
	const known = new Set(seen);
	let unseen = items.filter((entry) => entry.id && !known.has(entry.id));
	if (unseen.every((entry) => entry.published)) {
		unseen = unseen.toSorted((a, b) => a.published!.getTime() - b.published!.getTime());
	} else {
		// Feeds list their newest first.
		unseen = unseen.toReversed();
	}
	return { items: unseen.slice(-MAX_POSTS), seen: remembered };
}

const isWebLink = (link: string | null): link is string =>
	link !== null && /^https?:\/\//i.test(link);

function articlePost(feedTitle: string, entry: FeedItem): FeedPost {
	return {
		embeds: [
			{
				color: RSS_COLOR,
				author: { name: feedTitle.slice(0, 256) },
				title: (entry.title || 'Untitled').slice(0, 256),
				url: isWebLink(entry.link) ? entry.link : undefined,
				description: entry.summary || undefined,
				image: entry.image ? { url: entry.image } : undefined,
				timestamp: entry.published?.toISOString()
			}
		]
	};
}

// ---- RSS and Atom ----

async function resolveRss(input: string): Promise<FeedSourceInfo> {
	const page = await getFeed(withScheme(input));
	let { url, feed } = page;
	if (!feed) {
		const found = discoverFeed(page.body, url);
		if (!found) throw new FeedError("Golem couldn't find a feed at that link.");
		({ url, feed } = await getFeed(found));
		if (!feed) throw new FeedError("The feed that page links to couldn't be read.");
	}
	return {
		kind: 'rss',
		key: url.href,
		title: feed.title || url.hostname,
		url: isWebLink(feed.link) ? feed.link : url.href,
		state: fresh(feed.items, undefined)
	};
}

async function checkRss(source: FeedSourceInfo): Promise<FeedCheck> {
	const { feed } = await getFeed(source.key);
	if (!feed) throw new FeedError("The feed couldn't be read.");
	const title = feed.title || source.title;
	const { items, seen } = fresh(feed.items, source.state.seen);
	return {
		title,
		url: isWebLink(feed.link) ? feed.link : source.url,
		state: { seen },
		posts: items.map((entry) => articlePost(title, entry))
	};
}

// ---- YouTube ----

const CHANNEL_ID = /^UC[\w-]{22}$/;
const youtubeFeed = (channelId: string) =>
	`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
const youtubeChannel = (channelId: string) => `https://www.youtube.com/channel/${channelId}`;

// "@handle", "youtube.com/@handle", "youtube.com/channel/UC…", "/c/name" or "/user/name".
async function youtubeChannelId(input: string): Promise<string> {
	if (CHANNEL_ID.test(input)) return input;
	let url: URL;
	if (/^@?[\w.-]+$/.test(input)) {
		url = new URL(`https://www.youtube.com/${input.startsWith('@') ? input : `@${input}`}`);
	} else {
		try {
			url = new URL(withScheme(input));
		} catch {
			throw new FeedError("That isn't a YouTube channel.");
		}
		if (!/(^|\.)youtube\.com$/.test(url.hostname))
			throw new FeedError("That isn't a YouTube link.");
		const fromQuery = url.searchParams.get('channel_id');
		if (fromQuery && CHANNEL_ID.test(fromQuery)) return fromQuery;
		const fromPath = /^\/channel\/(UC[\w-]{22})/.exec(url.pathname)?.[1];
		if (fromPath) return fromPath;
		if (!/^\/(@[\w.-]+|c\/[^/]+|user\/[^/]+)/.test(url.pathname)) {
			throw new FeedError('Use a channel link like youtube.com/@handle, not a video link.');
		}
	}
	// SOCS skips the cookie consent page YouTube shows servers in the EU.
	const page = await fetchPublic(url, { cookie: 'SOCS=CAI', 'accept-language': 'en' });
	if (page.status === 404) throw new FeedError("Golem couldn't find that YouTube channel.");
	if (page.status >= 400) throw new FeedError(`YouTube answered ${page.status}.`);
	const id =
		/<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{22})"/.exec(
			page.body
		)?.[1] ?? /"externalId":"(UC[\w-]{22})"/.exec(page.body)?.[1];
	if (!id) throw new FeedError("Golem couldn't find that YouTube channel.");
	return id;
}

// YouTube's feeds answer 404 now and then for channels that have them, so adding a channel
// tries a few times before giving up on the feed.
async function youtubeFeedWithRetries(channelId: string): Promise<ParsedFeed | null> {
	for (let attempt = 0; attempt < 3; attempt++) {
		if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 750));
		const fetched = await fetchPublic(youtubeFeed(channelId));
		if (fetched.status === 404) continue;
		if (fetched.status >= 400) throw new FeedError(`YouTube answered ${fetched.status}.`);
		const feed = parseFeed(fetched.body);
		if (feed) return feed;
	}
	return null;
}

// The channel's name from its page, for when the feed won't answer.
async function youtubeChannelName(channelId: string): Promise<string | null> {
	const page = await fetchPublic(youtubeChannel(channelId), {
		cookie: 'SOCS=CAI',
		'accept-language': 'en'
	});
	if (page.status === 404) throw new FeedError("Golem couldn't find that YouTube channel.");
	const name = /<meta property="og:title" content="([^"]*)"/.exec(page.body)?.[1];
	return name ? plainText(name, 256) : null;
}

async function resolveYoutube(input: string): Promise<FeedSourceInfo> {
	const channelId = await youtubeChannelId(input.trim());
	const feed = await youtubeFeedWithRetries(channelId);
	return {
		kind: 'youtube',
		key: channelId,
		title: feed?.title || (await youtubeChannelName(channelId)) || 'YouTube channel',
		url: youtubeChannel(channelId),
		// Without the feed, the first check that gets it records what's there without posting.
		state: feed ? { seen: fresh(feed.items, undefined).seen } : {}
	};
}

async function checkYoutube(source: FeedSourceInfo): Promise<FeedCheck> {
	const fetched = await fetchPublic(youtubeFeed(source.key));
	// Usually YouTube's own hiccup; the next check tries again.
	if (fetched.status === 404) return { ...source, posts: [] };
	if (fetched.status >= 400) throw new FeedError(`YouTube answered ${fetched.status}.`);
	const feed = parseFeed(fetched.body);
	if (!feed) throw new FeedError("YouTube's feed couldn't be read.");
	const title = feed.title || source.title;
	const { items, seen } = fresh(feed.items, source.state.seen);
	return {
		title,
		url: source.url,
		state: { seen },
		posts: items.map((entry) => {
			const link = entry.videoId
				? `https://www.youtube.com/watch?v=${entry.videoId}`
				: (entry.link ?? source.url);
			// Discord shows YouTube links as a playable video.
			return { content: `**${title}** posted a new video\n${link}` };
		})
	};
}

// ---- Twitch ----

function streamerName(input: string, host: RegExp, pattern: RegExp, service: string): string {
	let name = input.trim();
	if (/[/.]/.test(name)) {
		let url: URL;
		try {
			url = new URL(withScheme(name));
		} catch {
			throw new FeedError(`That isn't a ${service} channel.`);
		}
		if (!host.test(url.hostname)) throw new FeedError(`That isn't a ${service} link.`);
		name = url.pathname.split('/')[1] ?? '';
	}
	name = name.replace(/^@/, '');
	if (!pattern.test(name)) throw new FeedError(`That isn't a ${service} username.`);
	return name;
}

function notSetUp(kind: 'twitch' | 'kick'): FeedError {
	const service = feedKinds[kind].label;
	return new FeedError(`${service} feeds aren't set up on this Golem yet.`);
}

async function resolveTwitch(input: string, keys: FeedKeys): Promise<FeedSourceInfo> {
	if (!keys.twitch) throw notSetUp('twitch');
	const login = streamerName(input, /(^|\.)twitch\.tv$/, /^\w{1,25}$/, 'Twitch').toLowerCase();
	const user = await twitchUser(keys.twitch, login);
	if (!user) throw new FeedError(`There's no Twitch channel named ${login}.`);
	const stream = await twitchStream(keys.twitch, user.id);
	return {
		kind: 'twitch',
		key: user.id,
		title: user.display_name || user.login,
		url: `https://www.twitch.tv/${user.login}`,
		state: { live: stream?.id ?? null }
	};
}

function twitchPost(stream: TwitchStream): FeedPost {
	const url = `https://www.twitch.tv/${stream.user_login}`;
	const startedAt = Date.parse(stream.started_at);
	return {
		content: `**${stream.user_name}** is live on Twitch!\n<${url}>`,
		embeds: [
			{
				color: TWITCH_COLOR,
				title: (stream.title || `${stream.user_name} is streaming`).slice(0, 256),
				url,
				fields: stream.game_name
					? [{ name: 'Playing', value: stream.game_name, inline: true }]
					: [],
				// The cache buster keeps Discord from reusing an old stream's preview.
				image: {
					url: `${stream.thumbnail_url.replace('{width}', '1280').replace('{height}', '720')}?t=${startedAt}`
				},
				timestamp: Number.isNaN(startedAt) ? undefined : new Date(startedAt).toISOString()
			}
		]
	};
}

async function checkTwitch(source: FeedSourceInfo, keys: FeedKeys): Promise<FeedCheck> {
	if (!keys.twitch) throw notSetUp('twitch');
	const stream = await twitchStream(keys.twitch, source.key);
	const live = stream?.id ?? null;
	const posts = stream && live !== source.state.live ? [twitchPost(stream)] : [];
	return {
		title: stream?.user_name || source.title,
		url: stream ? `https://www.twitch.tv/${stream.user_login}` : source.url,
		state: { live },
		posts
	};
}

// ---- Kick ----

async function resolveKick(input: string, keys: FeedKeys): Promise<FeedSourceInfo> {
	if (!keys.kick) throw notSetUp('kick');
	const slug = streamerName(input, /(^|\.)kick\.com$/, /^[\w-]{1,64}$/, 'Kick').toLowerCase();
	const channel = await kickChannelBySlug(keys.kick, slug);
	if (!channel) throw new FeedError(`There's no Kick channel named ${slug}.`);
	return {
		kind: 'kick',
		key: String(channel.broadcaster_user_id),
		title: channel.slug,
		url: `https://kick.com/${channel.slug}`,
		state: { live: kickLiveSession(channel) }
	};
}

async function checkKick(source: FeedSourceInfo, keys: FeedKeys): Promise<FeedCheck> {
	if (!keys.kick) throw notSetUp('kick');
	const channel = await kickChannelById(keys.kick, source.key);
	if (!channel) throw new FeedError('That Kick channel no longer exists.');
	const live = kickLiveSession(channel);
	const url = `https://kick.com/${channel.slug}`;
	const posts: FeedPost[] = [];
	if (live && live !== source.state.live) {
		const thumbnail = channel.stream?.thumbnail;
		posts.push({
			content: `**${channel.slug}** is live on Kick!\n<${url}>`,
			embeds: [
				{
					color: KICK_COLOR,
					title: (channel.stream_title || `${channel.slug} is streaming`).slice(0, 256),
					url,
					fields: channel.category?.name
						? [{ name: 'Category', value: channel.category.name, inline: true }]
						: [],
					image: thumbnail && isWebLink(thumbnail) ? { url: thumbnail } : undefined,
					timestamp: channel.stream?.start_time
						? new Date(channel.stream.start_time).toISOString()
						: undefined
				}
			]
		});
	}
	return { title: channel.slug, url, state: { live }, posts };
}

// ----

export async function resolveFeed(
	kind: FeedKind,
	input: string,
	keys: FeedKeys
): Promise<FeedSourceInfo> {
	const trimmed = input.trim();
	if (!trimmed) throw new FeedError(`Enter a ${feedKinds[kind].input.toLowerCase()}.`);
	if (trimmed.length > 2000) throw new FeedError('That is too long to be a link.');
	switch (kind) {
		case 'rss':
			return resolveRss(trimmed);
		case 'youtube':
			return resolveYoutube(trimmed);
		case 'twitch':
			return resolveTwitch(trimmed, keys);
		case 'kick':
			return resolveKick(trimmed, keys);
	}
}

export function checkFeed(source: FeedSourceInfo, keys: FeedKeys): Promise<FeedCheck> {
	switch (source.kind) {
		case 'rss':
			return checkRss(source);
		case 'youtube':
			return checkYoutube(source);
		case 'twitch':
			return checkTwitch(source, keys);
		case 'kick':
			return checkKick(source, keys);
	}
}
