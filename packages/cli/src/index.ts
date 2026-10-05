#!/usr/bin/env bun
import { settings } from '@clack/prompts';
import { type ArgsDef, type CommandDef, renderUsage, runMain } from 'citty';
import { cli } from './commands';
import { interactive } from './flows/menu';
import { printBlock } from './lib/frame';
import { imageProtocol } from './lib/image';

const PREVIEW_COMMANDS = new Set(['browse', 'view']);

async function showUsage<T extends ArgsDef = ArgsDef>(
  command: CommandDef<T>,
  parent?: CommandDef<T>
) {
  printBlock(await renderUsage(command, parent));
}

settings.aliases.delete('escape');

const [command, ...rest] = process.argv.slice(2);

if (!command || PREVIEW_COMMANDS.has(command)) {
  await imageProtocol();
}

if (command === 'help') {
  await runMain(cli, { rawArgs: [...rest, '--help'], showUsage });
} else if (command) {
  await runMain(cli, { showUsage });
} else {
  await interactive();
}
