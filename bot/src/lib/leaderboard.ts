import {
	ActionRowBuilder,
	AttachmentBuilder,
	ButtonBuilder,
	ButtonStyle,
	MessageFlags,
	userMention,
	type ButtonInteraction,
	type ChatInputCommandInteraction,
	type Client,
	type Guild
} from 'discord.js';
import {
	memberCount,
	memberLeaders,
	memberStanding,
	userCount,
	userLeaders,
	userStanding,
	type Leader
} from '../db/xp.ts';
import { renderLeaderboard, type LeaderRow } from './leaderboard-card.ts';
import { commandsOff, scopeOf, type Scope } from './leveling.ts';

// /leaderboard and /globalleaderboard. Pages are ten people long. The paging buttons carry
// everything they need in their custom id, "leaderboard:<scope>:<owner id>:<page>", so they
// keep working after a restart and nothing has to be remembered between clicks.

const PAGE_SIZE = 10;
const number = new Intl.NumberFormat('en-US');

type Board = { scope: Scope; ownerId: string; page: number };

// The command a board belongs to, for the per-command switches.
function commandOf(interaction: ChatInputCommandInteraction | ButtonInteraction, scope: Scope) {
	return scope === 'server' || !interaction.inCachedGuild() ? 'leaderboard' : 'globalleaderboard';
}

function leaders(guild: Guild | null, page: number): Leader[] {
	const offset = (page - 1) * PAGE_SIZE;
	return guild ? memberLeaders(guild.id, offset, PAGE_SIZE) : userLeaders(offset, PAGE_SIZE);
}

// The server board uses nicknames and server avatars. People who have left the server are
// still on it, under their Discord name. The global board always uses Discord names, since
// a nickname from one server means nothing in another.
async function rows(
	client: Client,
	guild: Guild | null,
	page: Leader[],
	viewerId: string
): Promise<LeaderRow[]> {
	const ids = page.map((leader) => leader.userId);
	const members = guild ? await guild.members.fetch({ user: ids }).catch(() => null) : null;
	return Promise.all(
		page.map(async (leader) => {
			const member = members?.get(leader.userId);
			const user = member?.user ?? (await client.users.fetch(leader.userId).catch(() => null));
			const who = member ?? user;
			return {
				rank: leader.rank,
				xp: leader.xp,
				name: member?.displayName ?? user?.globalName ?? user?.username ?? 'Unknown member',
				avatarUrl:
					who?.displayAvatarURL({ extension: 'png', size: 64 }) ?? client.rest.cdn.defaultAvatar(0),
				you: leader.userId === viewerId
			};
		})
	);
}

function buttons(board: Board, pages: number) {
	const id = (page: number) => `leaderboard:${board.scope}:${board.ownerId}:${page}`;
	return new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			.setCustomId(id(board.page - 1))
			.setLabel('Previous')
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(board.page <= 1),
		new ButtonBuilder()
			.setCustomId(id(board.page + 1))
			.setLabel('Next')
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(board.page >= pages)
	);
}

type Rendered = { files: AttachmentBuilder[]; components: ActionRowBuilder<ButtonBuilder>[] };

// Renders one page, or returns null when nobody on this board has XP yet.
async function render(
	interaction: ChatInputCommandInteraction | ButtonInteraction,
	board: Board
): Promise<Rendered | null> {
	const guild = board.scope === 'server' && interaction.inCachedGuild() ? interaction.guild : null;
	const total = guild ? memberCount(guild.id) : userCount();
	if (total === 0) return null;
	const pages = Math.ceil(total / PAGE_SIZE);
	// The board may have shrunk since the buttons were made.
	const page = Math.min(Math.max(board.page, 1), pages);
	const top = leaders(guild, page);

	const viewer = guild
		? memberStanding(guild.id, interaction.user.id)
		: userStanding(interaction.user.id);
	let footer: string | null = null;
	if (!viewer) footer = "You're not on this leaderboard yet. Chat to earn XP.";
	else if (!top.some((leader) => leader.userId === interaction.user.id)) {
		footer = `You're #${number.format(viewer.rank)} of ${number.format(total)}.`;
	}

	const png = await renderLeaderboard({
		scope: guild ? `In ${guild.name}` : 'Global',
		rows: await rows(interaction.client, guild, top, interaction.user.id),
		page,
		pages,
		footer
	});
	return {
		files: [new AttachmentBuilder(png, { name: 'leaderboard.png' })],
		components: pages > 1 ? [buttons({ ...board, page }, pages)] : []
	};
}

export async function replyLeaderboard(
	interaction: ChatInputCommandInteraction,
	scope: Scope
): Promise<void> {
	if (await commandsOff(interaction)) return;
	// A server board in a DM is the global one, like /level and /rank.
	const board: Board = {
		scope: scope === 'server' ? scopeOf(interaction) : 'global',
		ownerId: interaction.user.id,
		page: 1
	};
	await interaction.deferReply();
	const page = await render(interaction, board);
	if (!page) {
		await interaction.editReply(
			board.scope === 'server'
				? 'Nobody has earned XP in this server yet. Chat here to start.'
				: 'Nobody has earned XP yet. Chat in any server with Golem to start.'
		);
		return;
	}
	await interaction.editReply(page);
}

export async function turnLeaderboardPage(interaction: ButtonInteraction): Promise<void> {
	const [, scope, ownerId, page] = interaction.customId.split(':');
	if (scope !== 'server' && scope !== 'global') return;
	if (interaction.user.id !== ownerId) {
		await interaction.reply({
			content: `Only ${userMention(ownerId)} can turn these pages. Run /leaderboard to get your own.`,
			flags: MessageFlags.Ephemeral,
			allowedMentions: { parse: [] }
		});
		return;
	}
	if (await commandsOff(interaction, commandOf(interaction, scope))) return;
	await interaction.deferUpdate();
	const rendered = await render(interaction, { scope, ownerId, page: Number(page) || 1 });
	if (rendered) await interaction.editReply({ ...rendered, attachments: [] });
}
