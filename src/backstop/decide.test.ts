import { expect, test } from 'vitest';
import { decide } from './decide';
import type { BackstopFacts } from './decide';
import type { GreenCommit } from './findGreenHead';

const SELF = '.github/workflows/backstop-major-tag.yml';

const GREEN: GreenCommit = {
  sha: 'abc123',
  jobs: [
    {
      id: 1,
      name: 'Test (100% coverage)',
      workflowPath: '.github/workflows/test.yml',
      status: 'completed',
      conclusion: 'success',
    },
  ],
  relation: 'ahead',
  aheadBy: 1,
};

function facts(overrides: Partial<BackstopFacts> = {}): BackstopFacts {
  return {
    tag: 'v1',
    branch: 'main',
    examined: 20,
    maxDrift: 3,
    selfWorkflowPath: SELF,
    green: GREEN,
    ...overrides,
  };
}

test('a tag already on the newest green commit is a silent no-op', () => {
  expect(decide(facts({ green: { ...GREEN, relation: 'identical', aheadBy: 0 } }))).toEqual({
    move: false,
    exitCode: 0,
    lines: ['::notice::v1 already points at abc123'],
  });
});

test('a tag one commit behind is moved without complaint', () => {
  expect(decide(facts())).toEqual({
    move: true,
    exitCode: 0,
    lines: ['::notice::v1 → abc123'],
  });
});

test('drift exactly at the limit is still tolerated', () => {
  expect(decide(facts({ green: { ...GREEN, aheadBy: 3 } })).exitCode).toBe(0);
});

test('drift past the limit moves the tag and still fails the run', () => {
  const decision = decide(facts({ green: { ...GREEN, aheadBy: 4 } }));

  expect(decision.move).toBe(true);
  expect(decision.exitCode).toBe(1);
  expect(decision.lines[0]).toBe('::notice::v1 → abc123');
  expect(decision.lines[1]).toContain('v1 was 4 commits behind abc123');
  expect(decision.lines[1]).toContain('::error::');
});

test('no green commit in the window is red, never a quiet pass', () => {
  const decision = decide(facts({ green: null }));

  expect(decision.move).toBe(false);
  expect(decision.exitCode).toBe(1);
  expect(decision.lines[0]).toContain('no green commit among the 20 most recent commits on main');
});

test('an absent tag is created rather than reported as drift', () => {
  expect(decide(facts({ green: { ...GREEN, relation: 'missing', aheadBy: 0 } }))).toEqual({
    move: true,
    exitCode: 0,
    lines: ['::notice::v1 created at abc123'],
  });
});

test('a tag off this history is refused, exactly as the event-driven path refuses it', () => {
  const decision = decide(facts({ green: { ...GREEN, relation: 'diverged', aheadBy: 0 } }));

  expect(decision.move).toBe(false);
  expect(decision.exitCode).toBe(1);
  expect(decision.lines[0]).toContain('not a descendant of v1');
});

test('a tag ahead of the newest green commit is left where it is', () => {
  const decision = decide(facts({ green: { ...GREEN, relation: 'behind', aheadBy: 0 } }));

  expect(decision.move).toBe(false);
  expect(decision.exitCode).toBe(0);
});
