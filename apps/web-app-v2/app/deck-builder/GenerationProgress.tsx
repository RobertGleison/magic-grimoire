'use client';

import { Button } from '../components/Button/Button';
import { Spinner } from '../components/Spinner/Spinner';
import {
  MAX_TASK_STREAM_RETRIES,
  TASK_STAGE_COUNT,
  taskStageIndex,
  type TaskStreamState,
} from '../hooks/useTaskStream';
import type { TaskProgress } from '../types/api';
import styles from './page.module.css';

/* ==========================================================================
   GenerationProgress
   --------------------------------------------------------------------------
   The pipeline in `app/decks/pipeline.py` publishes six `TaskProgress` values.
   Four are stages; `completed` and `failed` are terminal and are rendered by
   the caller (deck, or error), never as a row here.

   The `message` on every event is the backend's own copy, so it is shown
   verbatim under the active stage rather than replaced with an invented label.
   ========================================================================== */

interface Stage {
  progress: Exclude<TaskProgress, 'completed' | 'failed'>;
  title: string;
  detail: string;
}

const STAGES: Stage[] = [
  { progress: 'processing', title: 'Parsing the incantation', detail: 'Reading colours, archetype and keywords out of your brief.' },
  { progress: 'searching_cards', title: 'Searching the archives', detail: 'Querying Scryfall for every card that fits.' },
  { progress: 'composing_deck', title: 'Composing the deck', detail: 'Balancing the curve, the spells and the mana base.' },
  { progress: 'enriching', title: 'Enriching the entries', detail: 'Pulling art, type lines and mana costs for each card.' },
];

interface GenerationProgressProps {
  state: TaskStreamState;
  /** Cancels the stream and any in-flight request. */
  onCancel: () => void;
}

export function GenerationProgress({ state, onCancel }: GenerationProgressProps) {
  const progress = state.phase === 'idle' || state.phase === 'failed' ? null : state.progress;
  const active = taskStageIndex(progress);
  const message = state.phase === 'idle' ? '' : state.message;

  // `connecting` with a non-zero attempt is a reconnect after a dropped
  // transport — the one state a plain spinner would hide from the user.
  const reconnecting = state.phase === 'connecting' && state.attempt > 0;

  return (
    <div className={styles.progressPanel}>
      <div className={styles.progressHead}>
        <span className={styles.progressTitle}>
          <Spinner size="sm" label="" />
          {reconnecting
            ? `Reconnecting to the forge — attempt ${state.attempt} of ${MAX_TASK_STREAM_RETRIES}`
            : 'Compiling your deck'}
        </span>
        <Button variant="ghost" size="xs" onClick={onCancel}>
          Cancel
        </Button>
      </div>

      <div
        className={styles.progressTrack}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={TASK_STAGE_COUNT}
        aria-valuenow={active}
        aria-label="Deck generation progress"
      >
        <span
          className={styles.progressFill}
          style={{ width: `${(active / TASK_STAGE_COUNT) * 100}%` }}
        />
      </div>

      <ol className={styles.stageList}>
        {STAGES.map((stage, index) => {
          const step = index + 1;
          const status = step < active ? 'done' : step === active ? 'active' : 'todo';
          return (
            <li
              key={stage.progress}
              className={`${styles.stage} ${styles[`stage_${status}`]}`}
              aria-current={status === 'active' ? 'step' : undefined}
            >
              <span className={styles.stageMark} aria-hidden="true">
                {status === 'done' ? '✓' : step}
              </span>
              <span className={styles.stageText}>
                <span className={styles.stageTitle}>{stage.title}</span>
                <span className={styles.stageDetail}>
                  {status === 'active' && message ? message : stage.detail}
                </span>
              </span>
              <span className="visually-hidden">
                {status === 'done' ? 'complete' : status === 'active' ? 'in progress' : 'not started'}
              </span>
            </li>
          );
        })}
      </ol>

      <p className={styles.progressLive} role="status" aria-live="polite">
        {reconnecting
          ? 'The progress stream dropped. Reconnecting — your deck keeps building on the server.'
          : message || 'Waiting for the first progress event…'}
      </p>
    </div>
  );
}
