import type {
	ButtonInteraction,
	InteractionEditReplyOptions,
	Message,
	MessageResolvable
} from 'discord.js';

// Helpers for games that start again from a button on a finished game.

export type EditMessage = (options: InteractionEditReplyOptions) => Promise<unknown>;

// Shows a new game in its own message below the one whose button was pressed. The first
// call posts the message and later calls edit it, so the game never shows placeholder text.
// The button must already be acknowledged.
export function newMessage(interaction: ButtonInteraction): EditMessage {
	let message: MessageResolvable | undefined;
	return async (options) => {
		if (message) return interaction.webhook.editMessage(message, options);
		// Games only send text, images and buttons; a new message has nothing to replace.
		const posted: Message = await interaction.followUp({
			content: options.content ?? undefined,
			files: options.files,
			components: options.components
		});
		message = posted;
		return posted;
	};
}

// Each finished game's "play again" button starts one game. A double click, or a press
// already on its way when the button was removed, would otherwise start a second.
const claimed = new Set<string>();
const CLAIM_MS = 60_000;

export function claimOnce(messageId: string): boolean {
	if (claimed.has(messageId)) return false;
	claimed.add(messageId);
	// By then the button is long gone from the message.
	setTimeout(() => claimed.delete(messageId), CLAIM_MS).unref();
	return true;
}

// Gives a claim back when the new game couldn't start, so the button still works later.
export function release(messageId: string): void {
	claimed.delete(messageId);
}
