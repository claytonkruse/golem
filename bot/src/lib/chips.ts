// The currency's name and rules, in one place so they are easy to change.

export const STARTING_CHIPS = 1_000;
export const DAILY_CHIPS = 200;
export const DAILY_COOLDOWN_MS = 24 * 60 * 60 * 1000;

const number = new Intl.NumberFormat('en-US');

// "1 chip", "1,000 chips".
export function formatChips(amount: number): string {
	return `${number.format(amount)} ${Math.abs(amount) === 1 ? 'chip' : 'chips'}`;
}
