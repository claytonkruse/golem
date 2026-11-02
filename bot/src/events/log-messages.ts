import { Events, channelMention, messageLink, userMention } from 'discord.js';
import type { Event } from '../lib/event.ts';
import { logColor, logEmbed, sendLog, truncate, withUser } from '../lib/logging.ts';

export const events = [
	{
		name: Events.MessageDelete,
		async execute(message) {
			if (!message.inGuild()) return;
			// Bots' own messages, Golem's logs included, would only add noise.
			if (message.author?.bot) return;

			const embed = logEmbed(logColor.delete, 'Message deleted');
			if (message.author) withUser(embed, message.author);
			const from = message.author ? ` from ${userMention(message.author.id)}` : '';
			embed.addFields({ name: 'Where', value: `${channelMention(message.channelId)}${from}` });

			// Golem only knows the text of messages it saw arrive while it was running.
			if (message.partial) {
				embed.setDescription('*Sent before Golem started, so its text is unknown.*');
			} else {
				embed.setDescription(message.content ? truncate(message.content, 4000) : '*No text*');
				if (message.attachments.size > 0) {
					embed.addFields({
						name: 'Attachments',
						value: truncate(message.attachments.map((file) => file.name).join('\n'), 1024)
					});
				}
			}
			await sendLog(message.guild, 'message_delete', embed);
		}
	} satisfies Event<typeof Events.MessageDelete>,

	{
		name: Events.MessageUpdate,
		async execute(before, after) {
			if (!after.inGuild() || after.author.bot) return;
			// Discord also sends updates when a link preview loads; only text edits count.
			if (!before.partial && before.content === after.content) return;

			const embed = withUser(logEmbed(logColor.update, 'Message edited'), after.author)
				.setDescription(
					`[Jump to message](${messageLink(after.channelId, after.id, after.guildId)}) in ${channelMention(after.channelId)}`
				)
				.addFields(
					{
						name: 'Before',
						value: before.partial
							? '*Sent before Golem started, so its text is unknown.*'
							: truncate(before.content || '*No text*', 1024)
					},
					{ name: 'After', value: truncate(after.content || '*No text*', 1024) }
				);
			await sendLog(after.guild, 'message_edit', embed);
		}
	} satisfies Event<typeof Events.MessageUpdate>,

	{
		name: Events.ThreadCreate,
		async execute(thread, newlyCreated) {
			// Also fires when Golem first sees an existing thread, such as after joining it.
			if (!newlyCreated) return;
			const embed = logEmbed(logColor.create, 'Thread created').setDescription(
				`${channelMention(thread.id)} (${thread.name})`
			);
			if (thread.parent)
				embed.addFields({ name: 'In', value: channelMention(thread.parent.id), inline: true });
			if (thread.ownerId)
				embed.addFields({ name: 'Started by', value: `<@${thread.ownerId}>`, inline: true });
			await sendLog(thread.guild, 'thread_create', embed);
		}
	} satisfies Event<typeof Events.ThreadCreate>,

	{
		name: Events.ThreadDelete,
		async execute(thread) {
			const embed = logEmbed(logColor.delete, 'Thread deleted').setDescription(thread.name);
			if (thread.parent)
				embed.addFields({ name: 'In', value: channelMention(thread.parent.id), inline: true });
			await sendLog(thread.guild, 'thread_delete', embed);
		}
	} satisfies Event<typeof Events.ThreadDelete>
];
