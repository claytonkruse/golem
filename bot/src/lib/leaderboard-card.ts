import { accentGradient, box, colors, image, imageData, SANS, toPng, type Node } from './image.ts';
import { levelFromXp } from './levels.ts';

// The /leaderboard card: a page of up to ten people, ranked by XP.

export type LeaderRow = {
	rank: number;
	name: string;
	avatarUrl: string;
	xp: number;
	// The person who ran the command, marked so that row stands out.
	you: boolean;
};

export type LeaderboardCard = {
	// "In <server>" or "Global".
	scope: string;
	rows: LeaderRow[];
	page: number;
	pages: number;
	// Shown under the list when the viewer isn't on this page, like "You're #42 of 1,203".
	footer: string | null;
};

const WIDTH = 934;
const PAD = 36;
const ROW = 58;
const number = new Intl.NumberFormat('en-US');

function avatar(data: string | null, name: string): Node {
	const frame = { width: 40, height: 40, borderRadius: '50%', flexShrink: 0 };
	return data
		? image(data, 40, 40, frame)
		: box(
				{
					...frame,
					alignItems: 'center',
					justifyContent: 'center',
					backgroundColor: colors.track,
					fontSize: 18,
					color: colors.text
				},
				name.slice(0, 1).toUpperCase()
			);
}

function row(entry: LeaderRow, picture: string | null): Node {
	const top = entry.rank <= 3;
	return box(
		{
			height: ROW,
			alignItems: 'center',
			gap: 18,
			paddingLeft: 16,
			paddingRight: 16,
			borderRadius: 14,
			backgroundColor: entry.you ? colors.track : 'transparent',
			flexShrink: 0
		},
		box(
			{
				width: 64,
				fontSize: 26,
				fontWeight: 600,
				flexShrink: 0,
				...(top
					? { backgroundImage: accentGradient, backgroundClip: 'text', color: 'transparent' }
					: { color: colors.muted })
			},
			`#${number.format(entry.rank)}`
		),
		avatar(picture, entry.name),
		box(
			{
				flexGrow: 1,
				minWidth: 0,
				fontSize: 24,
				fontWeight: 600,
				color: colors.text,
				whiteSpace: 'nowrap',
				overflow: 'hidden',
				textOverflow: 'ellipsis'
			},
			entry.you ? `${entry.name} (you)` : entry.name
		),
		box(
			{ width: 110, justifyContent: 'flex-end', fontSize: 22, color: colors.text, flexShrink: 0 },
			`Level ${levelFromXp(entry.xp).level}`
		),
		box(
			{ width: 150, justifyContent: 'flex-end', fontSize: 22, color: colors.muted, flexShrink: 0 },
			`${number.format(entry.xp)} XP`
		)
	);
}

export async function renderLeaderboard(card: LeaderboardCard): Promise<Buffer> {
	const pictures = await Promise.all(card.rows.map((entry) => imageData(entry.avatarUrl)));
	// Every page of a multi-page leaderboard is the same size, so paging doesn't jump.
	const shown = card.pages > 1 ? 10 : card.rows.length;
	const height = PAD * 2 + 64 + 16 + ROW * shown + (shown - 1) * 4 + (card.footer ? 48 : 0);
	const tree = box(
		{ width: WIDTH, height, backgroundColor: colors.background, borderRadius: 28 },
		box(
			{
				width: WIDTH - PAD * 2,
				height: height - PAD * 2,
				margin: PAD,
				flexDirection: 'column',
				gap: 16,
				fontFamily: SANS
			},
			box(
				{ justifyContent: 'space-between', alignItems: 'center', height: 64, flexShrink: 0 },
				box(
					{ flexDirection: 'column', gap: 4 },
					box({ fontSize: 20, color: colors.muted, letterSpacing: 2 }, 'LEADERBOARD'),
					box({ fontSize: 30, fontWeight: 600, color: colors.text }, card.scope)
				),
				box(
					{ fontSize: 22, color: colors.muted },
					card.pages > 1 ? `Page ${card.page} of ${card.pages}` : ''
				)
			),
			box(
				{ flexDirection: 'column', gap: 4, flexGrow: 1 },
				...card.rows.map((entry, index) => row(entry, pictures[index]))
			),
			...(card.footer
				? [
						box(
							{
								height: 32,
								alignItems: 'center',
								fontSize: 22,
								color: colors.muted,
								flexShrink: 0
							},
							card.footer
						)
					]
				: [])
		)
	);
	return toPng(tree, WIDTH, height);
}
