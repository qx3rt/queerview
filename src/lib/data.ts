import type { TagDefinition, TitleEntry } from './types';

const titleModules = import.meta.glob<{ default: TitleEntry }>('../../data/titles/*.json', { eager: true });
const tagModules = import.meta.glob<{ default: TagDefinition[] }>('../../data/tags/*.json', { eager: true });

export function getAllTitles(): TitleEntry[] {
  return Object.values(titleModules).map((mod) => mod.default);
}

export function getTitle(tmdbId: number): TitleEntry | undefined {
  return getAllTitles().find((t) => t.tmdb_id === tmdbId);
}

function tagFileFor(vocab: string): TagDefinition[] {
  const entry = Object.entries(tagModules).find(([path]) => path.endsWith(`/${vocab}.json`));
  return entry ? entry[1].default : [];
}

export function getTagVocab(vocab: string): TagDefinition[] {
  return tagFileFor(vocab);
}

export const TAG_VOCABULARIES = [
  'identities',
  'rep_quality',
  'rep_tropes',
  'trigger_warnings',
  'community_tags',
  'genres',
  'creator_roles',
  'source_types',
] as const;

export function getAllTagVocabs(): Record<string, TagDefinition[]> {
  return Object.fromEntries(TAG_VOCABULARIES.map((v) => [v, getTagVocab(v)]));
}

export function labelFor(vocab: string, slug: string): string {
  return getTagVocab(vocab).find((t) => t.slug === slug)?.label ?? slug;
}
