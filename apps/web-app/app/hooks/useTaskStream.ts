'use client';

import { useEffect, useReducer } from 'react';

import { getTask, isAbortError } from '../lib/apiClient';
import {
  TASK_PROGRESS_VALUES,
  type TaskProgress,
  type TaskProgressEvent,
  type TaskStatusResponse,
} from '../types/api';

/* ------------------------------------------------------------- task wire */

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
 * The progress event a polled task row represents, or `null` while it is still queued.
 * `progress` is the stage the pipeline last wrote; a terminal `status` stands in for it
 * when absent, so a task failed at dispatch (no stage yet) still ends the stream.
 */
export function taskProgressEventFrom(task: TaskStatusResponse): TaskProgressEvent | null {
  const status = task.progress ?? task.status;
  if (!isTaskProgress(status)) return null;
  return { status, message: task.message ?? '' };
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
  | { type: 'disconnect' }
  | { type: 'timeout' };

export const initialTaskStreamState: TaskStreamState = { phase: 'idle' };

/** Transient drops tolerated before the stream is declared permanently broken. */
export const MAX_TASK_STREAM_RETRIES = 5;

const BASE_RETRY_DELAY_MS = 500;
const MAX_RETRY_DELAY_MS = 8000;

/** How often the task row is polled while a generation runs. */
export const TASK_POLL_INTERVAL_MS = 2000;

/** A generation still unfinished after this long is treated as lost (the worker retries are exhausted by then). */
export const TASK_TIMEOUT_MS = 10 * 60 * 1000;

export const TASK_TIMEOUT_MESSAGE = 'Generation timed out, please try again.';

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
 * without React or a live backend.
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
          message: 'Lost connection while checking on your deck.',
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

    case 'timeout':
      return {
        phase: 'failed',
        taskId: state.taskId,
        progress: null,
        message: TASK_TIMEOUT_MESSAGE,
        reason: 'transport',
      };
  }
}

/* ------------------------------------------------------------------- hook */

/**
 * Polls `GET /api/v1/tasks/{taskId}` and reduces each response into a single
 * `TaskStreamState`. Pass `null` to stay idle.
 *
 * Every `TASK_POLL_INTERVAL_MS` until the task is terminal; a failed fetch is a
 * `disconnect` with the same capped backoff the reducer budgets for; after
 * `TASK_TIMEOUT_MS` the stream gives up (the worker's retries are spent by then).
 */
export function useTaskStream(taskId: string | null): TaskStreamState {
  const [state, dispatch] = useReducer(taskStreamReducer, initialTaskStreamState);

  useEffect(() => {
    if (!taskId) {
      dispatch({ type: 'reset' });
      return;
    }

    // `cancelled` gates every async callback so nothing dispatches after the
    // effect is torn down by an unmount or a taskId change.
    let cancelled = false;
    let finished = false;
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();

    const deadline = setTimeout(() => {
      if (cancelled || finished) return;
      finish();
      controller.abort();
      dispatch({ type: 'timeout' });
    }, TASK_TIMEOUT_MS);

    function finish() {
      finished = true;
      if (timer !== undefined) clearTimeout(timer);
      clearTimeout(deadline);
    }

    const poll = async () => {
      if (cancelled || finished) return;
      try {
        const task = await getTask(taskId, { signal: controller.signal });
        if (cancelled || finished) return;

        attempt = 0;
        dispatch({ type: 'open' });
        const event = taskProgressEventFrom(task);
        if (event) {
          dispatch({ type: 'event', event });
          if (isTerminalProgress(event.status)) {
            finish();
            return;
          }
        }
        timer = setTimeout(poll, TASK_POLL_INTERVAL_MS);
      } catch (error) {
        if (cancelled || finished || isAbortError(error)) return;

        attempt += 1;
        dispatch({ type: 'disconnect' });
        if (attempt > MAX_TASK_STREAM_RETRIES) {
          finish();
          return;
        }
        timer = setTimeout(poll, reconnectDelay(attempt));
      }
    };

    dispatch({ type: 'subscribe', taskId });
    void poll();

    return () => {
      cancelled = true;
      if (timer !== undefined) clearTimeout(timer);
      clearTimeout(deadline);
      controller.abort();
    };
  }, [taskId]);

  return state;
}
