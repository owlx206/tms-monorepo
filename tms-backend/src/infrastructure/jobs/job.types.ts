export type IntervalJob = {
  name: string;
  enabled: boolean;
  intervalMs: number;
  runOnStart?: boolean;
  run: () => Promise<void>;
  onStop?: () => void | Promise<void>;
};

export type JobRunState = {
  running: boolean;
  timer: NodeJS.Timeout | null;
};
