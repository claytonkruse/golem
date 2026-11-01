import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Command } from './command.ts';
import type { Event } from './event.ts';

async function sourceFiles(directory: string): Promise<string[]> {
	const entries = await readdir(directory);
	return entries.filter((file) => file.endsWith('.ts') && !file.endsWith('.d.ts')).sort();
}

function isCommand(value: unknown): value is Command {
	if (typeof value !== 'object' || value === null || !('data' in value) || !('execute' in value)) {
		return false;
	}
	const command = value as { data?: { toJSON?: unknown }; execute?: unknown };
	return typeof command.execute === 'function' && typeof command.data?.toJSON === 'function';
}

function isEvent(value: unknown): value is Event {
	if (typeof value !== 'object' || value === null || !('name' in value) || !('execute' in value)) {
		return false;
	}
	const event = value as { name?: unknown; execute?: unknown };
	return typeof event.name === 'string' && typeof event.execute === 'function';
}

export async function loadCommands(): Promise<Command[]> {
	const directory = path.join(import.meta.dirname, '../commands');
	const commands: Command[] = [];

	for (const file of await sourceFiles(directory)) {
		const mod = (await import(pathToFileURL(path.join(directory, file)).href)) as {
			command?: unknown;
		};
		if (!isCommand(mod.command)) {
			throw new Error(`${file} must export \`command\` with data and execute.`);
		}
		commands.push(mod.command);
	}

	return commands;
}

export async function loadEvents(): Promise<Event[]> {
	const directory = path.join(import.meta.dirname, '../events');
	const events: Event[] = [];

	for (const file of await sourceFiles(directory)) {
		const mod = (await import(pathToFileURL(path.join(directory, file)).href)) as {
			event?: unknown;
		};
		if (!isEvent(mod.event)) {
			throw new Error(`${file} must export \`event\` with name and execute.`);
		}
		events.push(mod.event);
	}

	return events;
}
