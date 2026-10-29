import { Hono } from 'hono';
import { loadConfig, type RigConfig } from './config.js';
import { orderDigestRows } from './digest/order.js';
import { readNight } from './digest/read.js';
import { lane } from './lane.js';
import { readStatus } from './status.js';
import { Digest } from './views/digest.js';
import { Layout } from './views/layout.js';
import { StatusBoard } from './views/status.js';

function isMissingFile(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

export function createApp(config: RigConfig = loadConfig()) {
  const app = new Hono();

  app.get('/health', (c) => c.json({ ok: true, lane: lane().id }));

  app.get('/api/digest/:night', (c) => {
    try {
      const digest = readNight(config.runsDir, c.req.param('night'));
      return c.json(orderDigestRows(digest.rows));
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        return c.json({ error: 'night not found' }, 404);
      }

      throw error;
    }
  });

  app.get('/', (c) =>
    c.html(
      <Layout title="status" lane={lane()}>
        <StatusBoard status={readStatus(config)} />
      </Layout>,
    ),
  );

  app.get('/digest/:night', (c) => {
    const night = c.req.param('night');

    try {
      const digest = readNight(config.runsDir, night);
      const rows = orderDigestRows(digest.rows);

      return c.html(
        <Layout title={`digest · ${night}`} lane={lane()}>
          <Digest night={night} rows={rows} badLines={digest.badLines} />
        </Layout>,
      );
    } catch (error) {
      if (!isMissingFile(error)) throw error;

      return c.html(
        <Layout title={`digest · ${night}`} lane={lane()}>
          <h1>digest · {night}</h1>
          <p class="warn">night not found</p>
        </Layout>,
        404,
      );
    }
  });

  return app;
}
