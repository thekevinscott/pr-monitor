import { afterEach, beforeEach, expect, test, vi } from 'vitest';

vi.mock('@actions/core', async () => {
  const actual = await vi.importActual<typeof import('@actions/core')>('@actions/core');
  return { ...actual, setFailed: vi.fn() };
});

vi.mock('@actions/github', async () => {
  const actual = await vi.importActual<typeof import('@actions/github')>('@actions/github');
  return { ...actual, context: { repo: { owner: 'o', repo: 'r' }, sha: 'abc', payload: {} } };
});

vi.mock('@octokit/rest', () => ({ Octokit: vi.fn(() => ({ rest: {} })) }));

vi.mock('./monitor', async () => {
  const actual = await vi.importActual<typeof import('./monitor')>('./monitor');
  return { ...actual, monitor: vi.fn() };
});

import * as core from '@actions/core';
import { Octokit } from '@octokit/rest';
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

test('with GITHUB_TOKEN → builds an authenticated octokit and calls monitor', async () => {
  process.env.GITHUB_TOKEN = 'tok';
  await run();
  expect(Octokit).toHaveBeenCalledWith({ auth: 'tok' });
  expect(monitor).toHaveBeenCalledTimes(1);
  expect(core.setFailed).not.toHaveBeenCalled();
});
