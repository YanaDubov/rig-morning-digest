import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { RigConfig } from '../src/config.js';

const tempDirs: string[] = [];

function createConfig(): RigConfig {
  const runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-api-'));
  tempDirs.push(runsDir);

  return {
    adapter: 'test',
    installed: '2026-10-29T14:06:00+01:00',
    beatEverySeconds: 60,
    runsDir,
  };
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true });
  }
});

describe('digest JSON API', () => {
  it('returns digest rows sorted by job', async () => {
    const config = createConfig();
    writeFileSync(
      join(config.runsDir, '2026-10-28.jsonl'),
      [
        '{"at":"2026-10-28T23:00:00+01:00","job":"z-last","status":"ok","owner":"rook"}',
        '{"at":"2026-10-28T23:01:00+01:00","job":"a-first","status":"fail","owner":null,"error":"broken"}',
      ].join('\n'),
    );

    const response = await createApp(config).request('/api/digest/2026-10-28');
    const rows = await response.json();

    expect(response.status).toBe(200);
    expect(rows).toEqual([
      {
        job: 'a-first',
        owner: null,
        runs: 1,
        retries: 0,
        lastStatus: 'fail',
        lastError: 'broken',
        firstAt: '2026-10-28T23:01:00+01:00',
        lastAt: '2026-10-28T23:01:00+01:00',
      },
      {
        job: 'z-last',
        owner: 'rook',
        runs: 1,
        retries: 0,
        lastStatus: 'ok',
        lastError: null,
        firstAt: '2026-10-28T23:00:00+01:00',
        lastAt: '2026-10-28T23:00:00+01:00',
      },
    ]);
  });

  it('returns 404 when the night is missing', async () => {
    const response = await createApp(createConfig()).request('/api/digest/2026-10-27');

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'night not found' });
  });
});
