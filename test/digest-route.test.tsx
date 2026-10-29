import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const temporaryDirectories: string[] = [];

function makeRunsDir(): string {
  const directory = mkdtempSync(join(process.cwd(), '.digest-test-'));
  temporaryDirectories.push(directory);
  return directory;
}

function appFor(runsDir: string) {
  return createApp({
    adapter: 'test',
    installed: '2026-10-29T14:06:00+01:00',
    beatEverySeconds: 60,
    runsDir,
  });
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('digest page', () => {
  it('sorts rows and marks failures and repeated retries', async () => {
    const runsDir = makeRunsDir();
    writeFileSync(join(runsDir, '2026-10-28.jsonl'), [
      '{"at":"2026-10-29T01:00:00-04:00","job":"zeta","status":"retry","owner":null,"error":"slow"}',
      '{"at":"2026-10-29T01:01:00-04:00","job":"zeta","status":"retry","owner":null,"error":"slow"}',
      '{"at":"2026-10-29T01:02:00-04:00","job":"zeta","status":"retry","owner":null,"error":"slow"}',
      '{"at":"2026-10-29T02:00:00+01:00","job":"alpha","status":"fail","owner":"rook","error":"broken"}',
      'not json',
    ].join('\n'));

    const response = await appFor(runsDir).request('/digest/2026-10-28');
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html.indexOf('alpha')).toBeLessThan(html.indexOf('zeta'));
    expect(html).toContain('<tr class="warn"><td>alpha</td>');
    expect(html).toContain('<td class="warn">3</td>');
    expect(html).toContain('<td>—</td>');
    expect(html).toContain('2026-10-29T01:00:00-04:00');
    expect(html).toContain('1 bad line skipped');
    expect(html.match(/<style>/g)).toHaveLength(1);
    expect(html).not.toContain('<script');
  });

  it('renders the empty-night message', async () => {
    const runsDir = makeRunsDir();
    writeFileSync(join(runsDir, '2026-10-28.jsonl'), '');

    const response = await appFor(runsDir).request('/digest/2026-10-28');

    expect(response.status).toBe(200);
    expect(await response.text()).toContain('<p class="mute">nothing ran</p>');
  });

  it('returns 404 when the night file is missing', async () => {
    const response = await appFor(makeRunsDir()).request('/digest/2026-10-28');

    expect(response.status).toBe(404);
  });
});
