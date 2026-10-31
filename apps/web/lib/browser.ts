const BROWSERS: ReadonlyArray<readonly [RegExp, string]> = [
  [/Edg\//, 'Edge'],
  [/OPR\//, 'Opera'],
  [/Firefox\//, 'Firefox'],
  [/Chrome\//, 'Chrome'],
  [/Safari\//, 'Safari']
];

const PLATFORMS: ReadonlyArray<readonly [RegExp, string]> = [
  [/Windows/, 'Windows'],
  [/iPhone|iPad/, 'iOS'],
  [/Mac OS X/, 'macOS'],
  [/Android/, 'Android'],
  [/Linux/, 'Linux']
];

function match(
  agent: string,
  table: ReadonlyArray<readonly [RegExp, string]>,
  fallback: string
) {
  for (const [pattern, name] of table) {
    if (pattern.test(agent)) {
      return name;
    }
  }

  return fallback;
}

export function browserName() {
  return match(navigator.userAgent, BROWSERS, 'Browser');
}

export function deviceName() {
  const agent = navigator.userAgent;

  return `Web · ${match(agent, BROWSERS, 'Browser')} on ${match(agent, PLATFORMS, 'unknown')}`;
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);

    return true;
  } catch {
    return false;
  }
}

export function saveFile(name: string, contents: string, type: string) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = name;
  anchor.click();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
