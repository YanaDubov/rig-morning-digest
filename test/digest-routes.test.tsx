import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { RigConfig } from '../src/config.js';

const night = '2026-10-30';

let runsDir: string;

beforeEach(() => {
  runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-routes-'));
});

afterEach(() => {
  rmSync(runsDir, { recursive: true, force: true });
});

function app() {
  const config: RigConfig = {
    adapter: 'test',
    installed: '2026-10-29T14:06:00+01:00',
    beatEverySeconds: 60,
    runsDir,
  };

  return createApp(config);
}

function writeNight(lines: string[]): void {
  writeFileSync(join(runsDir, `${night}.jsonl`), lines.join('\n'), 'utf8');
}

const normalLines = [
  JSON.stringify({
    at: '2026-10-30T02:00:00+01:00',
    job: 'zeta/backup',
    status: 'retry',
    owner: 'rook',
    error: 'busy',
  }),
  JSON.stringify({
    at: '2026-10-30T01:00:00+01:00',
    job: 'alpha/sync',
    status: 'ok',
    owner: null,
  }),
  JSON.stringify({
    at: '2026-10-30T03:00:00+01:00',
    job: 'zeta/backup',
    status: 'ok',
    owner: 'rook',
  }),
];

const normalRows = [
  {
    job: 'alpha/sync',
    owner: null,
    runs: 1,
    retries: 0,
    lastStatus: 'ok',
    lastError: null,
    firstAt: '2026-10-30T01:00:00+01:00',
    lastAt: '2026-10-30T01:00:00+01:00',
  },
  {
    job: 'zeta/backup',
    owner: 'rook',
    runs: 2,
    retries: 1,
    lastStatus: 'ok',
    lastError: 'busy',
    firstAt: '2026-10-30T02:00:00+01:00',
    lastAt: '2026-10-30T03:00:00+01:00',
  },
];

describe('GET /digest/:night', () => {
  it('renders a normal night with rows sorted by job', async () => {
    writeNight(normalLines);

    const response = await app().request(`/digest/${night}`);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(html).toContain('alpha/sync');
    expect(html).toContain('zeta/backup');
    expect(html.indexOf('alpha/sync')).toBeLessThan(html.indexOf('zeta/backup'));
  });

  it('returns 404 when the night has no file', async () => {
    const response = await app().request(`/digest/${night}`);

    expect(response.status).toBe(404);
  });

  it('renders nothing ran for an empty night', async () => {
    writeNight([]);

    const response = await app().request(`/digest/${night}`);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('nothing ran');
  });

  it('renders valid rows when a line is malformed', async () => {
    writeNight([
      '{not valid json',
      JSON.stringify({
        at: '2026-10-30T04:00:00+01:00',
        job: 'valid/job',
        status: 'fail',
        owner: 'rook',
        error: 'timed out',
      }),
    ]);

    const response = await app().request(`/digest/${night}`);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('valid/job');
    expect(html).toContain('timed out');
  });
});

describe('GET /api/digest/:night', () => {
  it('returns a normal night as rows sorted by job', async () => {
    writeNight(normalLines);

    const response = await app().request(`/api/digest/${night}`);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    const body: unknown = await response.json();
    expect(body).toEqual(normalRows);
  });

  it('returns 404 when the night has no file', async () => {
    const response = await app().request(`/api/digest/${night}`);

    expect(response.status).toBe(404);
  });

  it('returns no rows for an empty night', async () => {
    writeNight([]);

    const response = await app().request(`/api/digest/${night}`);

    expect(response.status).toBe(200);
    const body: unknown = await response.json();
    expect(body).toEqual([]);
  });

  it('returns valid rows when a line is malformed', async () => {
    writeNight([
      '{not valid json',
      JSON.stringify({
        at: '2026-10-30T04:00:00+01:00',
        job: 'valid/job',
        status: 'fail',
        owner: 'rook',
        error: 'timed out',
      }),
    ]);

    const response = await app().request(`/api/digest/${night}`);

    expect(response.status).toBe(200);
    const body: unknown = await response.json();
    expect(body).toEqual([
      {
        job: 'valid/job',
        owner: 'rook',
        runs: 1,
        retries: 0,
        lastStatus: 'fail',
        lastError: 'timed out',
        firstAt: '2026-10-30T04:00:00+01:00',
        lastAt: '2026-10-30T04:00:00+01:00',
      },
    ]);
  });
});
