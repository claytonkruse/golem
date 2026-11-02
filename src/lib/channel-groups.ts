import type { ChannelOption } from '#lib/server/logging.js';

// Consecutive channels in the same category, for <optgroup>s that match Discord's sidebar.
export function channelGroups(channels: ChannelOption[]) {
	return channels.reduce<{ name: string; channels: ChannelOption[] }[]>((groups, channel) => {
		const name = channel.category ?? 'No category';
		const last = groups.at(-1);
		if (last?.name === name) last.channels.push(channel);
		else groups.push({ name, channels: [channel] });
		return groups;
	}, []);
}
