'use client';

import { useEffect, useReducer } from 'react';

import { ApiError, getTask } from '../lib/apiClient';
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
 * A terminal `status` always wins, so a stale `progress` stage can never hide the end of
 * the task (or a task failed at dispatch, before any stage was written); otherwise
 * `progress` is the stage the pipeline last wrote.
 */
export function taskProgressEventFrom(task: TaskStatusResponse): TaskProgressEvent | null {
  const status = task.status === 'completed' || task.status === 'failed' ? task.status : task.progress;
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

/**
 * Last-resort backstop. The backend reports a task with no progress for 10 minutes as `failed`
 * (with its own message), which normally ends polling first. This only fires if that answer
 * never arrives, so it must exceed the worker's worst-case retry window (~18 min).
 */
export const TASK_TIMEOUT_MS = 20 * 60 * 1000;

/** A single poll that takes longer than this is abandoned and counted as a dropped connection. */
export const TASK_POLL_TIMEOUT_MS = 15_000;

const TASK_NOT_FOUND_MESSAGE = 'This deck generation could not be found.';

/** Shown for any other 4xx: the raw body may be an HTML challenge page, never show it. */
const TASK_REJECTED_MESSAGE = 'Could not check on your deck. Please try again.';

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
 * `disconnect` with the same capped backoff the reducer budgets for, and so is a
 * poll that hangs past `TASK_POLL_TIMEOUT_MS`. A 4xx (e.g. an unknown task) fails the stream at
 * once, since retrying cannot help. After `TASK_TIMEOUT_MS` the stream gives up as a backstop.
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

    const finish = () => {
      finished = true;
      if (timer !== undefined) clearTimeout(timer);
      clearTimeout(deadline);
    };

    const deadline = setTimeout(() => {
      if (cancelled || finished) return;
      finish();
      controller.abort();
      dispatch({ type: 'timeout' });
    }, TASK_TIMEOUT_MS);

    // A per-poll signal that follows the effect's controller and also aborts on its own
    // timer (a plain timer rather than `AbortSignal.timeout`, so fake timers can drive it).
    const pollSignalFor = () => {
      const pollController = new AbortController();
      const abort = () => pollController.abort();
      controller.signal.addEventListener('abort', abort);
      const pollTimer = setTimeout(abort, TASK_POLL_TIMEOUT_MS);
      const release = () => {
        clearTimeout(pollTimer);
        controller.signal.removeEventListener('abort', abort);
      };
      return { signal: pollController.signal, release };
    };

    const poll = async () => {
      if (cancelled || finished) return;
      const { signal: pollSignal, release } = pollSignalFor();
      try {
        // The task id is the capability, so polls skip the Supabase lookup and bearer header.
        const task = await getTask(taskId, { signal: pollSignal, token: null });
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
        // Only the effect's own abort (unmount, taskId change, deadline) is silent; a per-poll
        // timeout aborts the request too, but must still count as a dropped connection.
        if (cancelled || finished || controller.signal.aborted) return;

        if (error instanceof ApiError && error.isClientError) {
          finish();
          dispatch({ type: 'event', event: { status: 'failed', message: error.status === 404 ? TASK_NOT_FOUND_MESSAGE : TASK_REJECTED_MESSAGE } });
          return;
        }

        attempt += 1;
        dispatch({ type: 'disconnect' });
        if (attempt > MAX_TASK_STREAM_RETRIES) {
          finish();
          return;
        }
        timer = setTimeout(poll, reconnectDelay(attempt));
      } finally {
        release();
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
