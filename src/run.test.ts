import { afterEach, beforeEach, expect, test, vi } from 'vitest';

vi.mock('@actions/core', async () => {
  const actual = await vi.importActual<typeof import('@actions/core')>('@actions/core');
  return { ...actual, setFailed: vi.fn() };
});

vi.mock('@actions/github', async () => {
  const actual = await vi.importActual<typeof import('@actions/github')>('@actions/github');
  return {
    ...actual,
    getOctokit: vi.fn(() => ({ rest: { checks: { listForRef: vi.fn() } } })),
    context: { repo: { owner: 'o', repo: 'r' }, sha: 'abc', payload: {} },
  };
});

vi.mock('./monitor', async () => {
  const actual = await vi.importActual<typeof import('./monitor')>('./monitor');
  return { ...actual, monitor: vi.fn() };
});

import * as core from '@actions/core';
import { getOctokit } from '@actions/github';
import { monitor } from './monitor';
import { run } from './run';

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  delete process.env.GITHUB_TOKEN;
});

test('missing GITHUB_TOKEN → setFailed and does not call monitor', async () => {
  await run();
  expect(core.setFailed).toHaveBeenCalledWith('GITHUB_TOKEN env var is required');
  expect(monitor).not.toHaveBeenCalled();
});

test('with GITHUB_TOKEN → builds octokit and calls monitor', async () => {
  process.env.GITHUB_TOKEN = 'tok';
  await run();
  expect(getOctokit).toHaveBeenCalledWith('tok');
  expect(monitor).toHaveBeenCalledTimes(1);
  expect(core.setFailed).not.toHaveBeenCalled();
});
