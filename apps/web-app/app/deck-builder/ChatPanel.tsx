'use client';

import { useEffect, useRef, type FormEvent } from 'react';

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
  assistant: 'Grimoire AI',
  error: 'Forge Error',
};

function formatClock(at: number): string {
  return new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Sparkle mark from the chat title (`10:25`) and the Generate button (`10:80`). */
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
  /** Blocks Generate with a reason, e.g. nothing described yet. */
  generateHint?: string;
}

export function ChatPanel({
  entries,
  draft,
  onDraftChange,
  onSend,
  onGenerate,
  chatBusy,
  generating,
  generateHint = '',
}: ChatPanelProps) {
  const listRef = useRef<HTMLOListElement>(null);

  // `useAutoScroll` is the marquee helper (horizontal, infinite); a transcript
  // needs a one-shot pin to the bottom, so it stays local.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    list.scrollTop = list.scrollHeight;
  }, [entries, chatBusy]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSend();
  };

  const canSend = draft.trim().length > 0 && !chatBusy;

  return (
    <section className={styles.chatPanel} aria-label="Deck conversation">
      <h2 className={styles.panelTitle}>
        <Sparkle className={styles.chatSparkle} />
        Forge Alchemist
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
          <input
            className={styles.chatInput}
            type="text"
            value={draft}
            maxLength={PROMPT_MAX}
            placeholder="Describe your ideal deck..."
            aria-label="Describe your ideal deck"
            disabled={chatBusy}
            onChange={(event) => onDraftChange(event.target.value)}
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

        <div className={styles.chatActions}>
          <Button
            type="submit"
            variant="subtle"
            size="md"
            fullWidth
            className={styles.goldButton}
            loading={chatBusy}
            disabled={!canSend}
          >
            Send Chat
          </Button>
          <Button
            type="button"
            variant="primary"
            size="md"
            fullWidth
            loading={generating}
            disabled={generating || generateHint.length > 0}
            title={generateHint || undefined}
            onClick={onGenerate}
            iconRight={<Sparkle className={styles.buttonSparkle} />}
          >
            Generate Deck
          </Button>
        </div>
        {generateHint && <p className={styles.chatFootnote}>{generateHint}</p>}
      </form>
    </section>
  );
}
