import { expect, test, vi } from 'vitest';
import { backstop } from './backstop';
import type { BackstopIO, BackstopTarget } from './backstop';
import type { WorkflowJobSummary } from '../types';

const SELF = '.github/workflows/backstop-major-tag.yml';

const TARGET: BackstopTarget = {
  tag: 'v1',
  branch: 'main',
  depth: 20,
  maxDrift: 3,
  selfWorkflowPath: SELF,
};

const GREEN: WorkflowJobSummary[] = [
  {
    id: 1,
    name: 'Test (100% coverage)',
    workflowPath: '.github/workflows/test.yml',
    status: 'completed',
    conclusion: 'success',
  },
];

function makeIO(overrides: Partial<BackstopIO> = {}): BackstopIO {
  return {
    listCommits: vi.fn(async () => [
      { sha: 'head', parent: 'prev' },
      { sha: 'branch', parent: 'prev' },
      { sha: 'prev', parent: null },
    ]),
    fetchJobs: vi.fn(async () => GREEN),
    compare: vi.fn(async () => ({ relation: 'ahead' as const, aheadBy: 1 })),
    moveTag: vi.fn(async () => undefined),
    ...overrides,
  };
}

test('moves the tag to the branch tip when its surface is green', async () => {
  const io = makeIO();

  const outcome = await backstop(TARGET, io);

  expect(io.listCommits).toHaveBeenCalledWith('main', 20);
  expect(io.moveTag).toHaveBeenCalledWith('v1', 'head');
  expect(outcome).toEqual({ exitCode: 0, lines: ['::notice::v1 → head'] });
});

test('never tags a commit that was merged in rather than merged to', async () => {
  const io = makeIO({
    fetchJobs: vi.fn(async (sha: string) =>
      sha === 'head' ? [{ ...GREEN[0], status: 'in_progress', conclusion: null }] : GREEN,
    ),
  });

  await backstop(TARGET, io);

  expect(io.fetchJobs).not.toHaveBeenCalledWith('branch');
  expect(io.moveTag).toHaveBeenCalledWith('v1', 'prev');
});

test('a healthy repo leaves the tag untouched', async () => {
  const io = makeIO({ compare: vi.fn(async () => ({ relation: 'identical' as const, aheadBy: 0 })) });

  const outcome = await backstop(TARGET, io);

  expect(io.moveTag).not.toHaveBeenCalled();
  expect(outcome.exitCode).toBe(0);
});

test('drift past the limit heals the tag and fails the run', async () => {
  const io = makeIO({ compare: vi.fn(async () => ({ relation: 'ahead' as const, aheadBy: 9 })) });

  const outcome = await backstop(TARGET, io);

  expect(io.moveTag).toHaveBeenCalledWith('v1', 'head');
  expect(outcome.exitCode).toBe(1);
});

test('no green commit anywhere in the window fails without touching the tag', async () => {
  const io = makeIO({ fetchJobs: vi.fn(async () => []) });

  const outcome = await backstop(TARGET, io);

  expect(io.moveTag).not.toHaveBeenCalled();
  expect(outcome.exitCode).toBe(1);
  expect(outcome.lines[0]).toContain('no green commit among the 2 most recent commits on main');
});
