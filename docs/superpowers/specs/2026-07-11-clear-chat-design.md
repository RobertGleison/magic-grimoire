# Clear Chat — Design

## Problem

The deck-builder chat (`apps/web-app/app/deck-builder/page.tsx`) has no way to reset a conversation. Messages live only in local React state (`messages`) and are never persisted, but there's still no UI affordance to clear them mid-session — the user currently has to refresh the page.

## Context

Chat is fully stateless on the backend (`apps/api-server/app/chat/routes.py`): the frontend rebuilds and posts the entire message history on every request. There is no session/conversation id and no server-side memory. "Context" sent to the backend is just the current OptionsPanel selections (format/colors/strategy), not a separate thing from the chat messages. So "clear chat" and "clear context" collapse into a single action: reset the frontend `messages` state. No backend changes are needed.

## Design

**State/handlers (`page.tsx`)**
- Add `handleClearChat`, a `useCallback` that resets `messages` to `[]` and `input` to `''`.
- Compute a `disableClear` flag as `loading || chatBusy` and pass it down — this prevents clearing while a deck generation stream or a chat reply is in flight, avoiding orphaned requests that reference a now-empty message array. (Existing code in `updateLastOracleMessage`/`fetchDeck` already no-ops safely if it can't find a message to patch, so this is a UX safeguard, not a crash-prevention one — but disabling during in-flight work is clearer for the user anyway.)

**Props (`OptionsPanel.tsx`)**
- Add `onClearChat: () => void` and `disableClear: boolean` to `OptionsPanelProps`.
- Add a new section below the existing "Deck Size" section (after a divider), following the same visual pattern as the existing "clear selection" button used for colors (`options-panel-clear-btn` class). The button is disabled when `disableClear` is true.

**Scope**
- Only `messages` and the in-progress `input` draft are cleared.
- `activeDeck` (the DeckPanel on the right), OptionsPanel selections (format, colors, deck size), and any already-generated deck are left untouched.
- Clearing results in a completely empty message list (no welcome message re-appears).

## Out of scope

- No backend endpoint (nothing to clear server-side).
- No confirmation dialog (clear is immediate).
- No reset of OptionsPanel selections or the active deck.

## Testing plan

Manual verification in the browser:
1. Button is disabled while a deck is generating or a chat reply is loading.
2. Clicking it while idle empties the message list completely.
3. OptionsPanel selections (format/colors/deck size) are unchanged after clearing.
4. Any currently displayed deck in DeckPanel remains visible after clearing.
