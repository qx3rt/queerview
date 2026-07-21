#!/usr/bin/env node
// Internal maintainer tool (doc §7.2): drafts a Queerview title entry from
// TMDB ID + media type + a file of PUBLIC source text (Wikipedia excerpt,
// review, fan wiki page) — never from TMDB API responses, per TMDB's
// prohibition on AI use of their content. Output is a draft for maintainer
// review, never published directly.
//
// Usage:
//   npm run pretag -- --tmdb-id 12345 --media-type movie --source ./notes.txt
//
// Requires ANTHROPIC_API_KEY in the environment (get one at
// https://console.anthropic.com/settings/keys). This is separate from the
// TMDB PUBLIC_TMDB_TOKEN in .env — never expose this key client-side.

import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const TAGS_DIR = path.join(ROOT, 'data', 'tags');
const DRAFTS_DIR = path.join(ROOT, 'data', 'titles', '_drafts');

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      args[key] = argv[i + 1];
      i++;
    }
  }
  return args;
}

function loadVocab(name) {
  const raw = readFileSync(path.join(TAGS_DIR, `${name}.json`), 'utf-8');
  return JSON.parse(raw).map((t) => t.slug);
}

function buildSchema(vocab) {
  return {
    type: 'object',
    properties: {
      spicy_level: { type: 'integer', enum: [1, 2, 3, 4, 5] },
      subtitles_available: { type: 'array', items: { type: 'string' } },
      audio_languages: { type: 'array', items: { type: 'string' } },
      queer_characters: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            identities: { type: 'array', items: { type: 'string', enum: vocab.identities } },
            rep_quality: { type: 'string', enum: vocab.rep_quality },
            source: { type: 'string', enum: vocab.source_types },
            notes: { type: 'string' },
            contested: { type: 'boolean' },
            contest_notes: { type: 'string' },
          },
          required: ['name', 'identities', 'rep_quality', 'source', 'notes', 'contested', 'contest_notes'],
          additionalProperties: false,
        },
      },
      queer_creators: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            role: { type: 'string', enum: vocab.creator_roles },
            identities: { type: 'array', items: { type: 'string', enum: vocab.identities } },
            source: { type: 'string', enum: vocab.source_types },
            notes: { type: 'string' },
          },
          required: ['name', 'role', 'identities', 'source', 'notes'],
          additionalProperties: false,
        },
      },
      trigger_warnings: { type: 'array', items: { type: 'string', enum: vocab.trigger_warnings } },
      rep_tropes: { type: 'array', items: { type: 'string', enum: vocab.rep_tropes } },
      community_tags: { type: 'array', items: { type: 'string', enum: vocab.community_tags } },
      contributor_notes: { type: 'string' },
    },
    required: [
      'spicy_level',
      'subtitles_available',
      'audio_languages',
      'queer_characters',
      'queer_creators',
      'trigger_warnings',
      'rep_tropes',
      'community_tags',
      'contributor_notes',
    ],
    additionalProperties: false,
  };
}

const SYSTEM_PROMPT = `You are drafting a title entry for Queerview, a community-powered queer film and TV database. Your draft will be reviewed and corrected by a human maintainer before publication — never treat it as final.

Values: truthfulness (tags are sourced and contestable), welcome, humility (no single queer experience is universal).

Rules:
- Every identity tag on a character or creator MUST be backed by a source type reflecting how confident that claim is. Use "inferred" for your own reading of subtext; reserve "confirmed-by-creator" and "explicit-in-text" for claims the source text actually states.
- Use the "queer" umbrella identity when the source text doesn't support a more specific label.
- Trope and rep_quality tags require a brief, specific "notes" argument — not just a label.
- If a character's queerness is genuinely disputed by the source text or by different interpretations mentioned in it, set contested: true and summarize the disagreement in contest_notes.
- Only draw on the provided source text. Do not use outside knowledge about the title beyond what's given.
- It is fine to leave arrays empty (e.g. no trigger_warnings) if the source text doesn't support any entries — do not invent content to fill fields.
- subtitles_available and audio_languages: only include languages the source text actually mentions; leave empty if not discussed.`;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { 'tmdb-id': tmdbIdRaw, 'media-type': mediaType, source } = args;

  if (!tmdbIdRaw || !mediaType || !source) {
    console.error('Usage: npm run pretag -- --tmdb-id <id> --media-type <movie|tv> --source <path-to-text-file>');
    process.exit(1);
  }
  if (mediaType !== 'movie' && mediaType !== 'tv') {
    console.error('--media-type must be "movie" or "tv"');
    process.exit(1);
  }
  const tmdbId = Number(tmdbIdRaw);
  if (!Number.isInteger(tmdbId) || tmdbId <= 0) {
    console.error('--tmdb-id must be a positive integer');
    process.exit(1);
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY is not set. Get one at https://console.anthropic.com/settings/keys');
    process.exit(1);
  }

  const sourceText = readFileSync(path.resolve(source), 'utf-8');

  const vocab = {
    identities: loadVocab('identities'),
    rep_quality: loadVocab('rep_quality'),
    source_types: loadVocab('source_types'),
    creator_roles: loadVocab('creator_roles'),
    trigger_warnings: loadVocab('trigger_warnings'),
    rep_tropes: loadVocab('rep_tropes'),
    community_tags: loadVocab('community_tags'),
  };
  const schema = buildSchema(vocab);

  console.log(`Drafting entry for TMDB #${tmdbId} (${mediaType}) from ${source}...`);

  const client = new Anthropic();
  const response = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 8000,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'high', format: { type: 'json_schema', schema } },
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Source text for TMDB ${mediaType} #${tmdbId}:\n\n${sourceText}`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock) {
    console.error('No text content in response — check stop_reason:', response.stop_reason);
    process.exit(1);
  }
  const draft = JSON.parse(textBlock.text);

  const entry = {
    tmdb_id: tmdbId,
    media_type: mediaType,
    added_by: 'ai-draft',
    verified: false,
    ...draft,
    queer_creators: draft.queer_creators.map((c) => ({ tmdb_person_id: null, ...c })),
  };

  if (!existsSync(DRAFTS_DIR)) mkdirSync(DRAFTS_DIR, { recursive: true });
  const outPath = path.join(DRAFTS_DIR, `${tmdbId}.json`);
  writeFileSync(outPath, `${JSON.stringify(entry, null, 2)}\n`);

  console.log(`Draft written to ${path.relative(ROOT, outPath)}`);
  console.log('Review before publishing: fill in tmdb_person_id for each creator, verify sourcing, then move the file to data/titles/ and set verified: true.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
