import type {
  ChatRequest,
  ChatResponse,
  DeckGenerateRequest,
  DeckGenerateResponse,
  DeckListParams,
  DeckListResponse,
  DeckResponse,
} from '../types/api';
import { getAccessToken } from './supabase';

/**
 * All backend calls go through the Next.js rewrite in `next.config.ts`
 * (`/api/:path*` -> `${API_ORIGIN}/api/:path*`), so the origin is never
 * hardcoded here — the browser always talks to its own origin.
 */
export const API_BASE = '/api/v1';

/* ------------------------------------------------------------------ errors */

/**
 * The single error type every function in this module throws for anything the
 * backend (or the network) got wrong. Caller-initiated aborts are the one
 * exception: those are re-thrown untouched so `AbortError` keeps its identity.
 */
export class ApiError extends Error {
  /** HTTP status, or `0` when the request never reached the server. */
  readonly status: number;
  /** Parsed response body when there was one, otherwise `undefined`. */
  readonly body: unknown;
  /** The underlying failure for transport errors. */
  readonly cause: unknown;

  constructor(message: string, status: number, body?: unknown, cause?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
    this.cause = cause;
  }

  /** `true` for 4xx. */
  get isClientError(): boolean {
    return this.status >= 400 && this.status < 500;
  }

  /** `true` for 5xx. */
  get isServerError(): boolean {
    return this.status >= 500;
  }

  /** `true` when the request never got a response at all. */
  get isNetworkError(): boolean {
    return this.status === 0;
  }
}

/**
 * Whether a thrown value is a caller-initiated abort rather than a real failure.
 *
 * Duck-typed on `name` rather than `instanceof Error`: aborts arrive as a
 * `DOMException`, which does not inherit from `Error` in every environment
 * (jsdom included).
 */
export function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { name?: unknown }).name === 'AbortError'
  );
}

/* ------------------------------------------------------------------- auth */

export type AuthTokenProvider = () => string | null | Promise<string | null>;

/**
 * Resolves the bearer token from the live Supabase session. Failing to reach
 * Supabase (or running before env vars exist) must not break unauthenticated
 * calls, so this degrades to `null` rather than throwing.
 */
const supabaseTokenProvider: AuthTokenProvider = async () => {
  if (typeof window === 'undefined') return null;
  try {
    return await getAccessToken();
  } catch {
    return null;
  }
};

let tokenProvider: AuthTokenProvider = supabaseTokenProvider;

/** Override how the bearer token is resolved. Pass `null` to restore the default. */
export function setAuthTokenProvider(provider: AuthTokenProvider | null): void {
  tokenProvider = provider ?? supabaseTokenProvider;
}

/* ----------------------------------------------------------------- request */

export interface RequestOptions {
  signal?: AbortSignal;
  /**
   * Explicit bearer token. `undefined` asks the configured provider;
   * `null` forces an unauthenticated request.
   */
  token?: string | null;
}

interface RequestSpec extends RequestOptions {
  method: 'GET' | 'POST' | 'DELETE';
  path: string;
  query?: Record<string, string | number | undefined>;
  body?: unknown;
}

function buildUrl(path: string, query?: RequestSpec['query']): string {
  const url = `${API_BASE}${path}`;
  if (!query) return url;

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

/**
 * FastAPI puts the human-readable reason in `detail`, which is a string for
 * `HTTPException` and an array of `{loc, msg, type}` for 422 validation errors.
 */
function messageFromBody(body: unknown, fallback: string): string {
  if (typeof body === 'string' && body.trim()) return body.trim();
  if (!body || typeof body !== 'object') return fallback;

  const detail = (body as { detail?: unknown }).detail;
  if (typeof detail === 'string' && detail.trim()) return detail.trim();

  if (Array.isArray(detail)) {
    const messages = detail
      .map((entry) => (entry && typeof entry === 'object' ? (entry as { msg?: unknown }).msg : undefined))
      .filter((msg): msg is string => typeof msg === 'string' && msg.length > 0);
    if (messages.length) return messages.join('; ');
  }

  return fallback;
}

/** Reads the body once, as JSON when the server says so, as text otherwise. */
async function readBody(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;

  const raw = await response.text().catch(() => '');
  if (!raw) return undefined;

  if (response.headers.get('content-type')?.includes('application/json')) {
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return raw;
    }
  }
  return raw;
}

async function resolveToken(explicit: string | null | undefined): Promise<string | null> {
  if (explicit !== undefined) return explicit;
  try {
    return await tokenProvider();
  } catch {
    return null;
  }
}

async function request<T>(spec: RequestSpec): Promise<T> {
  const { method, path, query, body, signal, token } = spec;

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const bearer = await resolveToken(token);
  if (bearer) headers.Authorization = `Bearer ${bearer}`;

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    // A caller-initiated abort is not an API failure — let it through as-is.
    if (isAbortError(error)) throw error;
    const reason = error instanceof Error ? error.message : String(error);
    throw new ApiError(`Could not reach the Magic Grimoire API: ${reason}`, 0, undefined, error);
  }

  const parsed = await readBody(response);

  if (!response.ok) {
    throw new ApiError(
      messageFromBody(parsed, `${method} ${path} failed with ${response.status} ${response.statusText}`.trim()),
      response.status,
      parsed,
    );
  }

  return parsed as T;
}

/* ------------------------------------------------------------------ decks */

/** `POST /api/v1/decks/generate` — 202, enqueues generation. Works signed out. */
export function generateDeck(
  body: DeckGenerateRequest,
  options: RequestOptions = {},
): Promise<DeckGenerateResponse> {
  return request<DeckGenerateResponse>({ ...options, method: 'POST', path: '/decks/generate', body });
}

/** `GET /api/v1/decks` — the caller's saved decks. Requires auth (401 otherwise). */
export function listDecks(
  params: DeckListParams = {},
  options: RequestOptions = {},
): Promise<DeckListResponse> {
  return request<DeckListResponse>({
    ...options,
    method: 'GET',
    path: '/decks',
    query: { page: params.page, limit: params.limit },
  });
}

/** `GET /api/v1/decks/{deck_id}` — anonymous decks are readable without auth. */
export function getDeck(deckId: string, options: RequestOptions = {}): Promise<DeckResponse> {
  return request<DeckResponse>({
    ...options,
    method: 'GET',
    path: `/decks/${encodeURIComponent(deckId)}`,
  });
}

/** `DELETE /api/v1/decks/{deck_id}` — 204. Requires auth and ownership. */
export async function deleteDeck(deckId: string, options: RequestOptions = {}): Promise<void> {
  await request<void>({
    ...options,
    method: 'DELETE',
    path: `/decks/${encodeURIComponent(deckId)}`,
  });
}

/* ------------------------------------------------------------------- chat */

/** `POST /api/v1/chat` — conversational deck refinement. Works signed out. */
export function sendChat(body: ChatRequest, options: RequestOptions = {}): Promise<ChatResponse> {
  return request<ChatResponse>({ ...options, method: 'POST', path: '/chat', body });
}

/** URL of the progress stream for a task. Deliberately unauthenticated server-side. */
export function taskStreamUrl(taskId: string): string {
  return `${API_BASE}/tasks/${encodeURIComponent(taskId)}/stream`;
}
