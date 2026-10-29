import type { DigestRow } from './types.js';

export function orderDigestRows(rows: readonly DigestRow[]): DigestRow[] {
  return [...rows].sort((left, right) => {
    if (left.job < right.job) return -1;
    if (left.job > right.job) return 1;
    return 0;
  });
}
