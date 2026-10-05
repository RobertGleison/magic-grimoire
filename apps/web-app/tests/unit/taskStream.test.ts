import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  MAX_TASK_STREAM_RETRIES,
  TASK_POLL_INTERVAL_MS,
  TASK_POLL_TIMEOUT_MS,
  TASK_STAGE_COUNT,
  TASK_TIMEOUT_MESSAGE,
  TASK_TIMEOUT_MS,
  initialTaskStreamState,
  isTerminalProgress,
  reconnectDelay,
  taskProgressEventFrom,
  taskStageIndex,
  taskStreamReducer,
  type TaskStreamAction,
  type TaskStreamState,
  useTaskStream,
} from '../../app/hooks/useTaskStream';
import * as apiClient from '../../app/lib/apiClient';
import type { TaskProgress, TaskStatusResponse } from '../../app/types/api';

const TASK_ID = 'task-abc';

/** Folds a list of actions over the reducer, starting from idle unless told otherwise. */
function run(actions: TaskStreamAction[], from: TaskStreamState = initialTaskStreamState): TaskStreamState {
  return actions.reduce(taskStreamReducer, from);
}

function progress(status: TaskProgress, message = ''): TaskStreamAction {
  return { type: 'event', event: { status, message } };
}

/** Subscribed and connected, with no progress event yet. */
function connected(): TaskStreamState {
  return run([{ type: 'subscribe', taskId: TASK_ID }, { type: 'open' }]);
}

describe('taskProgressEventFrom', () => {
  const task = (overrides: Partial<TaskStatusResponse>): TaskStatusResponse => ({
    id: 't',
    status: 'processing',
    progress: null,
    message: null,
    ...overrides,
  });

  it('uses the progress stage and message', () => {
    expect(taskProgressEventFrom(task({ progress: 'enriching', message: 'Fetching…' }))).toEqual({
      status: 'enriching',
      message: 'Fetching…',
    });
  });

  it('defaults a null message to an empty string', () => {
    expect(taskProgressEventFrom(task({ progress: 'processing' }))).toEqual({ status: 'processing', message: '' });
  });

  it('falls back to a terminal status when progress is missing', () => {
    expect(taskProgressEventFrom(task({ status: 'failed', message: 'boom' }))).toEqual({
      status: 'failed',
      message: 'boom',
    });
  });

  it('lets a terminal status win over a stale progress stage', () => {
    expect(taskProgressEventFrom(task({ status: 'completed', progress: 'enriching', message: 'done' }))).toEqual({
      status: 'completed',
      message: 'done',
    });
    expect(taskProgressEventFrom(task({ status: 'failed', progress: 'processing', message: 'stuck' }))).toEqual({
      status: 'failed',
      message: 'stuck',
    });
  });

  it('returns null for a queued task with no progress yet', () => {
    expect(taskProgressEventFrom(task({ status: 'queued' }))).toBeNull();
  });
});

describe('stage helpers', () => {
  it('orders the four pipeline stages and clamps the terminal ones', () => {
    expect(taskStageIndex(null)).toBe(0);
    expect(taskStageIndex('processing')).toBe(1);
    expect(taskStageIndex('searching_cards')).toBe(2);
    expect(taskStageIndex('composing_deck')).toBe(3);
    expect(taskStageIndex('enriching')).toBe(4);
    expect(taskStageIndex('completed')).toBe(TASK_STAGE_COUNT);
    expect(taskStageIndex('failed')).toBe(TASK_STAGE_COUNT);
  });

  it('marks only completed and failed as terminal', () => {
    expect(isTerminalProgress('completed')).toBe(true);
    expect(isTerminalProgress('failed')).toBe(true);
    expect(isTerminalProgress('processing')).toBe(false);
    expect(isTerminalProgress('enriching')).toBe(false);
  });
});

describe('reconnectDelay', () => {
  it('doubles per attempt and caps at 8s', () => {
    expect(reconnectDelay(1)).toBe(500);
    expect(reconnectDelay(2)).toBe(1000);
    expect(reconnectDelay(3)).toBe(2000);
    expect(reconnectDelay(4)).toBe(4000);
    expect(reconnectDelay(5)).toBe(8000);
    expect(reconnectDelay(12)).toBe(8000);
  });
});

describe('subscribe / reset', () => {
  it('starts idle', () => {
    expect(initialTaskStreamState).toEqual({ phase: 'idle' });
  });

  it('ignores every action while idle except subscribe', () => {
    expect(run([{ type: 'open' }])).toBe(initialTaskStreamState);
    expect(run([progress('processing')])).toBe(initialTaskStreamState);
    expect(run([{ type: 'disconnect' }])).toBe(initialTaskStreamState);
  });

  it('enters connecting on subscribe', () => {
    expect(run([{ type: 'subscribe', taskId: TASK_ID }])).toEqual({
      phase: 'connecting',
      taskId: TASK_ID,
      attempt: 0,
      progress: null,
      message: '',
    });
  });

  it('treats a repeat subscribe to the same task as a no-op', () => {
    const streaming = run([{ type: 'subscribe', taskId: TASK_ID }, { type: 'open' }, progress('enriching')]);
    expect(taskStreamReducer(streaming, { type: 'subscribe', taskId: TASK_ID })).toBe(streaming);
  });

  it('does not restart a finished stream when the same task is re-subscribed', () => {
    const done = run([
      { type: 'subscribe', taskId: TASK_ID },
      { type: 'open' },
      progress('completed', 'Your deck is ready!'),
    ]);
    expect(taskStreamReducer(done, { type: 'subscribe', taskId: TASK_ID })).toBe(done);
  });

  it('restarts cleanly for a different task, even from a terminal state', () => {
    const done = run([{ type: 'subscribe', taskId: TASK_ID }, progress('failed', 'boom')]);
    expect(taskStreamReducer(done, { type: 'subscribe', taskId: 'task-xyz' })).toEqual({
      phase: 'connecting',
      taskId: 'task-xyz',
      attempt: 0,
      progress: null,
      message: '',
    });
  });

  it('returns to idle on reset from any phase', () => {
    const done = run([{ type: 'subscribe', taskId: TASK_ID }, progress('completed', 'ready')]);
    expect(taskStreamReducer(done, { type: 'reset' })).toEqual({ phase: 'idle' });
    expect(taskStreamReducer(connected(), { type: 'reset' })).toEqual({ phase: 'idle' });
  });
});

describe('happy path', () => {
  it('walks the full worker event sequence to completed', () => {
    let state = run([{ type: 'subscribe', taskId: TASK_ID }]);
    expect(state.phase).toBe('connecting');

    state = taskStreamReducer(state, { type: 'open' });
    expect(state).toEqual({
      phase: 'streaming',
      taskId: TASK_ID,
      attempt: 0,
      progress: null,
      message: '',
    });

    const sequence: Array<[TaskProgress, string, number]> = [
      ['processing', 'Parsing your request...', 1],
      ['searching_cards', 'Searching for cards...', 2],
      ['composing_deck', 'Building your deck...', 3],
      ['enriching', 'Fetching card images...', 4],
    ];

    for (const [status, message, stage] of sequence) {
      state = taskStreamReducer(state, progress(status, message));
      expect(state).toEqual({
        phase: 'streaming',
        taskId: TASK_ID,
        attempt: 0,
        progress: status,
        message,
      });
      if (state.phase === 'streaming') expect(taskStageIndex(state.progress)).toBe(stage);
    }

    state = taskStreamReducer(state, progress('completed', 'Your deck is ready!'));
    expect(state).toEqual({
      phase: 'completed',
      taskId: TASK_ID,
      progress: 'completed',
      message: 'Your deck is ready!',
    });
  });

  it('accepts a first event that arrives before onopen', () => {
    const state = run([{ type: 'subscribe', taskId: TASK_ID }, progress('processing', 'Parsing...')]);
    expect(state).toEqual({
      phase: 'streaming',
      taskId: TASK_ID,
      attempt: 0,
      progress: 'processing',
      message: 'Parsing...',
    });
  });
});

describe('failure path', () => {
  it('ends in failed with reason "task" when the worker publishes failed', () => {
    const state = run([
      { type: 'subscribe', taskId: TASK_ID },
      { type: 'open' },
      progress('processing', 'Parsing your request...'),
      progress('searching_cards', 'Searching for cards...'),
      progress('failed', 'I only discuss Magic: The Gathering.'),
    ]);

    expect(state).toEqual({
      phase: 'failed',
      taskId: TASK_ID,
      progress: 'failed',
      message: 'I only discuss Magic: The Gathering.',
      reason: 'task',
    });
  });

  it('fails immediately when the pipeline dies before any progress event', () => {
    const state = run([{ type: 'subscribe', taskId: TASK_ID }, progress('failed', 'llm unavailable')]);
    expect(state.phase).toBe('failed');
    if (state.phase === 'failed') {
      expect(state.reason).toBe('task');
      expect(state.message).toBe('llm unavailable');
    }
  });

  it('absorbs every later action once terminal', () => {
    const failed = run([{ type: 'subscribe', taskId: TASK_ID }, progress('failed', 'boom')]);

    for (const action of [
      { type: 'open' } as const,
      { type: 'disconnect' } as const,
      progress('processing', 'late'),
      progress('completed', 'late success'),
      progress('failed', 'again'),
    ]) {
      expect(taskStreamReducer(failed, action)).toBe(failed);
    }
  });

  it('ignores late events after completion, including a contradictory failure', () => {
    const done = run([{ type: 'subscribe', taskId: TASK_ID }, progress('completed', 'ready')]);

    expect(taskStreamReducer(done, progress('failed', 'no'))).toBe(done);
    expect(taskStreamReducer(done, progress('enriching', 'no'))).toBe(done);
  });
});

describe('duplicate and out-of-order events', () => {
  it('ignores a duplicate of the current stage', () => {
    const state = run([{ type: 'subscribe', taskId: TASK_ID }, progress('searching_cards', 'Searching...')]);
    expect(taskStreamReducer(state, progress('searching_cards', 'Searching again...'))).toBe(state);
  });

  it('never walks the stage backwards', () => {
    const state = run([
      { type: 'subscribe', taskId: TASK_ID },
      progress('processing', 'a'),
      progress('searching_cards', 'b'),
      progress('composing_deck', 'c'),
      progress('enriching', 'd'),
    ]);

    for (const stale of ['processing', 'searching_cards', 'composing_deck'] as const) {
      expect(taskStreamReducer(state, progress(stale, 'stale'))).toBe(state);
    }
  });

  it('still applies a forward jump when intermediate events were dropped', () => {
    const state = run([
      { type: 'subscribe', taskId: TASK_ID },
      progress('processing', 'a'),
      progress('enriching', 'Fetching card images...'),
    ]);

    expect(state).toEqual({
      phase: 'streaming',
      taskId: TASK_ID,
      attempt: 0,
      progress: 'enriching',
      message: 'Fetching card images...',
    });
  });

  it('lets a terminal event through even when it "regresses" the stage order', () => {
    const state = run([{ type: 'subscribe', taskId: TASK_ID }, progress('enriching', 'd')]);
    const done = taskStreamReducer(state, progress('completed', 'ready'));
    expect(done.phase).toBe('completed');
  });
});

describe('transport drops', () => {
  it('goes back to connecting with a rising attempt count, keeping last known progress', () => {
    let state: TaskStreamState = run([
      { type: 'subscribe', taskId: TASK_ID },
      { type: 'open' },
      progress('composing_deck', 'Building your deck...'),
    ]);

    for (let attempt = 1; attempt <= MAX_TASK_STREAM_RETRIES; attempt += 1) {
      state = taskStreamReducer(state, { type: 'disconnect' });
      expect(state).toEqual({
        phase: 'connecting',
        taskId: TASK_ID,
        attempt,
        progress: 'composing_deck',
        message: 'Building your deck...',
      });
    }
  });

  it('gives up with reason "transport" once the retry budget is spent', () => {
    let state: TaskStreamState = connected();
    for (let i = 0; i <= MAX_TASK_STREAM_RETRIES; i += 1) {
      state = taskStreamReducer(state, { type: 'disconnect' });
    }

    expect(state).toEqual({
      phase: 'failed',
      taskId: TASK_ID,
      progress: null,
      message: 'Lost connection while checking on your deck.',
      reason: 'transport',
    });
  });

  it('clears the attempt count when the stream comes back', () => {
    const reconnecting = run([
      { type: 'subscribe', taskId: TASK_ID },
      { type: 'open' },
      progress('processing', 'a'),
      { type: 'disconnect' },
      { type: 'disconnect' },
    ]);
    expect(reconnecting.phase === 'connecting' && reconnecting.attempt).toBe(2);

    const recovered = taskStreamReducer(reconnecting, { type: 'open' });
    expect(recovered).toEqual({
      phase: 'streaming',
      taskId: TASK_ID,
      attempt: 0,
      progress: 'processing',
      message: 'a',
    });

    // Budget is fresh again, so a later blip does not immediately fail.
    expect(taskStreamReducer(recovered, { type: 'disconnect' })).toMatchObject({
      phase: 'connecting',
      attempt: 1,
    });
  });

  it('a replayed terminal event after a reconnect still completes the stream', () => {
    const state = run([
      { type: 'subscribe', taskId: TASK_ID },
      { type: 'open' },
      progress('enriching', 'd'),
      { type: 'disconnect' },
      { type: 'open' },
      progress('completed', 'Task already completed'),
    ]);

    expect(state).toEqual({
      phase: 'completed',
      taskId: TASK_ID,
      progress: 'completed',
      message: 'Task already completed',
    });
  });

  it('treats a redundant open as a no-op', () => {
    const state = connected();
    expect(taskStreamReducer(state, { type: 'open' })).toBe(state);
  });
});

describe('timeout', () => {
  it('fails a live stream with reason "transport" and the timeout message', () => {
    const live = run([progress('composing_deck')], connected());
    expect(taskStreamReducer(live, { type: 'timeout' })).toEqual({
      phase: 'failed',
      taskId: TASK_ID,
      progress: null,
      message: TASK_TIMEOUT_MESSAGE,
      reason: 'transport',
    });
  });

  it('is ignored once terminal', () => {
    const done = run([progress('completed', 'ok')], connected());
    expect(taskStreamReducer(done, { type: 'timeout' })).toBe(done);
  });
});

describe('useTaskStream polling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const deferred = () => {
    let resolve!: (value: TaskStatusResponse) => void;
    const promise = new Promise<TaskStatusResponse>((res) => {
      resolve = res;
    });
    return { promise, resolve };
  };

  const reply = (
    stage: TaskStatusResponse['progress'],
    status: TaskStatusResponse['status'] = 'processing',
  ): TaskStatusResponse => ({ id: TASK_ID, status, progress: stage, message: `${stage}` });

  it('polls until a terminal stage, then stops', async () => {
    const getTask = vi
      .spyOn(apiClient, 'getTask')
      .mockResolvedValueOnce(reply('searching_cards'))
      .mockResolvedValueOnce(reply('completed', 'completed'));
    const { result } = renderHook(() => useTaskStream(TASK_ID));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current).toMatchObject({ phase: 'streaming', progress: 'searching_cards' });
    // Polls are unauthenticated: the task id is the capability.
    expect(getTask).toHaveBeenCalledWith(TASK_ID, { signal: expect.any(AbortSignal), token: null });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(TASK_POLL_INTERVAL_MS);
    });
    expect(result.current.phase).toBe('completed');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(TASK_POLL_INTERVAL_MS * 5);
    });
    expect(getTask).toHaveBeenCalledTimes(2);
  });

  it('keeps polling a queued task without inventing a stage', async () => {
    const getTask = vi
      .spyOn(apiClient, 'getTask')
      .mockResolvedValueOnce(reply(null, 'queued'))
      .mockResolvedValueOnce(reply('processing'));
    const { result } = renderHook(() => useTaskStream(TASK_ID));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current).toMatchObject({ phase: 'streaming', progress: null });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(TASK_POLL_INTERVAL_MS);
    });
    expect(result.current).toMatchObject({ phase: 'streaming', progress: 'processing' });
    expect(getTask).toHaveBeenCalledTimes(2);
  });

  it('backs off on a failed fetch and recovers', async () => {
    vi.spyOn(apiClient, 'getTask')
      .mockRejectedValueOnce(new apiClient.ApiError('down', 0))
      .mockResolvedValueOnce(reply('enriching'));
    const { result } = renderHook(() => useTaskStream(TASK_ID));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current).toMatchObject({ phase: 'connecting', attempt: 1 });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(reconnectDelay(1));
    });
    expect(result.current).toMatchObject({ phase: 'streaming', progress: 'enriching', attempt: 0 });
  });

  it('gives up after the retry budget and stops polling', async () => {
    const getTask = vi.spyOn(apiClient, 'getTask').mockRejectedValue(new apiClient.ApiError('down', 0));
    const { result } = renderHook(() => useTaskStream(TASK_ID));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(result.current).toMatchObject({ phase: 'failed', reason: 'transport' });
    expect(getTask).toHaveBeenCalledTimes(MAX_TASK_STREAM_RETRIES + 1);
  });

  it('times out a task that never finishes', async () => {
    vi.spyOn(apiClient, 'getTask').mockResolvedValue(reply('composing_deck'));
    const { result } = renderHook(() => useTaskStream(TASK_ID));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(TASK_TIMEOUT_MS);
    });
    expect(result.current).toMatchObject({ phase: 'failed', reason: 'transport', message: TASK_TIMEOUT_MESSAGE });
  });

  it('ignores a response that lands after unmount and stops polling', async () => {
    const pending = deferred();
    const signals: AbortSignal[] = [];
    const getTask = vi.spyOn(apiClient, 'getTask').mockImplementation((_id, options) => {
      if (options?.signal) signals.push(options.signal);
      return pending.promise;
    });
    const { result, unmount } = renderHook(() => useTaskStream(TASK_ID));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    const before = result.current;
    expect(before).toMatchObject({ phase: 'connecting' });

    unmount();
    pending.resolve(reply('completed', 'completed'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(TASK_POLL_INTERVAL_MS * 3);
    });

    expect(result.current).toBe(before);
    expect(getTask).toHaveBeenCalledTimes(1);
    expect(signals[0].aborted).toBe(true);
  });

  it('drops a late response for the old task when the id changes', async () => {
    const oldPending = deferred();
    const getTask = vi.spyOn(apiClient, 'getTask').mockImplementation((id) =>
      id === TASK_ID ? oldPending.promise : new Promise<TaskStatusResponse>(() => {}),
    );
    const { rerender, result } = renderHook(({ id }) => useTaskStream(id), {
      initialProps: { id: TASK_ID },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    rerender({ id: 'task-xyz' });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    const before = result.current;
    expect(before).toMatchObject({ phase: 'connecting', taskId: 'task-xyz' });

    oldPending.resolve(reply('completed', 'completed'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(TASK_POLL_INTERVAL_MS * 3);
    });

    expect(result.current).toBe(before);
    expect(getTask.mock.calls.filter(([id]) => id === TASK_ID)).toHaveLength(1);
  });

  it('fails at once on a client error instead of retrying', async () => {
    const getTask = vi
      .spyOn(apiClient, 'getTask')
      .mockRejectedValue(new apiClient.ApiError('Task not found', 404));
    const { result } = renderHook(() => useTaskStream(TASK_ID));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current).toEqual({
      phase: 'failed',
      taskId: TASK_ID,
      progress: 'failed',
      message: 'Task not found',
      reason: 'task',
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(getTask).toHaveBeenCalledTimes(1);
  });

  it('keeps backing off on a server error', async () => {
    vi.spyOn(apiClient, 'getTask').mockRejectedValueOnce(new apiClient.ApiError('boom', 503));
    const { result } = renderHook(() => useTaskStream(TASK_ID));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current).toMatchObject({ phase: 'connecting', attempt: 1 });
  });

  it('counts a hung poll as a disconnect once it passes the per-poll timeout', async () => {
    const getTask = vi.spyOn(apiClient, 'getTask').mockImplementation(
      (_id, options) =>
        new Promise<TaskStatusResponse>((_resolve, reject) => {
          options?.signal?.addEventListener('abort', () => reject(options.signal?.reason));
        }),
    );
    const { result } = renderHook(() => useTaskStream(TASK_ID));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(TASK_POLL_TIMEOUT_MS - 1);
    });
    expect(result.current).toMatchObject({ phase: 'connecting', attempt: 0 });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(result.current).toMatchObject({ phase: 'connecting', attempt: 1 });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(reconnectDelay(1));
    });
    expect(getTask).toHaveBeenCalledTimes(2);
  });

  it('stays idle without a task id and never polls', async () => {
    const getTask = vi.spyOn(apiClient, 'getTask');
    const { result } = renderHook(() => useTaskStream(null));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(TASK_POLL_INTERVAL_MS * 2);
    });
    expect(result.current).toEqual({ phase: 'idle' });
    expect(getTask).not.toHaveBeenCalled();
  });
});
