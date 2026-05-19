import type { IntervalJob, JobRunState } from './job.types.js';

const MIN_INTERVAL_MS = 5_000;

function normalizeIntervalMs(intervalMs: number): number {
  return Math.max(MIN_INTERVAL_MS, intervalMs);
}

export class JobRunner {
  private readonly jobs = new Map<string, IntervalJob>();

  private readonly stateByName = new Map<string, JobRunState>();

  register(job: IntervalJob): void {
    if (this.jobs.has(job.name)) {
      throw new Error(`job already registered: ${job.name}`);
    }

    this.jobs.set(job.name, job);
    this.stateByName.set(job.name, {
      running: false,
      timer: null,
    });
  }

  startAll(): void {
    for (const job of this.jobs.values()) {
      this.start(job.name);
    }
  }

  start(name: string): void {
    const job = this.requireJob(name);
    const state = this.requireState(name);

    if (!job.enabled || state.timer) {
      return;
    }

    const intervalMs = normalizeIntervalMs(job.intervalMs);
    if (job.runOnStart !== false) {
      void this.runOnce(job);
    }

    state.timer = setInterval(() => {
      void this.runOnce(job);
    }, intervalMs);

    if (typeof state.timer.unref === 'function') {
      state.timer.unref();
    }

    console.log(`[jobs] ${job.name} scheduler started (interval=${intervalMs}ms)`);
  }

  async stopAll(): Promise<void> {
    for (const job of this.jobs.values()) {
      await this.stop(job.name);
    }
  }

  async stop(name: string): Promise<void> {
    const job = this.requireJob(name);
    const state = this.requireState(name);

    if (state.timer) {
      clearInterval(state.timer);
      state.timer = null;
    }

    await job.onStop?.();
    console.log(`[jobs] ${job.name} scheduler stopped`);
  }

  private async runOnce(job: IntervalJob): Promise<void> {
    const state = this.requireState(job.name);
    if (state.running) {
      console.log(`[jobs] ${job.name} skipped: already running`);
      return;
    }

    state.running = true;
    const startedAt = Date.now();

    try {
      await job.run();
      console.log(`[jobs] ${job.name} completed (${Date.now() - startedAt}ms)`);
    } catch (error) {
      console.error(`[jobs] ${job.name} failed`, error);
    } finally {
      state.running = false;
    }
  }

  private requireJob(name: string): IntervalJob {
    const job = this.jobs.get(name);
    if (!job) {
      throw new Error(`job not registered: ${name}`);
    }

    return job;
  }

  private requireState(name: string): JobRunState {
    const state = this.stateByName.get(name);
    if (!state) {
      throw new Error(`job state not registered: ${name}`);
    }

    return state;
  }
}

export function createJobRunner(jobs: IntervalJob[]): JobRunner {
  const runner = new JobRunner();
  jobs.forEach((job) => runner.register(job));
  return runner;
}
