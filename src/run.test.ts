import { afterEach, beforeEach, expect, test, vi } from 'vitest';

vi.mock('@actions/core', async () => {
  const actual = await vi.importActual<typeof import('@actions/core')>('@actions/core');
  return { ...actual, setFailed: vi.fn() };
});

vi.mock('@actions/github', async () => {
  const actual = await vi.importActual<typeof import('@actions/github')>('@actions/github');
  return { ...actual, context: { repo: { owner: 'o', repo: 'r' }, sha: 'abc', payload: {} } };
});

vi.mock('@octokit/rest', async () => {
  const actual = await vi.importActual<typeof import('@octokit/rest')>('@octokit/rest');
  return { ...actual, Octokit: vi.fn(() => ({ rest: {} })) };
});

vi.mock('willfire', async () => {
  const actual = await vi.importActual<typeof import('willfire')>('willfire');
  return { ...actual, makeGithubClient: vi.fn(() => ({ willfire: true })) };
});

vi.mock('./monitor', async () => {
  const actual = await vi.importActual<typeof import('./monitor')>('./monitor');
  return { ...actual, monitor: vi.fn() };
});

import * as core from '@actions/core';
import { Octokit } from '@octokit/rest';
import { makeGithubClient } from 'willfire';
import { monitor } from './monitor';
import { run } from './run';

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  delete process.env.GITHUB_TOKEN;
  delete process.env.PR_MONITOR_EXECUTE;
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
  const params = vi.mocked(monitor).mock.calls[0][0];
  expect(params.core).toBe(core);
  expect(params.context.repo).toEqual({ owner: 'o', repo: 'r' });
  expect(core.setFailed).not.toHaveBeenCalled();
});

test('a leftover PR_MONITOR_EXECUTE value is ignored, whatever it says', async () => {
  process.env.GITHUB_TOKEN = 'tok';
  process.env.PR_MONITOR_EXECUTE = 'detect';
  await run();
  expect(core.setFailed).not.toHaveBeenCalled();
  expect(monitor).toHaveBeenCalledTimes(1);
});

test('monitor takes no execute flag', async () => {
  process.env.GITHUB_TOKEN = 'tok';
  await run();
  expect(vi.mocked(monitor).mock.calls[0][0]).not.toHaveProperty('execute');
});

test('prediction gets willfire’s own client, not the octokit one', async () => {
  process.env.GITHUB_TOKEN = 'tok';
  await run();
  expect(makeGithubClient).toHaveBeenCalledTimes(1);
  const params = vi.mocked(monitor).mock.calls[0][0];
  expect(params.predictClient).not.toBe(params.github);
});

