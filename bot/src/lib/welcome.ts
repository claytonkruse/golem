// Welcome message templates. Shared by the bot, /welcome and the dashboard, so it must not
// import discord.js clients or the database.

export const DEFAULT_WELCOME_MESSAGE =
	'{user} has joined. Welcome! {inviter} has now invited {invitecount} of our members.';
export const MAX_WELCOME_LENGTH = 2000;

export const welcomeVariables = [
	{ key: 'user', description: 'Mentions the new member.' },
	{ key: 'username', description: 'Their Discord username, without a mention.' },
	{ key: 'server', description: "The server's name." },
	{ key: 'membercount', description: 'How many members the server has now.' },
	{
		key: 'inviter',
		description:
			'Mentions who invited them, without pinging. "someone" when Golem can\'t tell, and "the vanity link" for the server\'s vanity URL.'
	},
	{
		key: 'invitername',
		description:
			'The inviter\'s Discord username, without a mention. "someone" and "the vanity link" like {inviter}.'
	},
	{
		key: 'invitecount',
		description:
			'How many people the inviter has brought in who are still here, counting this one. "?" when the inviter is unknown.'
	},
	{
		key: 'leavecount',
		description: 'How many times they have left this server before, as far as Golem has seen.'
	}
] as const;

export type WelcomeVariable = (typeof welcomeVariables)[number]['key'];
export type WelcomeValues = Record<WelcomeVariable, string>;

// Variables that need Golem to work out which invite was used.
const INVITE_VARIABLES = /\{(inviter|invitername|invitecount)\}/i;
const VARIABLE = /\{(\w+)\}/g;
const known = new Set<string>(welcomeVariables.map((variable) => variable.key));

export function usesInviteVariables(template: string): boolean {
	return INVITE_VARIABLES.test(template);
}

// Unknown {words} are left as they are, so a typo shows up in the message.
export function renderWelcome(template: string, values: WelcomeValues): string {
	const text = template.replace(VARIABLE, (match, name: string) => {
		const key = name.toLowerCase();
		return known.has(key) ? values[key as WelcomeVariable] : match;
	});
	return text.length <= MAX_WELCOME_LENGTH ? text : `${text.slice(0, MAX_WELCOME_LENGTH - 1)}…`;
}
