import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, DigestStatus, NightCounts, ReadNight } from './types.js';

type RunRecord = {
  at: string;
  job: string;
  status: DigestStatus;
  owner: string | null;
  error?: string;
};

type Accumulator = {
  row: DigestRow;
  firstTime: number;
  lastTime: number;
  lastErrorTime: number | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStatus(value: unknown): value is DigestStatus {
  return value === 'ok' || value === 'retry' || value === 'fail';
}

function parseRun(line: string): RunRecord | null {
  let value: unknown;

  try {
    value = JSON.parse(line);
  } catch {
    return null;
  }

  if (
    !isRecord(value)
    || typeof value.at !== 'string'
    || !Number.isFinite(Date.parse(value.at))
    || typeof value.job !== 'string'
    || !isStatus(value.status)
    || (typeof value.owner !== 'string' && value.owner !== null)
    || (value.error !== undefined && typeof value.error !== 'string')
  ) {
    return null;
  }

  return {
    at: value.at,
    job: value.job,
    status: value.status,
    owner: value.owner,
    ...(value.error === undefined ? {} : { error: value.error }),
  };
}

function readRuns(runsDir: string, night: string): { runs: RunRecord[]; badLines: number } {
  const contents = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  const lines = contents === '' ? [] : contents.split(/\r?\n/);

  if (lines.at(-1) === '') {
    lines.pop();
  }

  const runs: RunRecord[] = [];
  let badLines = 0;

  for (const line of lines) {
    const run = parseRun(line);

    if (run === null) {
      badLines += 1;
      continue;
    }

    runs.push(run);
  }

  return { runs, badLines };
}

export function countNightStatuses(runsDir: string, night: string): NightCounts {
  const counts: NightCounts = { ok: 0, retry: 0, fail: 0 };

  for (const run of readRuns(runsDir, night).runs) {
    counts[run.status] += 1;
  }

  return counts;
}

export const readNight: ReadNight = (runsDir, night) => {
  const { runs, badLines } = readRuns(runsDir, night);
  const jobs = new Map<string, Accumulator>();

  for (const run of runs) {
    const time = Date.parse(run.at);
    const current = jobs.get(run.job);

    if (current === undefined) {
      jobs.set(run.job, {
        row: {
          job: run.job,
          owner: run.owner,
          runs: 1,
          retries: run.status === 'retry' ? 1 : 0,
          lastStatus: run.status,
          lastError: run.error ?? null,
          firstAt: run.at,
          lastAt: run.at,
        },
        firstTime: time,
        lastTime: time,
        lastErrorTime: run.error === undefined ? null : time,
      });
      continue;
    }

    current.row.runs += 1;
    if (run.status === 'retry') {
      current.row.retries += 1;
    }

    if (time < current.firstTime) {
      current.firstTime = time;
      current.row.firstAt = run.at;
    }

    if (time >= current.lastTime) {
      current.lastTime = time;
      current.row.lastAt = run.at;
      current.row.lastStatus = run.status;
      current.row.owner = run.owner;
    }

    if (run.error !== undefined && (current.lastErrorTime === null || time >= current.lastErrorTime)) {
      current.lastErrorTime = time;
      current.row.lastError = run.error;
    }
  }

  return { rows: Array.from(jobs.values(), ({ row }) => row), badLines };
};
