/**
 * Wire types for `apps/api-server`, mirrored 1:1 from the backend source of truth.
 *
 * Field names are the backend's snake_case JSON keys verbatim — never camelCase
 * them here, or the shapes stop describing what actually crosses the wire.
 *
 * Sources:
 *   app/core/enums.py     — every enum below
 *   app/decks/dtos.py     — CardInDeck, DeckGenerate*, DeckResponse, DeckListResponse
 *   app/tasks/dtos.py     — TaskStatusResponse
 *   app/chat/dtos.py      — ChatMessage, ChatContext, ChatRequest, ChatResponse
 *   app/decks/pipeline.py — TaskProgressEvent (the SSE payload)
 */

/* ------------------------------------------------------------------ enums */

export const DECK_STATUSES = ['pending', 'processing', 'completed', 'failed'] as const;
export type DeckStatus = (typeof DECK_STATUSES)[number];

export const TASK_STATUSES = ['queued', 'processing', 'completed', 'failed'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PROGRESS_VALUES = [
  'processing',
  'searching_cards',
  'composing_deck',
  'enriching',
  'completed',
  'failed',
] as const;
export type TaskProgress = (typeof TASK_PROGRESS_VALUES)[number];

export const DECK_FORMATS = ['standard', 'modern', 'pioneer', 'legacy', 'commander'] as const;
export type DeckFormat = (typeof DECK_FORMATS)[number];

/** `MTGColor` in the backend — includes colourless. Used by deck generation. */
export const MTG_COLORS = ['W', 'U', 'B', 'R', 'G', 'C'] as const;
export type MTGColor = (typeof MTG_COLORS)[number];

/**
 * Chat context colours. The backend's `_ManaColor` literal in `app/chat/dtos.py`
 * deliberately omits `C`, so this is NOT the same set as `MTGColor`.
 */
export const CHAT_COLORS = ['W', 'U', 'B', 'R', 'G'] as const;
export type ChatColor = (typeof CHAT_COLORS)[number];

export type ChatRole = 'user' | 'assistant';

/* ------------------------------------------------------------------ decks */

export interface CardInDeck {
  name: string;
  quantity: number;
  scryfall_id: string | null;
  image_uri: string | null;
  mana_cost: string | null;
  type_line: string | null;
  section: string;
}

/** `prompt` is 1..2000 chars, `deck_size` is 60..250 — both enforced server-side. */
export interface DeckGenerateRequest {
  prompt: string;
  format?: DeckFormat;
  colors?: MTGColor[] | null;
  deck_size?: number;
}

export interface DeckGenerateResponse {
  task_id: string;
  /** UUID of the deck row created up-front, before generation runs. */
  deck_id: string;
  status: DeckStatus;
}

/**
 * `format` and `colors` are plain strings in `DeckResponseDTO`, not the enums —
 * they are read back off the ORM model rather than re-validated.
 */
export interface DeckResponse {
  id: string;
  title: string | null;
  prompt: string;
  format: string;
  colors: string[] | null;
  cards: CardInDeck[] | null;
  card_count: number;
  status: DeckStatus;
  error_message: string | null;
  /** ISO-8601 timestamps. */
  created_at: string;
  completed_at: string | null;
  failed_at: string | null;
}

export interface DeckListResponse {
  decks: DeckResponse[];
  total: number;
  page: number;
  pages: number;
}

/** Query params for `GET /decks`. `page >= 1`, `1 <= limit <= 100` (default 20). */
export interface DeckListParams {
  page?: number;
  limit?: number;
}

/* ------------------------------------------------------------------ tasks */

/**
 * `TaskStatusResponseDTO` exists in `app/tasks/dtos.py` but no route returns it
 * today — the only task endpoint is the SSE stream. Kept for parity.
 */
export interface TaskStatusResponse {
  id: string;
  status: TaskStatus;
  message: string | null;
}

/**
 * The SSE payload. Published by `DeckGenerationPipeline._publish` as a bare
 * `{"status", "message"}` dict — there is no `id` field on the wire.
 *
 * The endpoint also emits one synthetic event of this shape when the task had
 * already finished before the client subscribed; its `status` is a `TaskStatus`,
 * but only the terminal values, which are also valid `TaskProgress` values.
 */
export interface TaskProgressEvent {
  status: TaskProgress;
  message: string;
}

/* ------------------------------------------------------------------- chat */

export interface ChatMessage {
  role: ChatRole;
  /** 1..2000 chars. */
  content: string;
}

export interface ChatContext {
  format?: DeckFormat | null;
  colors?: ChatColor[] | null;
  /** Free-form, max 50 chars, screened for prompt injection server-side. */
  strategy?: string | null;
}

export interface ChatRequest {
  /** 1..20 messages. */
  messages: ChatMessage[];
  context?: ChatContext | null;
}

export interface ChatResponse {
  message: string;
}
