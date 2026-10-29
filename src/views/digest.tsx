import type { DigestRow } from '../digest/types.js';

type DigestProps = {
  night: string;
  rows: DigestRow[];
  badLines: number;
};

export function Digest({ night, rows, badLines }: DigestProps) {
  return (
    <>
      <h1>digest · {night}</h1>
      {badLines > 0 ? (
        <p class="warn">{badLines} bad {badLines === 1 ? 'line' : 'lines'} skipped</p>
      ) : null}
      {rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th scope="col">job</th>
              <th scope="col">owner</th>
              <th scope="col">runs</th>
              <th scope="col">retries</th>
              <th scope="col">status</th>
              <th scope="col">last error</th>
              <th scope="col">first</th>
              <th scope="col">last</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr class={row.lastStatus === 'fail' ? 'warn' : undefined}>
                <td>{row.job}</td>
                <td>{row.owner ?? '—'}</td>
                <td>{row.runs}</td>
                <td class={row.retries >= 3 ? 'warn' : undefined}>{row.retries}</td>
                <td>{row.lastStatus}</td>
                <td>{row.lastError ?? '—'}</td>
                <td>{row.firstAt}</td>
                <td>{row.lastAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
