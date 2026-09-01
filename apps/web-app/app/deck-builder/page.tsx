'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';

import { Button } from '../components/Button/Button';
import { Spinner } from '../components/Spinner/Spinner';
import { useTaskStream } from '../hooks/useTaskStream';
import { ApiError, generateDeck, getDeck, isAbortError, sendChat } from '../lib/apiClient';
import type { ChatMessage, DeckResponse } from '../types/api';
import { ChatPanel, type ChatEntry } from './ChatPanel';
import { ConfigPanel } from './ConfigPanel';
import { DeckResultsPanel } from './DeckResultsPanel';
import { GenerationProgress } from './GenerationProgress';
import {
  DEFAULT_DECK_CONFIG,
  buildGeneratePrompt,
  chatColors,
  deckFileName,
  deckListText,
  type DeckConfig,
} from './deckLogic';
import styles from './page.module.css';

/* ==========================================================================
   /deck-builder — Figma page `10:4`, workspace `10:22`
   (light `20:647` / `20:665`, colour only; dark is the canonical geometry).

   Wiring, end to end:
     1. `POST /api/v1/chat`            — conversational refinement
     2. `POST /api/v1/decks/generate`  — 202 { task_id, deck_id }
     3. `useTaskStream(task_id)`       — SSE, six TaskProgress values
     4. `GET  /api/v1/decks/{deck_id}` — on the terminal `completed`

   This page is NOT auth-gated. `POST /decks/generate`, `POST /chat` and
   `GET /decks/{id}` all work signed out (verified against the backend in the
   Wave 1b findings), and the deck row is created before generation runs, so an
   anonymous build is recoverable through the `?deck=` permalink.

   The legacy HTTP 429 branch ("You've used your free build") is deliberately
   NOT ported: the backend has no rate limiting anywhere, so it is dead code.

   The workspace geometry is the page's own state, not the design's fixed
   280 / 380 / rest: the config panel retracts to a rail and the chat/deck
   boundary is a draggable splitter. Both feed `--config-w` / `--chat-w` on
   the grid rather than an inline `grid-template-columns`, so the responsive
   rules in page.module.css still win at narrow widths.
   ========================================================================== */

const WELCOME: ChatEntry = {
  id: 'welcome',
  kind: 'assistant',
  content:
    'Describe the deck you want and I will refine it with you. Set the colours, format and size on the left, then forge it when the brief feels right.',
  at: null,
};

/** Backend cap on `ChatRequest.messages`. */
const CHAT_HISTORY_MAX = 20;

/* Workspace geometry. The design's 280 / 380 columns are the starting point;
   the config panel retracts to a rail and the chat/deck boundary is dragged. */
const CONFIG_WIDTH = 280;
const CONFIG_RAIL_WIDTH = 48;
const CHAT_WIDTH_DEFAULT = 380;
const CHAT_WIDTH_MIN = 300;
/** Keyboard nudge on the splitter, per the ARIA window-splitter pattern. */
const CHAT_WIDTH_STEP = 24;

/** The deck panel is the point of the page, so the chat never takes the half. */
function clampChatWidth(width: number): number {
  const ceiling = Math.max(CHAT_WIDTH_MIN, Math.round(window.innerWidth * 0.45));
  return Math.round(Math.min(Math.max(width, CHAT_WIDTH_MIN), ceiling));
}

function errorText(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export default function DeckBuilderPage() {
  const [config, setConfig] = useState<DeckConfig>(DEFAULT_DECK_CONFIG);
  const [entries, setEntries] = useState<ChatEntry[]>([WELCOME]);
  const [draft, setDraft] = useState('');
  const [chatBusy, setChatBusy] = useState(false);

  const [taskId, setTaskId] = useState<string | null>(null);
  const [deckId, setDeckId] = useState<string | null>(null);
  const [deck, setDeck] = useState<DeckResponse | null>(null);

  const [configCollapsed, setConfigCollapsed] = useState(false);
  const [chatWidth, setChatWidth] = useState(CHAT_WIDTH_DEFAULT);

  const [submitting, setSubmitting] = useState(false);
  const [fetchingDeck, setFetchingDeck] = useState(false);
  const [pageError, setPageError] = useState('');
  const [actionNote, setActionNote] = useState('');

  const stream = useTaskStream(taskId);

  /* --------------------------------------------------------- lifecycles */

  // One controller per concern so a chat turn and a deck fetch can never abort
  // one another, and both are torn down when the route unmounts.
  const chatAbort = useRef<AbortController | null>(null);
  const deckAbort = useRef<AbortController | null>(null);
  const generateAbort = useRef<AbortController | null>(null);
  const entrySeq = useRef(0);

  useEffect(
    () => () => {
      chatAbort.current?.abort();
      deckAbort.current?.abort();
      generateAbort.current?.abort();
    },
    [],
  );

  const pushEntry = useCallback((kind: ChatEntry['kind'], content: string) => {
    entrySeq.current += 1;
    const entry: ChatEntry = { id: `e${entrySeq.current}`, kind, content, at: Date.now() };
    setEntries((previous) => [...previous, entry]);
    return entry;
  }, []);

  /* ------------------------------------------------------------- loading */

  const loadDeck = useCallback(async (id: string) => {
    deckAbort.current?.abort();
    const controller = new AbortController();
    deckAbort.current = controller;

    setFetchingDeck(true);
    setPageError('');
    try {
      const loaded = await getDeck(id, { signal: controller.signal });
      if (controller.signal.aborted) return;
      setDeck(loaded);
      setDeckId(loaded.id);
    } catch (error) {
      if (isAbortError(error)) return;
      setDeck(null);
      setPageError(errorText(error, 'Could not load that deck.'));
    } finally {
      if (!controller.signal.aborted) setFetchingDeck(false);
    }
  }, []);

  // `?deck=<uuid>` permalink. Read off `window.location` rather than
  // `useSearchParams`, which would force this route under a Suspense boundary
  // at build time for a value only ever needed on the client.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('deck');
    if (id) void loadDeck(id);
  }, [loadDeck]);

  // Terminal `completed` -> the deck row is written, so read it back.
  useEffect(() => {
    if (stream.phase !== 'completed' || !deckId) return;
    void loadDeck(deckId);
  }, [stream.phase, deckId, loadDeck]);

  // Announce the finished deck in the transcript, once.
  const announced = useRef<string | null>(null);
  useEffect(() => {
    if (!deck || deck.status !== 'completed' || announced.current === deck.id) return;
    announced.current = deck.id;
    pushEntry(
      'assistant',
      `${deck.title?.trim() || 'Your deck'} is compiled — ${deck.card_count} cards for ${deck.format}.`,
    );
  }, [deck, pushEntry]);

  /* ---------------------------------------------------------------- chat */

  const handleSend = useCallback(async () => {
    const content = draft.trim();
    if (!content || chatBusy) return;

    const sent = pushEntry('user', content);
    setDraft('');
    setChatBusy(true);

    chatAbort.current?.abort();
    const controller = new AbortController();
    chatAbort.current = controller;

    // Errors are local annotations, never replayed to the model.
    const history: ChatMessage[] = [...entries, sent]
      .filter((entry) => entry.kind !== 'error' && entry.id !== 'welcome')
      .map((entry) => ({
        role: entry.kind === 'user' ? ('user' as const) : ('assistant' as const),
        content: entry.content.slice(0, 2000),
      }))
      .slice(-CHAT_HISTORY_MAX);

    const contextColors = chatColors(config.colors);

    try {
      const response = await sendChat(
        {
          messages: history,
          context: {
            format: config.format,
            // `C` is dropped: the chat endpoint's `_ManaColor` omits it.
            colors: contextColors.length > 0 ? contextColors : null,
          },
        },
        { signal: controller.signal },
      );
      if (controller.signal.aborted) return;
      pushEntry('assistant', response.message);
    } catch (error) {
      if (isAbortError(error)) return;
      pushEntry('error', errorText(error, 'The alchemist did not answer. Try again.'));
    } finally {
      if (!controller.signal.aborted) setChatBusy(false);
    }
  }, [chatBusy, config, draft, entries, pushEntry]);

  /* ------------------------------------------------------------ generate */

  const userTurns = useMemo(
    () => entries.filter((entry) => entry.kind === 'user').map((entry) => entry.content),
    [entries],
  );

  const prompt = useMemo(
    () => buildGeneratePrompt(userTurns, draft, config),
    [userTurns, draft, config],
  );

  const streaming = stream.phase === 'connecting' || stream.phase === 'streaming';
  const generating = submitting || streaming;

  const generateHint = generating || prompt.length > 0 ? '' : 'Describe your deck first, then forge it.';

  const handleGenerate = useCallback(async () => {
    if (generating || prompt.length === 0) return;

    // The draft doubles as the last brief: fold it into the transcript so the
    // conversation and the generated deck cannot disagree about what was asked.
    if (draft.trim()) {
      pushEntry('user', draft.trim());
      setDraft('');
    }

    setSubmitting(true);
    setPageError('');
    setDeck(null);
    setTaskId(null);
    setDeckId(null);
    announced.current = null;

    generateAbort.current?.abort();
    const controller = new AbortController();
    generateAbort.current = controller;

    try {
      const response = await generateDeck(
        {
          prompt,
          format: config.format,
          colors: config.colors.length > 0 ? config.colors : null,
          // `deck_size` is one `int` server-side; the ceiling rides in `prompt`.
          deck_size: config.deckSizeMin,
        },
        { signal: controller.signal },
      );
      if (controller.signal.aborted) return;
      setDeckId(response.deck_id);
      setTaskId(response.task_id);
    } catch (error) {
      if (isAbortError(error)) return;
      const message = errorText(error, 'The forge refused the request.');
      setPageError(message);
      pushEntry('error', message);
    } finally {
      if (!controller.signal.aborted) setSubmitting(false);
    }
  }, [config, draft, generating, prompt, pushEntry]);

  const handleCancel = useCallback(() => {
    generateAbort.current?.abort();
    deckAbort.current?.abort();
    setSubmitting(false);
    setFetchingDeck(false);
    // Dropping the task id tears the EventSource down through the hook's own
    // cleanup; the server keeps building, and `?deck=` still recovers it.
    setTaskId(null);
    setPageError('Generation stopped. The forge may still finish on the server.');
  }, []);

  /* -------------------------------------------------------------- layout */

  // Pointer capture on the handle, so the drag survives the cursor outrunning
  // a 6px target and ends even if the pointer is released off-window.
  const handleSplitterDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const handle = event.currentTarget;
      const startX = event.clientX;
      const startWidth = chatWidth;

      handle.setPointerCapture(event.pointerId);

      const onMove = (moveEvent: globalThis.PointerEvent) => {
        setChatWidth(clampChatWidth(startWidth + (moveEvent.clientX - startX)));
      };

      const onEnd = () => {
        handle.removeEventListener('pointermove', onMove);
        handle.removeEventListener('pointerup', onEnd);
        handle.removeEventListener('pointercancel', onEnd);
      };

      handle.addEventListener('pointermove', onMove);
      handle.addEventListener('pointerup', onEnd);
      handle.addEventListener('pointercancel', onEnd);
    },
    [chatWidth],
  );

  const handleSplitterKeys = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft') setChatWidth((width) => clampChatWidth(width - CHAT_WIDTH_STEP));
    else if (event.key === 'ArrowRight') setChatWidth((width) => clampChatWidth(width + CHAT_WIDTH_STEP));
    else if (event.key === 'Home' || event.key === 'End') setChatWidth(CHAT_WIDTH_DEFAULT);
    else return;
    event.preventDefault();
  }, []);

  /* ------------------------------------------------------------- actions */

  const note = useCallback((text: string) => {
    setActionNote(text);
    window.setTimeout(() => setActionNote(''), 4000);
  }, []);

  const handleCopyList = useCallback(async () => {
    if (!deck) return;
    try {
      await navigator.clipboard.writeText(deckListText(deck));
      note('Decklist copied.');
    } catch {
      note('Clipboard blocked — use Export TXT.');
    }
  }, [deck, note]);

  const handleCopyLink = useCallback(async () => {
    if (!deck) return;
    const url = `${window.location.origin}${window.location.pathname}?deck=${encodeURIComponent(deck.id)}`;
    try {
      await navigator.clipboard.writeText(url);
      note('Permalink copied.');
    } catch {
      note('Clipboard blocked — copy the URL from the address bar.');
    }
  }, [deck, note]);

  const handleExportText = useCallback(() => {
    if (!deck) return;
    const blob = new Blob([deckListText(deck)], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = deckFileName(deck);
    anchor.click();
    URL.revokeObjectURL(url);
    note('Decklist downloaded.');
  }, [deck, note]);

  /* -------------------------------------------------------------- render */

  return (
    <div
      className={styles.workspace}
      style={
        {
          '--config-w': `${configCollapsed ? CONFIG_RAIL_WIDTH : CONFIG_WIDTH}px`,
          '--chat-w': `${chatWidth}px`,
        } as CSSProperties
      }
    >
      <ConfigPanel
        config={config}
        onChange={setConfig}
        disabled={generating}
        collapsed={configCollapsed}
        onToggleCollapsed={() => setConfigCollapsed((value) => !value)}
      />

      <ChatPanel
        entries={entries}
        draft={draft}
        onDraftChange={setDraft}
        onSend={handleSend}
        onGenerate={handleGenerate}
        chatBusy={chatBusy}
        generating={generating}
        generateHint={generateHint}
      />

      <div
        className={styles.splitter}
        role="separator"
        tabIndex={0}
        aria-orientation="vertical"
        aria-label="Resize the conversation and deck panels"
        aria-valuenow={chatWidth}
        aria-valuemin={CHAT_WIDTH_MIN}
        onPointerDown={handleSplitterDown}
        onKeyDown={handleSplitterKeys}
        onDoubleClick={() => setChatWidth(CHAT_WIDTH_DEFAULT)}
      />

      <div className={styles.resultsColumn}>
        {generating ? (
          <GenerationProgress state={stream} onCancel={handleCancel} />
        ) : stream.phase === 'failed' ? (
          <div className={styles.errorPanel} role="alert">
            <h2 className={styles.errorTitle}>
              {stream.reason === 'transport'
                ? 'Lost the progress stream'
                : 'The forge could not finish'}
            </h2>
            <p className={styles.errorBody}>
              {stream.message ||
                'The generation failed before a deck was written. Adjust the brief and try again.'}
            </p>
            <div className={styles.errorActions}>
              {deckId && (
                <Button variant="subtle" size="sm" className={styles.goldButton} onClick={() => void loadDeck(deckId)}>
                  Check the deck anyway
                </Button>
              )}
              <Button variant="primary" size="sm" onClick={() => void handleGenerate()}>
                Try again
              </Button>
            </div>
          </div>
        ) : fetchingDeck ? (
          <div className={styles.emptyPanel}>
            <Spinner size="lg" label="Loading deck" />
            <p className={styles.emptyBody}>Reading the compiled deck…</p>
          </div>
        ) : pageError ? (
          <div className={styles.errorPanel} role="alert">
            <h2 className={styles.errorTitle}>Something went wrong</h2>
            <p className={styles.errorBody}>{pageError}</p>
            <div className={styles.errorActions}>
              {deckId && (
                <Button variant="subtle" size="sm" className={styles.goldButton} onClick={() => void loadDeck(deckId)}>
                  Retry
                </Button>
              )}
            </div>
          </div>
        ) : deck ? (
          <DeckResultsPanel
            deck={deck}
            actionNote={actionNote}
            onCopyList={() => void handleCopyList()}
            onCopyLink={() => void handleCopyLink()}
            onExportText={handleExportText}
          />
        ) : (
          <div className={styles.emptyPanel}>
            <h2 className={styles.emptyTitle}>Nothing forged yet</h2>
            <p className={styles.emptyBody}>
              Describe a deck in the conversation, tune the colours and format on the left, then
              press Generate Deck. The compiled list, the curve and the colour split appear here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
