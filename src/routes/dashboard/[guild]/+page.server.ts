import { redirect } from '@sveltejs/kit';
import { managedGuild } from '#lib/server/guilds.js';
import type { PageServerLoad } from './$types';

// A server with Golem opens on its first settings page; one without shows how to add it.
export const load: PageServerLoad = async (event) => {
	const guild = await managedGuild(event, event.params.guild);
	if (guild.joinedAt) redirect(307, `/dashboard/${guild.id}/logging/`);
};
