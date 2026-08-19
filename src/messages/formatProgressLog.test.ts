import { expect, test } from 'vitest';
import { formatProgressLog } from './formatProgressLog';
import type { RunComparison } from '../types';

const base: RunComparison = {
  unexpected: [],
  missing: [],
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

test('both → joined', () => {
  expect(formatProgressLog({ ...base, missing: ['a.yml'], inProgress: ['b.yml'] })).toBe(
    'not started: ["a.yml"] | in progress: ["b.yml"]',
  );
});

test('neither → empty', () => {
  expect(formatProgressLog(base)).toBe('');
});
