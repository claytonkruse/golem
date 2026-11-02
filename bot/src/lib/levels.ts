// The curve most Discord leveling bots use: each level needs 5L² + 50L + 100 more XP
// than the last, so level 1 takes 100 XP and level 10 about 6,000 in total.

export const XP_COOLDOWN_MS = 60_000;
// The share of a member's server and global XP that the member's inviter also gets, rounded.
export const INVITER_XP_SHARE = 0.1;
export const XP_PER_MESSAGE = { min: 15, max: 25 };

// Whether servers may turn off server XP for slash commands (the dashboard's "Count
// slash commands toward levels" switch). While false, commands always earn server XP,
// the switch is hidden and any saved choice is ignored. Set to true to bring it back.
export const COMMAND_XP_SETTING = false;

export function xpToNextLevel(level: number): number {
	return 5 * level * level + 50 * level + 100;
}

export type LevelProgress = {
	level: number;
	// XP earned since reaching this level, and how much the next level needs.
	current: number;
	needed: number;
};

export function levelFromXp(totalXp: number): LevelProgress {
	let level = 0;
	let remaining = totalXp;
	while (remaining >= xpToNextLevel(level)) {
		remaining -= xpToNextLevel(level);
		level++;
	}
	return { level, current: remaining, needed: xpToNextLevel(level) };
}

export function randomXp(): number {
	const { min, max } = XP_PER_MESSAGE;
	return min + Math.floor(Math.random() * (max - min + 1));
}

// The leveling commands, each with its own switch on the dashboard. Keys are command names
// and are stored in the database.
export const levelCommands = [
	{ key: 'level', label: '/level', description: "Shows a member's level card for this server." },
	{ key: 'rank', label: '/rank', description: "Shows a member's place in this server's ranking." },
	{
		key: 'globallevel',
		label: '/globallevel',
		description: "Shows a member's level card across every server."
	},
	{
		key: 'globalrank',
		label: '/globalrank',
		description: "Shows a member's place in the ranking across every server."
	},
	{
		key: 'leaderboard',
		label: '/leaderboard',
		description: "Shows this server's top members by XP."
	},
	{
		key: 'globalleaderboard',
		label: '/globalleaderboard',
		description: 'Shows the top members across every server, by Discord name.'
	}
] as const;

export type LevelCommand = (typeof levelCommands)[number]['key'];

export function isLevelCommand(value: string): value is LevelCommand {
	return levelCommands.some((command) => command.key === value);
}
