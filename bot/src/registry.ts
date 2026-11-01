import { Collection } from 'discord.js';
import type { Command } from './lib/command.ts';

export const commands = new Collection<string, Command>();
