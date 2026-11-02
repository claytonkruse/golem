import { MAX_DM_FEEDS, subscriptions, unsubscribe } from '#bot/db/feeds.ts';
import { requireSession } from '#lib/server/auth.js';
import { addFeed, feedKindOptions } from '#lib/server/feeds.js';
import type { Actions, PageServerLoad } from './$types';

// Feeds Golem DMs to the signed-in person: the same list /feed manages in a DM with Golem.

export const load: PageServerLoad = ({ locals }) => {
	const session = requireSession(locals);
	return {
		feeds: {
			kinds: feedKindOptions(),
			list: subscriptions({ userId: session.userId }),
			limit: MAX_DM_FEEDS
		}
	};
};

export const actions: Actions = {
	add: async ({ locals, request }) => {
		const session = requireSession(locals);
		return addFeed(await request.formData(), { userId: session.userId });
	},
	remove: async ({ locals, request }) => {
		const session = requireSession(locals);
		const form = await request.formData();
		unsubscribe(Number(form.get('id')), { userId: session.userId });
	}
};
