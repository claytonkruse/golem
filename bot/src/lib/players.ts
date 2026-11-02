import type { ButtonInteraction, ChatInputCommandInteraction, User } from 'discord.js';
import { getBalance, holdChips } from '../db/chips.ts';
import { formatChips } from './chips.ts';

// Helpers every game shares: names, bets and the usual replies.

type AnyInteraction = ChatInputCommandInteraction | ButtonInteraction;

// The server nickname in a server, otherwise the Discord display name.
export function displayName(interaction: AnyInteraction): string {
	return interaction.inCachedGuild()
		? interaction.member.displayName
		: (interaction.user.globalName ?? interaction.user.username);
}

export function userName(user: User): string {
	return user.globalName ?? user.username;
}

// A chip hold for the bet, null for a game played for fun (bet 0), or false when the
// player can't afford it.
export function placeBet(userId: string, game: string, bet: number): number | null | false {
	if (bet === 0) return null;
	return holdChips(userId, game, bet) ?? false;
}

export function notEnoughChips(userId: string): string {
	return `You only have ${formatChips(getBalance(userId))}. Bet less, or get more with /daily.`;
}
