import { expect, test, vi } from 'vitest';
import { promote } from './promote';
import type { PromotionIO, PromotionTarget } from './promote';
import type { WorkflowJobSummary } from '../types';

const TARGET: PromotionTarget = {
  tag: 'v1',
  sha: 'abc123',
  selfWorkflowPath: '.github/workflows/move-major-tag.yml',
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

function makeIO(overrides: Partial<PromotionIO> = {}): PromotionIO {
  return {
    fetchJobs: vi.fn(async () => GREEN),
    compare: vi.fn(async () => ({ relation: 'ahead' as const, aheadBy: 1 })),
    moveTag: vi.fn(async () => undefined),
    ...overrides,
  };
}

test('a green surface ahead of the tag moves it', async () => {
  const io = makeIO();

  const outcome = await promote(TARGET, io);

  expect(io.fetchJobs).toHaveBeenCalledWith('abc123');
  expect(io.compare).toHaveBeenCalledWith('v1', 'abc123');
  expect(io.moveTag).toHaveBeenCalledWith('v1', 'abc123');
  expect(outcome).toEqual({ exitCode: 0, lines: ['::notice::v1 → abc123'] });
});

test('a held decision leaves the tag untouched', async () => {
  const io = makeIO({ compare: vi.fn(async () => ({ relation: 'identical' as const, aheadBy: 0 })) });

  const outcome = await promote(TARGET, io);

  expect(io.moveTag).not.toHaveBeenCalled();
  expect(outcome).toEqual({ exitCode: 0, lines: ['::notice::v1 already points at abc123'] });
});

test('a blocked decision leaves the tag untouched and fails the run', async () => {
  const io = makeIO({ fetchJobs: vi.fn(async () => []) });

  const outcome = await promote(TARGET, io);

  expect(io.moveTag).not.toHaveBeenCalled();
  expect(outcome.exitCode).toBe(1);
});
