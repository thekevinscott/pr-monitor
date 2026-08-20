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

test('a predicted check name that never reported → setFailed naming it', () => {
  const e = effects();
  reportFinalResult({ ...base, missingNames: ['Test (20)'] }, e);
  expect(e.setFailed.mock.calls[0]?.[0]).toContain('["Test (20)"]');
  expect(e.setFailed.mock.calls[0]?.[0]).toContain('these are not late');
  expect(e.log).not.toHaveBeenCalled();
});

test('a failed run is reported ahead of the names it swallowed', () => {
  const e = effects();
  reportFinalResult(
    { ...base, nonPassing: ['test.yml (failure)'], missingNames: ['Deploy'] },
    e,
  );
  expect(e.setFailed).toHaveBeenCalledTimes(1);
  expect(e.setFailed.mock.calls[0]?.[0]).toContain('Non-passing runs');
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
