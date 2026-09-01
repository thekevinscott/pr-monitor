import { expect, test, vi } from 'vitest';
import { reportFinalResult } from './reportFinalResult';
import type { GateComparison } from '../types';

const base: GateComparison = {
  unexpected: [],
  unexpectedNames: [],
  missing: [],
  missingNames: [],
  matchedNames: [],
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

test('a name that never reported is not this function\'s verdict to give', () => {
  const e = effects();
  reportFinalResult({ ...base, missingNames: ['Test (20)'], matched: ['a.yml'] }, e);
  expect(e.setFailed).not.toHaveBeenCalled();
});

test('all passing → success log with both counts', () => {
  const e = effects();
  reportFinalResult(
    { ...base, matched: ['a.yml', 'b.yml'], matchedNames: ['Build', 'Lint', 'Test'] },
    e,
  );
  expect(e.log).toHaveBeenCalledWith(
    '3 predicted check names reported across 2 workflow runs, all passing',
  );
  expect(e.setFailed).not.toHaveBeenCalled();
});

test('nothing predicted → reports zero rather than failing', () => {
  const e = effects();
  reportFinalResult(base, e);
  expect(e.log).toHaveBeenCalledWith(
    '0 predicted check names reported across 0 workflow runs, all passing',
  );
  expect(e.setFailed).not.toHaveBeenCalled();
});
