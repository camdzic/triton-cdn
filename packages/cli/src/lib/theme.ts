import pc from 'picocolors';

type RGB = readonly [number, number, number];

const VIOLET: RGB = [167, 139, 250];
const CYAN: RGB = [103, 232, 249];

function truecolor(rgb: RGB) {
  return (text: string) =>
    pc.isColorSupported ? `\x1b[38;2;${rgb.join(';')}m${text}\x1b[39m` : text;
}

function mix(from: RGB, to: RGB, ratio: number): RGB {
  return [
    Math.round(from[0] + (to[0] - from[0]) * ratio),
    Math.round(from[1] + (to[1] - from[1]) * ratio),
    Math.round(from[2] + (to[2] - from[2]) * ratio)
  ];
}

export const brand = truecolor(VIOLET);
export const accent = truecolor(CYAN);
export const { dim, gray, bold, red, green, yellow } = pc;

export function gradient(text: string) {
  const chars = [...text];
  return chars
    .map((char, index) =>
      truecolor(mix(VIOLET, CYAN, index / Math.max(1, chars.length - 1)))(char)
    )
    .join('');
}

export function banner() {
  return `${pc.bold(gradient('◆ triton'))} ${pc.dim('encrypted cdn')}`;
}

export function link(url: string) {
  return pc.underline(accent(url));
}
