import { accentGradient, box, colors, image, imageData, SANS, toPng, type Node } from './image.ts';
import type { LevelProgress } from './levels.ts';

// The /level and /rank cards.

const WIDTH = 934;
const HEIGHT = 282;

type Profile = {
	name: string;
	avatarUrl: string;
	// "In <server>" or "Global".
	scope: string;
};

const number = new Intl.NumberFormat('en-US');

function avatarNode(profile: Profile, avatar: string | null): Node {
	const ring = { flexShrink: 0, borderRadius: '50%', border: `6px solid ${colors.accent}` };
	if (avatar) {
		return image(avatar, 190, 190, ring);
	}
	return box(
		{
			...ring,
			width: 190,
			height: 190,
			alignItems: 'center',
			justifyContent: 'center',
			backgroundColor: colors.panel,
			fontSize: 80,
			fontWeight: 600,
			color: colors.text
		},
		profile.name.slice(0, 1).toUpperCase()
	);
}

function nameNode(profile: Profile): Node {
	return box(
		{ flexDirection: 'column', flexShrink: 1, minWidth: 0 },
		box(
			{
				fontSize: 40,
				fontWeight: 600,
				color: colors.text,
				whiteSpace: 'nowrap',
				overflow: 'hidden',
				textOverflow: 'ellipsis'
			},
			profile.name
		),
		box({ fontSize: 22, color: colors.muted }, profile.scope)
	);
}

// The avatar on the left and the card's own content beside it.
async function render(profile: Profile, content: Node): Promise<Buffer> {
	const avatar = await imageData(profile.avatarUrl);
	// Satori adds padding outside the given width, so the margin sits on an inner box.
	const PAD = 36;
	const tree = box(
		{ width: WIDTH, height: HEIGHT, backgroundColor: colors.background, borderRadius: 28 },
		box(
			{
				width: WIDTH - PAD * 2,
				height: HEIGHT - PAD * 2,
				margin: PAD,
				gap: 36,
				alignItems: 'center',
				fontFamily: SANS
			},
			avatarNode(profile, avatar),
			content
		)
	);
	return toPng(tree, WIDTH, HEIGHT);
}

// /level: the level, large, with progress toward the next one.
export function renderLevelCard(profile: Profile, progress: LevelProgress): Promise<Buffer> {
	const { level, current, needed } = progress;
	const percent = Math.max(2, Math.min(100, (current / needed) * 100));
	return render(
		profile,
		box(
			{ flexDirection: 'column', flexGrow: 1, gap: 14, minWidth: 0 },
			box(
				{ justifyContent: 'space-between', alignItems: 'flex-end', gap: 24 },
				nameNode(profile),
				box(
					{ alignItems: 'baseline', gap: 10, flexShrink: 0 },
					box({ fontSize: 22, color: colors.muted }, 'LEVEL'),
					box({ fontSize: 64, fontWeight: 600, color: colors.text, lineHeight: 1 }, String(level))
				)
			),
			box(
				{ justifyContent: 'flex-end', fontSize: 22, color: colors.muted },
				`${number.format(current)} / ${number.format(needed)} XP`
			),
			box(
				{ height: 30, borderRadius: 15, backgroundColor: colors.track },
				box({
					width: `${percent}%`,
					height: 30,
					borderRadius: 15,
					backgroundImage: accentGradient
				})
			)
		)
	);
}

// /rank: the place, big, with the level smaller beneath it.
export function renderRankCard(profile: Profile, rank: number, level: number): Promise<Buffer> {
	const text = `#${number.format(rank)}`;
	// Shrinks for long numbers so the name keeps room beside it.
	const size = text.length <= 4 ? 112 : text.length <= 6 ? 88 : 72;
	return render(
		profile,
		box(
			{ flexGrow: 1, justifyContent: 'space-between', alignItems: 'center', gap: 24, minWidth: 0 },
			nameNode(profile),
			box(
				{ flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 },
				box({ fontSize: 22, color: colors.muted }, 'RANK'),
				box(
					{
						fontSize: size,
						fontWeight: 600,
						lineHeight: 1,
						backgroundImage: accentGradient,
						backgroundClip: 'text',
						color: 'transparent'
					},
					text
				),
				box({ fontSize: 26, color: colors.muted, marginTop: 8 }, `Level ${level}`)
			)
		)
	);
}
