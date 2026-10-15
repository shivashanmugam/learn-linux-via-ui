import { assemble, type Program } from './cpu/assembler.ts';
import { EXAMPLES, type Example } from './cpu/programs.ts';

export const GITHUB_PROFILE_URL = 'https://github.com/shivashanmugam';
export const REPO_URL = 'https://github.com/shivashanmugam/linux-as-ui';
export const COFFEE_URL = 'https://buymeacoffee.com/sivakannan';

export type PageId = 'home' | 'big-picture' | 'processor';

export const PAGES: Record<PageId, { path: string; title: string; short: string }> = {
  home: { path: '', title: 'Inside a tiny CPU', short: 'Home' },
  'big-picture': { path: 'big-picture/', title: 'Part 1 · The big picture', short: 'Part 1 · The big picture' },
  processor: { path: 'processor/', title: 'Part 2 · Watch the processor run the program', short: 'Part 2 · The processor' },
};

/** A program shared between pages: either a built-in example or custom source text. */
export type SharedProgram = { example: Example; source: string } | { example: null; source: string };

export function pageHref(page: PageId, params?: Record<string, string>): string {
  const query = params ? new URLSearchParams(params).toString() : '';
  return `${import.meta.env.BASE_URL}${PAGES[page].path}${query ? `?${query}` : ''}`;
}

export const programParams = (p: SharedProgram): Record<string, string> =>
  p.example && p.source === p.example.source ? { example: p.example.id } : { src: p.source };

/** Reads `?example=id` or `?src=...` from the current URL, falling back to the first example. */
export function readSharedProgram(): SharedProgram {
  const params = new URLSearchParams(window.location.search);
  const src = params.get('src');
  if (src !== null) return { example: null, source: src };
  const example = EXAMPLES.find((e) => e.id === params.get('example')) ?? EXAMPLES[0];
  return { example, source: example.source };
}

export function assembleOrThrow(source: string, what: string): Program {
  const result = assemble(source);
  if (!result.ok) throw new Error(`${what} does not assemble: ${result.errors[0].message}`);
  return result.program;
}
