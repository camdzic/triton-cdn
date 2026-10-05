import { openFrame } from './frame';

type Render = () => void;

const ENTER_ALTERNATE = '\x1b[?1049h';
const LEAVE_ALTERNATE = '\x1b[?1049l';
const CLEAR = '\x1b[2J\x1b[3J\x1b[H';

const carried: Render[] = [];

let active = false;

export function leaveScreen() {
  if (!active) {
    return false;
  }

  active = false;
  carried.length = 0;
  process.stdout.write(LEAVE_ALTERNATE);

  if (process.stdin.isTTY) {
    process.stdin.setRawMode(false);
  }

  return true;
}

export function enterScreen() {
  if (!process.stdout.isTTY) {
    return false;
  }

  active = true;
  process.stdout.write(ENTER_ALTERNATE);
  process.once('exit', leaveScreen);

  return true;
}

export function clearScreen() {
  if (active) {
    process.stdout.write(CLEAR);
  }
}

export function freshScreen() {
  if (!active) {
    return;
  }

  clearScreen();
  openFrame();

  for (const render of carried.splice(0)) {
    render();
  }
}

export function carry(render: Render) {
  if (active) {
    carried.push(render);
  }
}

export function persist(render: Render) {
  render();
  carry(render);
}
