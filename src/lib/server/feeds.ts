import { fail } from '@sveltejs/kit';
import {
	KICK_CLIENT_ID,
	KICK_CLIENT_SECRET,
	TWITCH_CLIENT_ID,
	TWITCH_CLIENT_SECRET
} from '$app/env/private';
import { feedCount, feedLimit, subscribe, type FeedTarget } from '#bot/db/feeds.ts';
import { FeedError } from '#bot/feeds/fetch.ts';
import { feedKeys } from '#bot/feeds/keys.ts';
import {
	feedKindAvailable,
	feedKinds,
	isFeedKind,
	KEY_NAMES,
	resolveFeed
} from '#bot/feeds/sources.ts';

// The dashboard looks feeds up itself when someone adds one, so it needs the same keys as
// the bot.
export const dashboardFeedKeys = feedKeys({
	TWITCH_CLIENT_ID,
	TWITCH_CLIENT_SECRET,
	KICK_CLIENT_ID,
	KICK_CLIENT_SECRET
});

// What the Type picker offers, with Twitch and Kick marked when their keys are missing.
export function feedKindOptions() {
	return Object.entries(feedKinds).map(([kind, info]) => ({
		kind,
		label: info.label,
		input: info.input,
		placeholder: info.placeholder,
		help: info.help,
		available: isFeedKind(kind) && feedKindAvailable(kind, dashboardFeedKeys),
		needs: kind in KEY_NAMES ? KEY_NAMES[kind as keyof typeof KEY_NAMES] : null
	}));
}

// The add action for a server channel or someone's DMs. Failures echo the form back so it
// keeps what was typed.
export async function addFeed(form: FormData, target: FeedTarget) {
	const kind = String(form.get('kind') ?? '');
	const source = String(form.get('source') ?? '');
	const values = { kind, source, channel: String(form.get('channel') ?? '') };
	const here = 'userId' in target ? 'You follow' : 'This server follows';

	if (!isFeedKind(kind)) return fail(400, { ...values, message: 'Pick what to follow.' });
	if (!feedKindAvailable(kind, dashboardFeedKeys)) {
		return fail(400, {
			...values,
			message: `${feedKinds[kind].label} feeds aren't set up on this Golem yet.`
		});
	}
	const limit = feedLimit(target);
	if (feedCount(target) >= limit) {
		return fail(400, {
			...values,
			message: `${here} ${limit} feeds, the most Golem allows. Remove one first.`
		});
	}

	let resolved;
	try {
		resolved = await resolveFeed(kind, source, dashboardFeedKeys);
	} catch (error) {
		if (!(error instanceof FeedError)) throw error;
		return fail(400, { ...values, message: error.message });
	}
	const result = subscribe(resolved, target);
	if (result === 'exists') {
		const where = 'userId' in target ? 'your DMs' : 'that channel';
		return fail(400, { ...values, message: `${resolved.title} already posts in ${where}.` });
	}
	if (result === 'full') {
		return fail(400, { ...values, message: `${here} as many feeds as Golem allows.` });
	}
	return { added: resolved.title };
}
