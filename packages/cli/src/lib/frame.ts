import { S_BAR, S_BAR_END, S_BAR_START } from '@clack/prompts';
import { banner, gray } from './theme';

export function openFrame() {
  process.stdout.write(`\n${gray(S_BAR_START)}  ${banner()}\n`);
}

export function closeFrame(message: string) {
  process.stdout.write(`${gray(S_BAR)}\n${gray(S_BAR_END)}  ${message}\n`);
}

export function printBlock(text: string) {
  process.stdout.write(`\n${text.trim()}\n`);
}
