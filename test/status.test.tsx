import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: 'runs' };

describe('status board', () => {
  it('shows the lane banner and the nights on disk', async () => {
    process.env.LANE_MARKER = 'TEST-MARKER';
    const res = await createApp(config).request('/');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('TEST-MARKER');
    expect(html).toContain('2026-10-28');
  });

  it('links every night with its run status counts', async () => {
    const runsDir = mkdtempSync(join(tmpdir(), 'rig-status-'));

    try {
      writeFileSync(
        join(runsDir, '2026-10-29.jsonl'),
        [
          '{"at":"2026-10-29T01:00:00+01:00","job":"one","status":"ok","owner":"rook"}',
          '{"at":"2026-10-29T01:01:00+01:00","job":"one","status":"retry","owner":"rook"}',
          '{"at":"2026-10-29T01:02:00+01:00","job":"two","status":"fail","owner":null}',
          'not json',
        ].join('\n'),
      );
      writeFileSync(
        join(runsDir, '2026-10-28.jsonl'),
        '{"at":"2026-10-28T01:00:00+01:00","job":"one","status":"ok","owner":"rook"}\n',
      );
      writeFileSync(join(runsDir, 'notes.txt'), 'not a night');

      const res = await createApp({ ...config, runsDir }).request('/');
      const html = await res.text();

      expect(res.status).toBe(200);
      expect(html).toContain('<a href="/digest/2026-10-29">2026-10-29</a> · ok 1 · retry 1 · fail 1');
      expect(html).toContain('<a href="/digest/2026-10-28">2026-10-28</a> · ok 1 · retry 0 · fail 0');
      expect(html).not.toContain('notes.txt');
      expect(html.indexOf('2026-10-29')).toBeLessThan(html.indexOf('2026-10-28'));
    } finally {
      rmSync(runsDir, { recursive: true });
    }
  });

  it('health answers with the lane id', async () => {
    const res = await createApp(config).request('/health');
    expect(await res.json()).toEqual({ ok: true, lane: 'lane-07' });
  });
});
