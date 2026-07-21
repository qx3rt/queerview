export type MediaType = 'movie' | 'tv';

export type SourceType =
  | 'self-identified-public'
  | 'confirmed-by-creator'
  | 'explicit-in-text'
  | 'fan-consensus'
  | 'inferred';

export type RepQuality =
  | 'positive'
  | 'mixed'
  | 'tokenized'
  | 'harmful'
  | 'historical-context';

export interface QueerCharacter {
  name: string;
  identities: string[];
  rep_quality: RepQuality;
  source: SourceType;
  notes: string;
  contested: boolean;
  contest_notes: string;
}

export interface QueerCreator {
  tmdb_person_id: number;
  name: string;
  role: string;
  identities: string[];
  source: SourceType;
  notes: string;
}

export interface TitleEntry {
  tmdb_id: number;
  media_type: MediaType;
  added_by: string;
  verified: boolean;
  spicy_level: 1 | 2 | 3 | 4 | 5;
  subtitles_available: string[];
  audio_languages: string[];
  original_language_override: string | null;
  queer_characters: QueerCharacter[];
  queer_creators: QueerCreator[];
  trigger_warnings: string[];
  rep_tropes: string[];
  community_tags: string[];
  contributor_notes: string;
}

export interface TagDefinition {
  slug: string;
  label: string;
  description: string;
}
