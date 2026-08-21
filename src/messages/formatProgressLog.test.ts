import { expect, test } from 'vitest';
import { formatProgressLog } from './formatProgressLog';
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

test('missing only → names what has not started', () => {
  expect(formatProgressLog({ ...base, missing: ['.github/workflows/test.yml'] })).toBe(
    'not started: [".github/workflows/test.yml"]',
  );
});

test('in progress only → names what is still running', () => {
  expect(formatProgressLog({ ...base, inProgress: ['.github/workflows/test.yml'] })).toBe(
    'in progress: [".github/workflows/test.yml"]',
  );
});

test('missing names only → names the checks that have not reported', () => {
  expect(formatProgressLog({ ...base, missingNames: ['Test (20)'] })).toBe(
    'checks not reported: ["Test (20)"]',
  );
});

test('all three → joined', () => {
  expect(
    formatProgressLog({
      ...base,
      missing: ['a.yml'],
      inProgress: ['b.yml'],
      missingNames: ['Build'],
    }),
  ).toBe('not started: ["a.yml"] | in progress: ["b.yml"] | checks not reported: ["Build"]');
});

test('none → empty', () => {
  expect(formatProgressLog(base)).toBe('');
});
