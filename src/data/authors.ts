import type { Author, AuthorActivity, AuthorStats } from '../types/portal';
import { SEED_MCPS, PUBLIC_MCPS } from './mcps';
import { PEOPLE } from './people';

function statsFor(handle: string): AuthorStats {
  const mine = SEED_MCPS.filter((m) => m.authorHandle === handle);
  return {
    published: mine.filter((m) => m.status === 'published').length,
    drafts: mine.filter((m) => m.status !== 'published').length,
    installs: mine.reduce((n, m) => n + m.installs, 0),
    stars: mine.reduce((n, m) => n + m.stars, 0),
    tools: mine.reduce((n, m) => n + m.tools.filter((t) => t.validated).length, 0),
  };
}

function activityFor(handle: string): AuthorActivity[] {
  return SEED_MCPS.filter((m) => m.authorHandle === handle && m.status === 'published')
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 5)
    .map((m) => ({
      date: m.updatedAt,
      text: `Publicó ${m.name} · v${m.version} · ${m.tools.filter((t) => t.validated).length} herramientas`,
      slug: m.slug,
    }));
}

export const AUTHORS: Record<string, Author> = Object.fromEntries(
  Object.values(PEOPLE).map((person) => [
    person.handle,
    {
      ...person,
      stats: statsFor(person.handle),
      activity: activityFor(person.handle),
    } satisfies Author,
  ]),
);

export function authorOf(handle: string): Author | null {
  return AUTHORS[handle] ?? null;
}

export function mcpCountByAuthor(handle: string): number {
  return PUBLIC_MCPS.filter((m) => m.authorHandle === handle).length;
}
