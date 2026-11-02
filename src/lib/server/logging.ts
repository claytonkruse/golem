import { ChannelType } from 'discord.js';
import { isLogChannelType } from '#bot/lib/logging.ts';
import { fetchGuildChannels } from './discord.js';

export type ChannelOption = {
	id: string;
	name: string;
	category: string | null;
};

const isVoice = (type: number) =>
	type === ChannelType.GuildVoice || type === ChannelType.GuildStageVoice;

// The channels logs can go to, in the order Discord's sidebar shows them.
export async function logChannelOptions(guildId: string): Promise<ChannelOption[]> {
	const channels = await fetchGuildChannels(guildId);
	const categories = new Map(
		channels
			.filter((channel) => channel.type === ChannelType.GuildCategory)
			.map((category) => [category.id, category])
	);
	const categoryPosition = (parentId: string | null) =>
		parentId ? (categories.get(parentId)?.position ?? 0) : -1;

	return channels
		.filter((channel) => isLogChannelType(channel.type))
		.sort(
			(a, b) =>
				categoryPosition(a.parent_id) - categoryPosition(b.parent_id) ||
				Number(isVoice(a.type)) - Number(isVoice(b.type)) ||
				a.position - b.position
		)
		.map((channel) => ({
			id: channel.id,
			name: channel.name,
			category: channel.parent_id ? (categories.get(channel.parent_id)?.name ?? null) : null
		}));
}
