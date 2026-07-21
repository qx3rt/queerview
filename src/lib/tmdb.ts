const TMDB_API_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

export interface TmdbMovie {
  id: number;
  title: string;
  overview: string;
  release_date: string;
  runtime: number | null;
  poster_path: string | null;
  original_language: string;
  genres: { id: number; name: string }[];
  spoken_languages: { iso_639_1: string; english_name: string }[];
  credits?: {
    cast: { id: number; name: string; character: string }[];
    crew: { id: number; name: string; job: string }[];
  };
}

export interface TmdbTvShow {
  id: number;
  name: string;
  overview: string;
  first_air_date: string;
  number_of_seasons: number;
  poster_path: string | null;
  original_language: string;
  genres: { id: number; name: string }[];
  spoken_languages: { iso_639_1: string; english_name: string }[];
  credits?: {
    cast: { id: number; name: string; character: string }[];
    crew: { id: number; name: string; job: string }[];
  };
}

export interface TmdbPerson {
  id: number;
  name: string;
  biography: string;
  profile_path: string | null;
  known_for_department: string;
}

class TmdbNotConfiguredError extends Error {
  constructor() {
    super('PUBLIC_TMDB_TOKEN is not set. Add it to .env — see .env.example for instructions.');
    this.name = 'TmdbNotConfiguredError';
  }
}

function getToken(): string {
  const token = import.meta.env.PUBLIC_TMDB_TOKEN;
  if (!token) throw new TmdbNotConfiguredError();
  return token;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function tmdbFetch<T>(path: string, retriesLeft = 5): Promise<T> {
  const res = await fetch(`${TMDB_API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${getToken()}`,
      accept: 'application/json',
    },
  });
  if (res.status === 429 && retriesLeft > 0) {
    const retryAfterHeader = res.headers.get('Retry-After');
    const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : 1000 * (6 - retriesLeft);
    await sleep(retryAfterMs);
    return tmdbFetch<T>(path, retriesLeft - 1);
  }
  if (!res.ok) {
    throw new Error(`TMDB request failed (${res.status}): ${path}`);
  }
  return res.json() as Promise<T>;
}

export function isTmdbConfigured(): boolean {
  return Boolean(import.meta.env.PUBLIC_TMDB_TOKEN);
}

export function tmdbPosterUrl(posterPath: string | null, size: 'w200' | 'w342' | 'w500' = 'w342'): string | null {
  return posterPath ? `${TMDB_IMAGE_BASE}/${size}${posterPath}` : null;
}

export function tmdbProfileUrl(profilePath: string | null, size: 'w185' | 'h632' = 'w185'): string | null {
  return profilePath ? `${TMDB_IMAGE_BASE}/${size}${profilePath}` : null;
}

export async function getMovie(id: number): Promise<TmdbMovie> {
  return tmdbFetch<TmdbMovie>(`/movie/${id}?append_to_response=credits`);
}

export async function getTvShow(id: number): Promise<TmdbTvShow> {
  return tmdbFetch<TmdbTvShow>(`/tv/${id}?append_to_response=credits`);
}

export async function getPerson(id: number): Promise<TmdbPerson> {
  return tmdbFetch<TmdbPerson>(`/person/${id}`);
}
