'use client';

import { useEffect, useReducer } from 'react';

import { taskStreamUrl } from '../lib/apiClient';
import { TASK_PROGRESS_VALUES, type TaskProgress, type TaskProgressEvent } from '../types/api';

/* ------------------------------------------------------------- event wire */

/** Pipeline order of the non-terminal stages; both terminal values sort last. */
export const TASK_STAGE_ORDER: Record<TaskProgress, number> = {
  processing: 1,
  searching_cards: 2,
  composing_deck: 3,
  enriching: 4,
  completed: 5,
  failed: 5,
};

/** Number of non-terminal stages, for progress indicators. */
export const TASK_STAGE_COUNT = 4;

const PROGRESS_VALUES: ReadonlySet<string> = new Set(TASK_PROGRESS_VALUES);

function isTaskProgress(value: unknown): value is TaskProgress {
  return typeof value === 'string' && PROGRESS_VALUES.has(value);
}

export function isTerminalProgress(progress: TaskProgress): boolean {
  return progress === 'completed' || progress === 'failed';
}

/** `0` before the first event, then `1..TASK_STAGE_COUNT`, then `TASK_STAGE_COUNT` once terminal. */
export function taskStageIndex(progress: TaskProgress | null): number {
  if (progress === null) return 0;
  return Math.min(TASK_STAGE_ORDER[progress], TASK_STAGE_COUNT);
}

/**
 * Parses one SSE `data:` payload. Returns `null` for anything that is not a
 * recognised progress event — keepalive comments, truncated frames, or a status
 * this frontend does not know — so unknown traffic can never corrupt the state.
 */
export function parseTaskProgressEvent(raw: string): TaskProgressEvent | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;

  const { status, message } = parsed as { status?: unknown; message?: unknown };
  if (!isTaskProgress(status)) return null;

  return { status, message: typeof message === 'string' ? message : '' };
}

/* ------------------------------------------------------------------ state */

/** Why the stream ended unhappily: the task itself failed, or the connection did. */
export type TaskStreamFailure = 'task' | 'transport';

/**
 * One value describes the whole stream — no boolean soup that can contradict
 * itself. `connecting` with `attempt > 0` is a reconnect; `completed` and
 * `failed` are terminal and absorb every later action.
 */
export type TaskStreamState =
  | { phase: 'idle' }
  | {
      phase: 'connecting';
      taskId: string;
      attempt: number;
      progress: TaskProgress | null;
      message: string;
    }
  | {
      phase: 'streaming';
      taskId: string;
      attempt: number;
      progress: TaskProgress | null;
      message: string;
    }
  | { phase: 'completed'; taskId: string; progress: 'completed'; message: string }
  | { phase: 'failed'; taskId: string; progress: 'failed' | null; message: string; reason: TaskStreamFailure };

export type TaskStreamAction =
  | { type: 'reset' }
  | { type: 'subscribe'; taskId: string }
  | { type: 'open' }
  | { type: 'event'; event: TaskProgressEvent }
  | { type: 'disconnect' };

export const initialTaskStreamState: TaskStreamState = { phase: 'idle' };

/** Transient drops tolerated before the stream is declared permanently broken. */
export const MAX_TASK_STREAM_RETRIES = 5;

const BASE_RETRY_DELAY_MS = 500;
const MAX_RETRY_DELAY_MS = 8000;

/** Exponential backoff for reconnect attempt `n` (1-based), capped. */
export function reconnectDelay(attempt: number): number {
  const exponent = Math.max(0, attempt - 1);
  return Math.min(BASE_RETRY_DELAY_MS * 2 ** exponent, MAX_RETRY_DELAY_MS);
}

/** The two states from which no further transition is possible. */
export type TerminalTaskStreamState = Extract<TaskStreamState, { phase: 'completed' | 'failed' }>;

function isTerminalState(state: TaskStreamState): state is TerminalTaskStreamState {
  return state.phase === 'completed' || state.phase === 'failed';
}

/**
 * Pure transition function, exported so the whole protocol can be tested
 * without React or a live EventSource.
 */
export function taskStreamReducer(state: TaskStreamState, action: TaskStreamAction): TaskStreamState {
  if (action.type === 'reset') return initialTaskStreamState;

  if (action.type === 'subscribe') {
    // Re-subscribing to the task already being tracked is a no-op, so a parent
    // re-render can never restart a stream that has already finished.
    if (state.phase !== 'idle' && state.taskId === action.taskId) return state;
    return { phase: 'connecting', taskId: action.taskId, attempt: 0, progress: null, message: '' };
  }

  // Terminal is terminal: late, duplicate and out-of-order traffic is dropped.
  if (state.phase === 'idle' || isTerminalState(state)) return state;

  switch (action.type) {
    case 'open':
      if (state.phase === 'streaming' && state.attempt === 0) return state;
      return { ...state, phase: 'streaming', attempt: 0 };

    case 'event': {
      const { status, message } = action.event;

      if (status === 'completed') {
        return { phase: 'completed', taskId: state.taskId, progress: 'completed', message };
      }
      if (status === 'failed') {
        return { phase: 'failed', taskId: state.taskId, progress: 'failed', message, reason: 'task' };
      }
      // Stages only ever move forward — a replay after a reconnect, or an event
      // that arrives late, must not walk the progress bar backwards.
      if (state.progress !== null && TASK_STAGE_ORDER[status] <= TASK_STAGE_ORDER[state.progress]) {
        return state;
      }
      return { phase: 'streaming', taskId: state.taskId, attempt: 0, progress: status, message };
    }

    case 'disconnect': {
      const attempt = state.attempt + 1;
      if (attempt > MAX_TASK_STREAM_RETRIES) {
        return {
          phase: 'failed',
          taskId: state.taskId,
          progress: null,
          message: 'Lost connection to the deck generation stream.',
          reason: 'transport',
        };
      }
      return {
        phase: 'connecting',
        taskId: state.taskId,
        attempt,
        progress: state.progress,
        message: state.message,
      };
    }
  }
}

/* ------------------------------------------------------------------- hook */

/**
 * Subscribes to `GET /api/v1/tasks/{taskId}/stream` and reduces the progress
 * events into a single `TaskStreamState`. Pass `null` to stay idle.
 *
 * Transport is native `EventSource`: `app/tasks/routes.py` documents the
 * endpoint as deliberately unauthenticated ("the frontend consumes this with
 * native EventSource, which cannot send Authorization headers"), so there is no
 * bearer token to smuggle and no reason to hand-roll a fetch/ReadableStream
 * parser. EventSource also discards the `: keepalive` comment frames the
 * backend emits every 10s for free.
 *
 * Automatic EventSource retries are replaced with explicit backoff: the native
 * retry is a fixed interval and unbounded, and it must not fire at all once a
 * terminal event has landed.
 */
export function useTaskStream(taskId: string | null): TaskStreamState {
  const [state, dispatch] = useReducer(taskStreamReducer, initialTaskStreamState);

  useEffect(() => {
    if (!taskId) {
      dispatch({ type: 'reset' });
      return;
    }
    if (typeof EventSource === 'undefined') return;

    // `cancelled` gates every async callback so nothing dispatches after the
    // effect is torn down by an unmount or a taskId change.
    let cancelled = false;
    let finished = false;
    let source: EventSource | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;

    const closeSource = () => {
      if (source) {
        source.onopen = null;
        source.onmessage = null;
        source.onerror = null;
        source.close();
        source = null;
      }
    };

    const connect = () => {
      if (cancelled || finished) return;

      const es = new EventSource(taskStreamUrl(taskId));
      source = es;

      es.onopen = () => {
        if (cancelled || finished) return;
        attempt = 0;
        dispatch({ type: 'open' });
      };

      es.onmessage = (event: MessageEvent<string>) => {
        if (cancelled || finished) return;

        const progressEvent = parseTaskProgressEvent(event.data);
        if (!progressEvent) return;

        // A delivered event proves the connection is healthy again.
        attempt = 0;

        dispatch({ type: 'event', event: progressEvent });

        if (isTerminalProgress(progressEvent.status)) {
          finished = true;
          closeSource();
        }
      };

      es.onerror = () => {
        if (cancelled || finished) return;

        closeSource();
        attempt += 1;
        dispatch({ type: 'disconnect' });
        if (attempt > MAX_TASK_STREAM_RETRIES) return;
        timer = setTimeout(connect, reconnectDelay(attempt));
      };
    };

    dispatch({ type: 'subscribe', taskId });
    connect();

    return () => {
      cancelled = true;
      if (timer !== undefined) clearTimeout(timer);
      closeSource();
    };
  }, [taskId]);

  return state;
}
