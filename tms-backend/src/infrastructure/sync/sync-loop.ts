const MIN_SYNC_DELAY_MS = 1_000;

export type SyncLoop = {
  stop(): Promise<void>;
};

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const onAbort = () => {
      clearTimeout(timer);
      resolve();
    };
    const cleanup = () => {
      signal.removeEventListener('abort', onAbort);
    };
    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, Math.max(MIN_SYNC_DELAY_MS, ms));
    if (typeof timer.unref === 'function') {
      timer.unref();
    }

    signal.addEventListener('abort', onAbort, { once: true });
  });
}

export function startSyncLoop(input: {
  name: string;
  getDelayMs: () => Promise<number>;
  run: () => Promise<void>;
  onStop?: () => void;
}): SyncLoop {
  const abort = new AbortController();
  const done = (async () => {
    console.log(`[sync] ${input.name} worker started`);

    while (!abort.signal.aborted) {
      const startedAt = Date.now();
      try {
        await input.run();
        console.log(`[sync] ${input.name} pass completed (${Date.now() - startedAt}ms)`);
      } catch (error) {
        console.error(`[sync] ${input.name} pass failed`, error);
      }

      if (!abort.signal.aborted) {
        await sleep(await input.getDelayMs(), abort.signal);
      }
    }

    input.onStop?.();
    console.log(`[sync] ${input.name} worker stopped`);
  })();

  return {
    async stop() {
      abort.abort();
      await done;
    },
  };
}
