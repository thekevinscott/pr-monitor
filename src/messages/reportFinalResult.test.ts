import { expect, test, vi } from 'vitest';
import { reportFinalResult } from './reportFinalResult';
import type { RunComparison } from '../types';

const base: RunComparison = {
  unexpected: [],
  missing: [],
  matched: [],
  inProgress: [],
  nonPassing: [],
};

function effects() {
  return { log: vi.fn(), setFailed: vi.fn() };
}

test('non-passing → setFailed with list', () => {
  const e = effects();
  reportFinalResult({ ...base, nonPassing: ['test.yml (cancelled)'] }, e);
  expect(e.setFailed).toHaveBeenCalledWith('Non-passing runs: ["test.yml (cancelled)"]');
  expect(e.log).not.toHaveBeenCalled();
});

test('all passing → success log with the matched count', () => {
  const e = effects();
  reportFinalResult({ ...base, matched: ['a.yml', 'b.yml', 'c.yml'] }, e);
  expect(e.log).toHaveBeenCalledWith('3 predicted workflow runs completed successfully');
  expect(e.setFailed).not.toHaveBeenCalled();
});

test('nothing predicted → reports zero rather than failing', () => {
  const e = effects();
  reportFinalResult(base, e);
  expect(e.log).toHaveBeenCalledWith('0 predicted workflow runs completed successfully');
  expect(e.setFailed).not.toHaveBeenCalled();
});
