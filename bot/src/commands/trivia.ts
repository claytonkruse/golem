import {
	ActionRowBuilder,
	ApplicationIntegrationType,
	ButtonBuilder,
	ButtonStyle,
	InteractionContextType,
	MessageFlags,
	SlashCommandBuilder,
	userMention,
	type ButtonInteraction
} from 'discord.js';
import { randomInt } from 'node:crypto';
import { awardChips } from '../db/chips.ts';
import { gameBlocked } from '../db/guild-games.ts';
import { categories, questions, type Category, type Question } from '../games/trivia-questions.ts';
import { formatChips } from '../lib/chips.ts';
import type { Command } from '../lib/command.ts';
import { claimOnce, newMessage, type EditMessage } from '../lib/messages.ts';

// A question for the whole channel. Everyone gets one answer; after the time is up Golem
// reveals the answer and who got it right, fastest first.

// Exported so tests can shorten it.
export const timing = { answerMs: 20_000 };
export const prizes = { fastest: 25, correct: 10 };

const letters = ['A', 'B', 'C', 'D'];

type Round = {
	question: Question;
	// The answers in the order shown; `correct` is the index of the right one.
	answers: string[];
	correct: number;
	category: Category | null;
	// Who answered what, in the order they answered.
	picks: Map<string, number>;
	edit: EditMessage;
	open: boolean;
};

const rounds = new Map<string, Round>();
// Each channel's recent questions, so the same one doesn't come straight back.
const recent = new Map<string, number[]>();
const RECENT = 20;

function pickQuestion(channelId: string, category: Category | null): number {
	const seen = recent.get(channelId) ?? [];
	const pool = questions
		.map((question, index) => ({ question, index }))
		.filter(({ question }) => category === null || question.category === category);
	const fresh = pool.filter(({ index }) => !seen.includes(index));
	const choice = (fresh.length > 0 ? fresh : pool)[
		randomInt((fresh.length > 0 ? fresh : pool).length)
	].index;
	recent.set(channelId, [...seen, choice].slice(-RECENT));
	return choice;
}

function shuffle<T>(items: T[]): T[] {
	const copy = [...items];
	for (let i = copy.length - 1; i > 0; i--) {
		const j = randomInt(i + 1);
		[copy[i], copy[j]] = [copy[j], copy[i]];
	}
	return copy;
}

function categoryLabel(category: Category): string {
	return categories.find((entry) => entry.key === category)?.label ?? category;
}

function answerButtons(roundId: string, round: Round, reveal: boolean) {
	return new ActionRowBuilder<ButtonBuilder>().addComponents(
		round.answers.map((answer, index) =>
			new ButtonBuilder()
				.setCustomId(`trivia:answer:${roundId}:${index}`)
				// Button labels are limited to 80 characters.
				.setLabel(`${letters[index]}. ${answer}`.slice(0, 80))
				.setStyle(reveal && index === round.correct ? ButtonStyle.Success : ButtonStyle.Secondary)
				.setDisabled(reveal)
		)
	);
}

function nextButton(category: Category | null) {
	return new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			.setCustomId(`trivia:next:${category ?? 'any'}`)
			.setLabel('Next question')
			.setStyle(ButtonStyle.Primary)
	);
}

function heading(round: Round): string {
	return `**Trivia · ${categoryLabel(round.question.category)}**\n${round.question.question}`;
}

async function reveal(roundId: string): Promise<void> {
	const round = rounds.get(roundId);
	if (!round?.open) return;
	round.open = false;
	rounds.delete(roundId);

	const winners = [...round.picks].filter(([, pick]) => pick === round.correct).map(([id]) => id);
	const lines = winners.map((id, place) => {
		const prize = place === 0 ? prizes.fastest : prizes.correct;
		awardChips(id, prize);
		return `${userMention(id)}${place === 0 ? ' was fastest' : ''} (+${formatChips(prize)})`;
	});
	const answer = `${letters[round.correct]}. ${round.answers[round.correct]}`;
	const results =
		winners.length === 0
			? round.picks.size === 0
				? 'Nobody answered.'
				: 'Nobody got it.'
			: `Right: ${lines.join(', ')}.`;
	await round.edit({
		content: `${heading(round)}\n\nThe answer was **${answer}**. ${results}`,
		components: [answerButtons(roundId, round, true), nextButton(round.category)],
		// The results name people without pinging them.
		allowedMentions: { parse: [] }
	});
}

async function ask(
	roundId: string,
	channelId: string,
	category: Category | null,
	edit: EditMessage
) {
	const question = questions[pickQuestion(channelId, category)];
	const answers = shuffle(question.answers);
	const round: Round = {
		question,
		answers,
		correct: answers.indexOf(question.answers[0]),
		category,
		picks: new Map(),
		edit,
		open: true
	};
	rounds.set(roundId, round);
	const seconds = Math.round(timing.answerMs / 1000);
	await edit({
		content: `${heading(round)}\n-# ${seconds} seconds. Everyone can answer once.`,
		components: [answerButtons(roundId, round, false)]
	});
	setTimeout(
		() =>
			void reveal(roundId).catch((error: unknown) =>
				console.error('Could not reveal a trivia answer.', error)
			),
		timing.answerMs
	);
}

async function answer(
	interaction: ButtonInteraction,
	roundId: string,
	pick: number
): Promise<void> {
	const round = rounds.get(roundId);
	if (!round?.open) {
		await interaction.reply({
			content: 'Time is up for that question.',
			flags: MessageFlags.Ephemeral
		});
		return;
	}
	const earlier = round.picks.get(interaction.user.id);
	if (earlier !== undefined) {
		await interaction.reply({
			content: `You already answered ${letters[earlier]}.`,
			flags: MessageFlags.Ephemeral
		});
		return;
	}
	round.picks.set(interaction.user.id, pick);
	// Private, so nobody can copy someone else's answer.
	await interaction.reply({
		content: `Locked in: ${letters[pick]}. ${round.answers[pick]}.`,
		flags: MessageFlags.Ephemeral
	});
}

export const command = {
	data: new SlashCommandBuilder()
		.setName('trivia')
		.setDescription('Ask the channel a trivia question. Everyone can answer.')
		.setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
		.setContexts(InteractionContextType.Guild, InteractionContextType.BotDM)
		.addStringOption((option) =>
			option
				.setName('category')
				.setDescription('Only ask questions from this category')
				.addChoices(
					...categories.map((category) => ({ name: category.label, value: category.key }))
				)
		),

	async execute(interaction) {
		const blocked = gameBlocked(interaction.guildId, 'trivia');
		if (blocked) {
			await interaction.reply({ content: blocked, flags: MessageFlags.Ephemeral });
			return;
		}
		const category = (interaction.options.getString('category') as Category | null) ?? null;
		await interaction.deferReply();
		await ask(interaction.id, interaction.channelId, category, (options) =>
			interaction.editReply(options)
		);
	},

	async button(interaction) {
		const [, action, ...rest] = interaction.customId.split(':');
		if (action === 'answer') return answer(interaction, rest[0], Number(rest[1]));

		// Next question: anyone can press it, once per finished question.
		const blocked = gameBlocked(interaction.guildId, 'trivia');
		if (blocked) {
			await interaction.reply({ content: blocked, flags: MessageFlags.Ephemeral });
			return;
		}
		if (!claimOnce(interaction.message.id)) {
			await interaction.deferUpdate();
			return;
		}
		const category = rest[0] === 'any' ? null : (rest[0] as Category);
		// The finished question keeps its revealed answers; only the Next button goes.
		await interaction.update({
			components: interaction.message.components.slice(0, 1).map((row) => row.toJSON())
		});
		await ask(interaction.id, interaction.channelId, category, newMessage(interaction));
	}
} satisfies Command;
