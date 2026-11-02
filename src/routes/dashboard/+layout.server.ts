import { requireSession } from '#lib/server/auth.js';
import { managedGuilds } from '#lib/server/guilds.js';
import type { LayoutServerLoad } from './$types';

// The servers for the rail and the server list. managedGuilds checks the session itself.
export const load: LayoutServerLoad = async (event) => {
	requireSession(event.locals);
	return { guilds: await managedGuilds(event) };
};
