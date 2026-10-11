/**
 * Client mirror of `app/decks/tags.py` — the server is the authority (it
 * normalises again and 422s), this just keeps the editor honest as you type.
 */
export const MAX_TAGS = 10;
export const MAX_TAG_LENGTH = 24;

export function normalizeTag(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').toLowerCase();
}
