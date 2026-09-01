import { expect, test } from 'vitest';
import { decide } from './decide';
import type { PromotionFacts } from './decide';
import type { TagRelation } from '../github/compareToTag';
import type { WorkflowJobSummary } from '../types';

const SELF = '.github/workflows/move-major-tag.yml';

function job(overrides: Partial<WorkflowJobSummary> = {}): WorkflowJobSummary {
  return {
    id: 1,
    name: 'Test (100% coverage)',
    workflowPath: '.github/workflows/test.yml',
    status: 'completed',
    conclusion: 'success',
    ...overrides,
  };
}

function facts(overrides: Partial<PromotionFacts> = {}): PromotionFacts {
  return {
    tag: 'v1',
    sha: 'abc123',
    selfWorkflowPath: SELF,
    jobs: [job()],
    relation: 'ahead' as TagRelation,
    ...overrides,
  };
}

test('an unreadable self path blocks rather than guessing', () => {
  expect(decide(facts({ selfWorkflowPath: null }))).toEqual({
    move: false,
    exitCode: 1,
    lines: ['::error::GITHUB_WORKFLOW_REF is unset or malformed; cannot exclude this run from itself'],
  });
});

test("this gate's own jobs are excluded, so a run judging only itself blocks", () => {
  const decision = decide(facts({ jobs: [job({ workflowPath: SELF })] }));

  expect(decision.move).toBe(false);
  expect(decision.exitCode).toBe(1);
  expect(decision.lines[0]).toContain('no other checks reported for abc123');
});

test('an empty job list blocks', () => {
  expect(decide(facts({ jobs: [] })).exitCode).toBe(1);
});

test('an unfinished job holds the tag without failing the run', () => {
  const decision = decide(
    facts({ jobs: [job(), job({ name: 'Lint', status: 'in_progress', conclusion: null })] }),
  );

  expect(decision).toEqual({
    move: false,
    exitCode: 0,
    lines: ['::notice::still running: Lint'],
  });
});

test('a failing job holds the tag and names it', () => {
  const decision = decide(facts({ jobs: [job({ name: 'Lint', conclusion: 'failure' })] }));

  expect(decision).toEqual({
    move: false,
    exitCode: 0,
    lines: ['::notice::v1 held back: Lint did not pass'],
  });
});

test('neutral and stale count as passing, per the shared predicate', () => {
  const decision = decide(
    facts({ jobs: [job({ conclusion: 'neutral' }), job({ conclusion: 'stale' })] }),
  );

  expect(decision.move).toBe(true);
});

test('a commit ahead of the tag moves it', () => {
  expect(decide(facts({ relation: 'ahead' }))).toEqual({
    move: true,
    exitCode: 0,
    lines: ['::notice::v1 → abc123'],
  });
});

test('an absent tag is created', () => {
  expect(decide(facts({ relation: 'missing' }))).toEqual({
    move: true,
    exitCode: 0,
    lines: ['::notice::v1 created at abc123'],
  });
});

test('a tag already on this commit is left alone', () => {
  expect(decide(facts({ relation: 'identical' }))).toEqual({
    move: false,
    exitCode: 0,
    lines: ['::notice::v1 already points at abc123'],
  });
});

test('an older commit never drags the tag backwards', () => {
  const decision = decide(facts({ relation: 'behind' }));

  expect(decision.move).toBe(false);
  expect(decision.exitCode).toBe(0);
  expect(decision.lines[0]).toContain('is behind v1');
});

test('a tag off this history blocks and asks for a look', () => {
  const decision = decide(facts({ relation: 'diverged' }));

  expect(decision.move).toBe(false);
  expect(decision.exitCode).toBe(1);
  expect(decision.lines[0]).toContain('not a descendant of v1');
});
