import { expect, test } from 'vitest';
import { decide } from './decide';
import type { DriftFacts } from './decide';

function facts(overrides: Partial<DriftFacts> = {}): DriftFacts {
  return { tag: 'v1', branch: 'main', relation: 'ahead', aheadBy: 1, limit: 3, ...overrides };
}

test('a tag within the limit passes and says how far it lags', () => {
  expect(decide(facts())).toEqual({
    exitCode: 0,
    lines: ['::notice::v1 lags main by 1, within the limit of 3'],
  });
});

test('a tag on the branch head passes', () => {
  expect(decide(facts({ relation: 'identical', aheadBy: 0 }))).toEqual({
    exitCode: 0,
    lines: ['::notice::v1 lags main by 0, within the limit of 3'],
  });
});

test('drift exactly at the limit is still tolerated', () => {
  expect(decide(facts({ aheadBy: 3 })).exitCode).toBe(0);
});

test('drift past the limit is red, naming the gap and the cause', () => {
  const decision = decide(facts({ aheadBy: 4 }));

  expect(decision.exitCode).toBe(1);
  expect(decision.lines[0]).toContain('::error::');
  expect(decision.lines[0]).toContain('v1 lags main by 4, past the limit of 3');
  expect(decision.lines[0]).toContain('promoter');
});

test('an absent tag is red, since consumers pin to it', () => {
  const decision = decide(facts({ relation: 'missing', aheadBy: 0 }));

  expect(decision.exitCode).toBe(1);
  expect(decision.lines[0]).toContain('v1 does not exist');
});

test('a tag off the branch history is red however small the gap', () => {
  const decision = decide(facts({ relation: 'diverged', aheadBy: 1 }));

  expect(decision.exitCode).toBe(1);
  expect(decision.lines[0]).toContain('v1 points off main');
});

test('a tag ahead of the branch head is not drift', () => {
  expect(decide(facts({ relation: 'behind', aheadBy: 0 })).exitCode).toBe(0);
});
