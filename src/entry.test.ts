import { beforeEach, expect, test, vi } from 'vitest';

vi.mock('@actions/core', async () => {
  const actual = await vi.importActual<typeof import('@actions/core')>('@actions/core');
  return { ...actual, setFailed: vi.fn() };
});

// Importing ./entry runs `run().catch(reportFailure)` at module load; keep run() a
// resolved no-op so the load has no side effects and the branch is tested directly.
vi.mock('./run', async () => {
  const actual = await vi.importActual<typeof import('./run')>('./run');
  return { ...actual, run: vi.fn(() => Promise.resolve()) };
});

import * as core from '@actions/core';
import { reportFailure } from './entry';

beforeEach(() => {
  vi.clearAllMocks();
});

test('Error rejection → setFailed with the message', () => {
  reportFailure(new Error('boom'));
  expect(core.setFailed).toHaveBeenCalledWith('boom');
});

test('non-Error rejection → setFailed with String(value)', () => {
  reportFailure('nope');
  expect(core.setFailed).toHaveBeenCalledWith('nope');
});
