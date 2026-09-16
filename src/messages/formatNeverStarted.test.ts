import { expect, test } from 'vitest';
import { formatNeverStarted } from './formatNeverStarted';

test('names every workflow that never started and rules out lateness', () => {
  const msg = formatNeverStarted(['a.yml', 'b.yml'], 60_000);
  expect(msg).toContain('Predicted workflow runs GitHub never started: ["a.yml","b.yml"]');
  expect(msg).toContain('GitHub created no run for them');
});

test('reports the grace it waited out, in seconds', () => {
  expect(formatNeverStarted(['a.yml'], 60_000)).toContain('nothing appeared for 60s');
});

test('offers both readings, since the gate cannot tell which side is wrong', () => {
  const msg = formatNeverStarted(['a.yml'], 60_000);
  expect(msg).toContain('not receiving the events its triggers ask for');
  expect(msg).toContain('the prediction is wrong to expect it to dispatch');
});
