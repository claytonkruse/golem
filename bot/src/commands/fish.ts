import {
	ActionRowBuilder,
	ApplicationIntegrationType,
	AttachmentBuilder,
	ButtonBuilder,
	ButtonStyle,
	InteractionContextType,
	MessageFlags,
	SlashCommandBuilder,
	type ButtonInteraction,
	type InteractionEditReplyOptions
} from 'discord.js';
import { randomInt } from 'node:crypto';
import {
	biteScene,
	randomDirection,
	resultCard,
	rollCatch,
	swimmingGif,
	pullsFor,
	type Catch,
	type Direction
} from '../games/fishing.ts';
import type { Command } from '../lib/command.ts';
import { gameBlocked } from '../db/guild-games.ts';
import { claimOnce, newMessage } from '../lib/messages.ts';

// A cast goes: waiting (fish swim in a GIF), biting (the line pulls one way and the buttons
// appear, once per pull the fish takes), then over. The fish is chosen when it bites, and
// rarer fish take more pulls. Casts live in memory; a restart just ends them.
type Cast = {
	playerId: string;
	state: 'waiting' | 'biting' | 'over';
	fish: Catch;
	// Correct pulls needed to land the fish, and how many have been made.
	pulls: number;
	done: number;
	direction: Direction;
	deadline: number;
	timer?: NodeJS.Timeout;
	edit: (options: InteractionEditReplyOptions) => Promise<unknown>;
};

const casts = new Map<string, Cast>();

// Exported so tests can shorten them.
export const timing = {
	waitMinMs: 3000,
	waitMaxMs: 8000,
	// How long the player has for each pull once it's on screen.
	reactMs: 4500
};

const arrows: Record<Direction, string> = { left: '⬅️', down: '⬇️', right: '➡️' };
const words: Record<Direction, string> = { left: 'Left', down: 'Down', right: 'Right' };

// The pull number is in each id, so a late or doubled press on an earlier pull's buttons
// can't count toward the current one.
function pullButtons(castId: string, pull: number) {
	return new ActionRowBuilder<ButtonBuilder>().addComponents(
		(['left', 'down', 'right'] as const).map((direction) =>
			new ButtonBuilder()
				.setCustomId(`fish:pull:${castId}:${pull}:${direction}`)
				.setEmoji(arrows[direction])
				.setLabel(words[direction])
				.setStyle(ButtonStyle.Secondary)
		)
	);
}

function castAgainButton(playerId: string) {
	return new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			.setCustomId(`fish:again:${playerId}`)
			.setLabel('Cast again')
			.setStyle(ButtonStyle.Primary)
	);
}

// "after 3 of 7 pulls. It was a **Salmon**." Losing a long fight shows what it was.
function gotAway(cast: Cast): string {
	const progress = cast.pulls > 1 ? ` after ${cast.done} of ${cast.pulls} pulls` : '';
	return `It got away${progress}. It was a **${cast.fish.name}**.`;
}

async function finish(
	castId: string,
	cast: Cast,
	result: { caught: true } | { lost: string; note: string }
) {
	if (cast.state === 'over') return;
	cast.state = 'over';
	clearTimeout(cast.timer);
	casts.delete(castId);

	const { fish } = cast;
	let content: string;
	let card: Buffer;
	if ('caught' in result) {
		content =
			cast.pulls > 1
				? `You landed a **${fish.name}** weighing ${fish.pounds.toFixed(1)} lb after ${cast.pulls} pulls!`
				: `You caught a **${fish.name}** weighing ${fish.pounds.toFixed(1)} lb!`;
		card = await resultCard({ caught: fish });
	} else {
		content = result.note;
		card = await resultCard({ lost: result.lost });
	}
	await cast.edit({
		content,
		files: [
			new AttachmentBuilder(card, { name: 'catch.png', description: content.replaceAll('**', '') })
		],
		attachments: [],
		components: [castAgainButton(cast.playerId)]
	});
}

// Shows the current pull: the line, the progress dots and fresh buttons, then starts its clock.
async function showPull(castId: string, cast: Cast): Promise<void> {
	clearTimeout(cast.timer);
	const pull = cast.done + 1;
	const counter = cast.pulls > 1 ? ` (pull ${pull} of ${cast.pulls})` : '';
	await cast.edit({
		content:
			cast.done === 0
				? `**Something bit!** Pull the way the line is going${counter}.`
				: `**It's fighting!** Pull the way the line is going${counter}.`,
		files: [
			new AttachmentBuilder(biteScene(cast.direction, cast.done, cast.pulls), {
				name: 'bite.png',
				description: `A fish is pulling the line ${cast.direction}.`
			})
		],
		attachments: [],
		components: [pullButtons(castId, cast.done)]
	});
	// The clock starts once the pull is on screen, not when it was sent.
	cast.deadline = Date.now() + timing.reactMs;
	cast.timer = setTimeout(
		() =>
			void finish(castId, cast, { lost: 'Too slow!', note: `Too slow. ${gotAway(cast)}` }).catch(
				(error: unknown) => console.error('Could not end a cast.', error)
			),
		timing.reactMs
	);
}

async function bite(castId: string): Promise<void> {
	const cast = casts.get(castId);
	if (!cast || cast.state !== 'waiting') return;
	cast.state = 'biting';
	await showPull(castId, cast);
}

async function startCast(castId: string, playerId: string, edit: Cast['edit']): Promise<void> {
	const fish = rollCatch();
	const cast: Cast = {
		playerId,
		state: 'waiting',
		fish,
		pulls: pullsFor(fish.rarity),
		done: 0,
		direction: randomDirection(),
		deadline: 0,
		edit
	};
	casts.set(castId, cast);
	await edit({
		content: 'Waiting for a bite…',
		files: [
			new AttachmentBuilder(swimmingGif(), {
				name: 'fishing.gif',
				description: 'Fish swimming under a bobber.'
			})
		],
		attachments: [],
		components: []
	});
	const wait = timing.waitMinMs + randomInt(timing.waitMaxMs - timing.waitMinMs + 1);
	cast.timer = setTimeout(
		() =>
			void bite(castId).catch((error: unknown) => console.error('Could not show a bite.', error)),
		wait
	);
}

async function castAgain(interaction: ButtonInteraction, playerId: string): Promise<void> {
	if (interaction.user.id !== playerId) {
		await interaction.reply({
			content: "That's someone else's line. Cast your own with /fish.",
			flags: MessageFlags.Ephemeral
		});
		return;
	}
	const blocked = gameBlocked(interaction.guildId, 'fishing');
	if (blocked) {
		await interaction.reply({ content: blocked, flags: MessageFlags.Ephemeral });
		return;
	}
	// One cast per finished message, even with a double click.
	if (!claimOnce(interaction.message.id)) {
		await interaction.deferUpdate();
		return;
	}
	// The finished cast keeps its result; the next one starts in a new message below it.
	await interaction.update({ components: [] });
	await startCast(interaction.id, playerId, newMessage(interaction));
}

export const command = {
	data: new SlashCommandBuilder()
		.setName('fish')
		.setDescription('Cast a line and pull the right way when something bites.')
		.setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
		.setContexts(InteractionContextType.Guild, InteractionContextType.BotDM),

	async execute(interaction) {
		const blocked = gameBlocked(interaction.guildId, 'fishing');
		if (blocked) {
			await interaction.reply({ content: blocked, flags: MessageFlags.Ephemeral });
			return;
		}
		// The first few casts draw a new scene, which takes a couple of seconds.
		await interaction.deferReply();
		await startCast(interaction.id, interaction.user.id, (options) =>
			interaction.editReply(options)
		);
	},

	async button(interaction) {
		const [, action, ...rest] = interaction.customId.split(':');
		if (action === 'again') return castAgain(interaction, rest[0]);

		const [castId, pull, direction] = rest as [string, string, Direction];
		const cast = casts.get(castId);
		if (!cast) {
			// Golem restarted or the cast already ended; take the dead buttons away.
			await interaction.update({ components: [] });
			return;
		}
		if (interaction.user.id !== cast.playerId) {
			await interaction.reply({
				content: "That's someone else's line. Cast your own with /fish.",
				flags: MessageFlags.Ephemeral
			});
			return;
		}
		await interaction.deferUpdate();
		// A press on an earlier pull's buttons, such as a double click, counts for nothing.
		// Checked and updated with no await in between, so two presses can't both count.
		if (cast.state !== 'biting' || Number(pull) !== cast.done) return;
		cast.edit = (options) => interaction.editReply(options);

		if (Date.now() > cast.deadline) {
			await finish(castId, cast, { lost: 'Too slow!', note: `Too slow. ${gotAway(cast)}` });
		} else if (direction !== cast.direction) {
			await finish(castId, cast, {
				lost: 'Wrong way!',
				note: `You pulled ${direction}, but the fish went ${cast.direction}. ${gotAway(cast)}`
			});
		} else if (++cast.done === cast.pulls) {
			await finish(castId, cast, { caught: true });
		} else {
			// The fish turns and pulls somewhere new.
			cast.direction = randomDirection(cast.direction);
			await showPull(castId, cast);
		}
	}
} satisfies Command;
