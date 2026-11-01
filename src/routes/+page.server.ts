import { countGuilds } from '#bot/db/guilds.ts';
import { commandSummaries, type Command } from '#bot/lib/command.ts';
import { asksForPermissions, invite } from '#lib/server/config.js';
import type { PageServerLoad } from './$types';

// The same modules the bot loads, so this list cannot drift from what /help shows.
// import.meta.glob needs a relative path; it does not resolve the #bot import alias.
const modules = import.meta.glob<{ command: Command }>('../../bot/src/commands/*.ts', {
	eager: true
});

const commands = Object.values(modules)
	.flatMap((mod) => commandSummaries(mod.command))
	.sort((a, b) => a.name.localeCompare(b.name));

export const load: PageServerLoad = () => ({
	commands,
	servers: countGuilds(),
	invite: invite(),
	asksForPermissions
});
