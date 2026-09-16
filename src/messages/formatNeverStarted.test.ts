import { expect, test } from 'vitest';
import { formatNeverStarted } from './formatNeverStarted';

test('names every workflow that never started', () => {
  const message = formatNeverStarted(['a.yml', 'b.yml'], 60_000);
  expect(message).toContain('a.yml');
  expect(message).toContain('b.yml');
});

test('reports the grace it waited out in seconds', () => {
  expect(formatNeverStarted(['a.yml'], 60_000)).toContain('60s');
});
