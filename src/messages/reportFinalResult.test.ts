import { expect, test, vi } from 'vitest';
import { reportFinalResult } from './reportFinalResult';

function effects() {
  return { log: vi.fn(), setFailed: vi.fn() };
}

test('non-passing → setFailed with list', () => {
  const e = effects();
  reportFinalResult({ inProgress: [], nonPassing: ['Test (cancelled)'], relevantCount: 1 }, e);
  expect(e.setFailed).toHaveBeenCalledWith('Non-passing runs: ["Test (cancelled)"]');
  expect(e.log).not.toHaveBeenCalled();
});

test('zero relevant → docs-only log', () => {
  const e = effects();
  reportFinalResult({ inProgress: [], nonPassing: [], relevantCount: 0 }, e);
  expect(e.log).toHaveBeenCalledWith(
    'No other workflow runs to monitor (minimum-checks is 0) - treating as docs-only PR',
  );
  expect(e.setFailed).not.toHaveBeenCalled();
});

test('all passing → success log with count', () => {
  const e = effects();
  reportFinalResult({ inProgress: [], nonPassing: [], relevantCount: 3 }, e);
  expect(e.log).toHaveBeenCalledWith('All 3 workflow runs completed successfully');
  expect(e.setFailed).not.toHaveBeenCalled();
});
