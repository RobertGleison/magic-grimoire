'use client';

import { useCallback, useEffect, useRef, type FormEvent, type KeyboardEvent } from 'react';

import { Button } from '../components/Button/Button';
import { Spinner } from '../components/Spinner/Spinner';
import { PROMPT_MAX } from './deckLogic';
import styles from './page.module.css';

/* ==========================================================================
   ChatPanel — Figma node `10:23`
   (title `10:24`, bubbles `10:29` / `10:36`, controls `10:71`).
   --------------------------------------------------------------------------
   `kind` is a three-way discriminant rather than the wire's two-way
   `ChatRole`: a failed `POST /chat` has to be visible in the transcript, but
   it must never be replayed back to the model as an assistant turn. Only
   `user` and `assistant` entries are sent.
   ========================================================================== */

export type ChatEntryKind = 'user' | 'assistant' | 'error';

export interface ChatEntry {
  id: string;
  kind: ChatEntryKind;
  content: string;
  /**
   * Epoch ms, or `null` for the seeded intro bubble. Seeded entries carry no
   * clock on purpose: this component server-renders, and a timestamp formatted
   * on both sides of hydration would mismatch on any non-UTC client.
   */
  at: number | null;
}

const AUTHOR_LABELS: Record<ChatEntryKind, string> = {
  user: 'You',
  assistant: 'Magic Grimoire',
  error: 'Forge Error',
};

function formatClock(at: number): string {
  return new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/* Disabled with the chat title glyph and the Generate button icon — restore
   all three at once (the .chatSparkle / .buttonSparkle rules are still there).

   /** Sparkle mark from the chat title (`10:25`) and the Generate button (`10:80`).
   function Sparkle({ className = '' }: { className?: string }) {
     return (
       <svg className={className} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
         <path
           d="M8 1l1.6 4.4L14 7l-4.4 1.6L8 13l-1.6-4.4L2 7l4.4-1.6z"
           fill="currentColor"
         />
       </svg>
     );
   }
*/

interface ChatPanelProps {
  entries: ChatEntry[];
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  onGenerate: () => void;
  /** A `POST /chat` is in flight. */
  chatBusy: boolean;
  /** A generation is in flight (request or live stream). */
  generating: boolean;
}

export function ChatPanel({
  entries,
  draft,
  onDraftChange,
  onSend,
  onGenerate,
  chatBusy,
  generating,
}: ChatPanelProps) {
  const listRef = useRef<HTMLOListElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // `useAutoScroll` is the marquee helper (horizontal, infinite); a transcript
  // needs a one-shot pin to the bottom, so it stays local.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    list.scrollTop = list.scrollHeight;
  }, [entries, chatBusy]);

  /* Grow the field to fit what has been typed. The height is measured, not
     counted: a wrapped line is a line, so `\n`s in the draft are the wrong
     unit. `max-height` in the stylesheet is the four-line ceiling — past it
     the assignment is clamped and the field scrolls instead. Height is reset
     to `auto` first so `scrollHeight` can shrink back after a deletion. */
  const fitInput = useCallback(() => {
    const input = inputRef.current;
    if (!input) return;
    input.style.height = 'auto';
    input.style.height = `${input.scrollHeight}px`;
  }, []);

  useEffect(fitInput, [draft, fitInput]);

  /* The splitter resizes this column without touching the draft, and a
     narrower field wraps into more lines than the last measurement assumed.
     Only a width change can rewrap, so the height the effect above just wrote
     is ignored — observing it too would re-measure on every keystroke. */
  useEffect(() => {
    const input = inputRef.current;
    if (!input || typeof ResizeObserver === 'undefined') return;

    let lastWidth = input.clientWidth;
    const observer = new ResizeObserver(() => {
      const width = input.clientWidth;
      if (width === lastWidth) return;
      lastWidth = width;
      fitInput();
    });
    observer.observe(input);
    return () => observer.disconnect();
  }, [fitInput]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSend();
  };

  /* A textarea does not submit its form on Enter the way the input it replaced
     did, so the send key is wired by hand: Enter sends, Shift+Enter (and the
     IME's composing Enter) breaks the line. */
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    if (draft.trim().length > 0 && !chatBusy) onSend();
  };

  const canSend = draft.trim().length > 0 && !chatBusy;

  return (
    <section className={styles.chatPanel} aria-label="Deck conversation">
      <h2 className={styles.panelTitle}>
        Magic Grimoire
      </h2>

      <ol className={styles.messages} ref={listRef}>
        {entries.map((entry) => (
          <li
            key={entry.id}
            className={`${styles.bubble} ${
              entry.kind === 'user' ? styles.bubbleUser : styles.bubbleOracle
            } ${entry.kind === 'error' ? styles.bubbleError : ''}`}
          >
            <span className={styles.bubbleHead}>
              <span className={styles.bubbleAuthor}>
                <span className={styles.bubbleDot} aria-hidden="true" />
                {AUTHOR_LABELS[entry.kind]}
              </span>
              {entry.at !== null && (
                <time className={styles.bubbleTime} dateTime={new Date(entry.at).toISOString()}>
                  {formatClock(entry.at)}
                </time>
              )}
            </span>
            <p className={styles.bubbleBody}>{entry.content}</p>
          </li>
        ))}

        {chatBusy && (
          <li className={`${styles.bubble} ${styles.bubbleOracle}`} aria-live="polite">
            <span className={styles.bubbleHead}>
              <span className={styles.bubbleAuthor}>
                <span className={styles.bubbleDot} aria-hidden="true" />
                {AUTHOR_LABELS.assistant}
              </span>
            </span>
            <p className={styles.bubbleBody}>
              <Spinner size="xs" label="" /> Consulting the archives…
            </p>
          </li>
        )}
      </ol>

      <form className={styles.chatControls} onSubmit={handleSubmit}>
        <div className={styles.chatInputBox}>
          <textarea
            ref={inputRef}
            className={styles.chatInput}
            rows={1}
            value={draft}
            maxLength={PROMPT_MAX}
            placeholder="Describe your ideal deck..."
            aria-label="Describe your ideal deck"
            disabled={chatBusy}
            onChange={(event) => onDraftChange(event.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button
            type="submit"
            className={styles.chatSendIcon}
            disabled={!canSend}
            aria-label="Send message"
          >
            <svg viewBox="0 0 14 14" aria-hidden="true" focusable="false">
              <path
                d="M1 13L13 7 1 1l2 6z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        {/* Only Generate lives here. The transcript is sent with Enter or the
            arrow inside the field above, so a second "Send Chat" button was a
            duplicate that also forced two full-width buttons into a column the
            splitter can drag down to 300px, overflowing the panel. */}
        <div className={styles.chatActions}>
          <Button
            type="button"
            variant="primary"
            size="md"
            loading={generating}
            disabled={generating}
            onClick={onGenerate}
          >
            Generate Deck
          </Button>
        </div>
      </form>
    </section>
  );
}
