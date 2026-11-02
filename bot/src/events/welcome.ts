import { Events, PermissionFlagsBits } from 'discord.js';
import { getWelcome } from '../db/welcome.ts';
import type { Event } from '../lib/event.ts';
import { joinDetails, welcomeValues } from '../lib/member-join.ts';
import { renderWelcome } from '../lib/welcome.ts';

export const event = {
	name: Events.GuildMemberAdd,
	async execute(member) {
		// Apps are added by a manager, not joining to be greeted.
		if (member.user.bot) return;
		const welcome = getWelcome(member.guild.id);
		if (!welcome.enabled || !welcome.channelId) return;
		const channel = member.guild.channels.cache.get(welcome.channelId);
		const me = member.guild.members.me;
		if (!channel?.isSendable() || !me) return;
		const permissions = channel.permissionsFor(me);
		if (!permissions.has(PermissionFlagsBits.ViewChannel | PermissionFlagsBits.SendMessages)) {
			return;
		}

		const content = renderWelcome(
			welcome.message,
			await welcomeValues(member, await joinDetails(member))
		);
		try {
			// Users can ping, when the server allows it; roles, @everyone and @here never do.
			await channel.send({
				content,
				allowedMentions: { parse: welcome.pingMentions ? ['users'] : [] }
			});
		} catch (error) {
			console.error(`Could not send a welcome message in ${member.guild.id}.`, error);
		}
	}
} satisfies Event<typeof Events.GuildMemberAdd>;
