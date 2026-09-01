import { expect, test, vi } from 'vitest';
import { findGreenHead } from './findGreenHead';
import type { GreenSearchIO } from './findGreenHead';
import type { WorkflowJobSummary } from '../types';

const SELF = '.github/workflows/backstop-major-tag.yml';

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

function makeIO(jobsBySha: Record<string, WorkflowJobSummary[]>): GreenSearchIO {
  return {
    fetchJobs: vi.fn(async (sha: string) => jobsBySha[sha] ?? []),
    compare: vi.fn(async () => ({ relation: 'ahead' as const, aheadBy: 2 })),
  };
}

test('stops at the newest green commit without reading the rest', async () => {
  const io = makeIO({ head: [job()], older: [job()] });

  expect(await findGreenHead(['head', 'older'], 'v1', SELF, io)).toEqual({
    sha: 'head',
    jobs: [job()],
    relation: 'ahead',
    aheadBy: 2,
  });
  expect(io.fetchJobs).toHaveBeenCalledTimes(1);
  expect(io.compare).toHaveBeenCalledWith('v1', 'head');
});

test('walks past a commit still running its checks', async () => {
  const io = makeIO({
    head: [job({ status: 'in_progress', conclusion: null })],
    older: [job()],
  });

  expect((await findGreenHead(['head', 'older'], 'v1', SELF, io))?.sha).toBe('older');
});

test('walks past a commit whose checks failed', async () => {
  const io = makeIO({ head: [job({ conclusion: 'failure' })], older: [job()] });

  expect((await findGreenHead(['head', 'older'], 'v1', SELF, io))?.sha).toBe('older');
});

test("the backstop's own jobs never count as another commit's evidence", async () => {
  const io = makeIO({ head: [job({ workflowPath: SELF })], older: [job()] });

  expect((await findGreenHead(['head', 'older'], 'v1', SELF, io))?.sha).toBe('older');
});

test('an unreadable self path finds nothing rather than trusting the surface', async () => {
  const io = makeIO({ head: [job()] });

  expect(await findGreenHead(['head'], 'v1', null, io)).toBeNull();
  expect(io.compare).not.toHaveBeenCalled();
});

test('no green commit in the window is null, not a guess', async () => {
  const io = makeIO({ head: [job({ conclusion: 'failure' })] });

  expect(await findGreenHead(['head'], 'v1', SELF, io)).toBeNull();
});

test('an empty chain reads nothing', async () => {
  const io = makeIO({});

  expect(await findGreenHead([], 'v1', SELF, io)).toBeNull();
  expect(io.fetchJobs).not.toHaveBeenCalled();
});
