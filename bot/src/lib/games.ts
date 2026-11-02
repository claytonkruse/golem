// Every game Golem has. The keys are stored in the database, so rename a label freely but
// never a key. Adding a game here gives it a switch on the dashboard.

export const games = [
	{
		key: 'blackjack',
		label: 'Blackjack',
		description: 'Play blackjack against Golem with /blackjack, for chips or just for fun.'
	},
	{
		key: 'fishing',
		label: 'Fishing',
		description: 'Cast a line with /fish and reel fish in by pulling the way the line goes.'
	},
	{
		key: 'higherlower',
		label: 'Higher or Lower',
		description:
			'Guess whether the next card is higher or lower with /higherlower, and cash out before you miss.'
	},
	{
		key: 'videopoker',
		label: 'Video Poker',
		description: 'Hold the best cards and draw once in Jacks or Better with /videopoker.'
	},
	{
		key: 'connect4',
		label: 'Connect Four',
		description: 'Challenge a member or Golem to Connect Four with /connect4.'
	},
	{
		key: 'tictactoe',
		label: 'Tic-Tac-Toe',
		description: 'Challenge a member or Golem to Tic-Tac-Toe with /tictactoe.'
	},
	{
		key: 'trivia',
		label: 'Trivia',
		description:
			'Ask the channel a question with /trivia. Everyone can answer, and the fastest correct answer earns the most chips.'
	}
] as const;

export type GameKey = (typeof games)[number]['key'];

const keys = new Set<string>(games.map((game) => game.key));

export function isGameKey(value: string): value is GameKey {
	return keys.has(value);
}
