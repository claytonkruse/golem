import { managedGuild } from '#lib/server/guilds.js';
import type { LayoutServerLoad } from './$types';

// The server, for the sidebar. Each page and action still checks access itself, since
// SvelteKit runs page loads alongside this one.
export const load: LayoutServerLoad = async (event) => ({
	guild: await managedGuild(event, event.params.guild)
});
