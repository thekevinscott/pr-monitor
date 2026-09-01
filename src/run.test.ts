import { afterEach, beforeEach, expect, test, vi } from 'vitest';

vi.mock('@actions/core', async () => {
  const actual = await vi.importActual<typeof import('@actions/core')>('@actions/core');
  return { ...actual, setFailed: vi.fn(), warning: vi.fn() };
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
  expect(vi.mocked(monitor).mock.calls[0][0].execute).toBe(false);
  expect(core.setFailed).not.toHaveBeenCalled();
});

test('PR_MONITOR_EXECUTE=true → execution on, no warning', async () => {
  process.env.GITHUB_TOKEN = 'tok';
  process.env.PR_MONITOR_EXECUTE = 'true';
  await run();
  expect(vi.mocked(monitor).mock.calls[0][0].execute).toBe(true);
  expect(core.warning).not.toHaveBeenCalled();
  expect(core.setFailed).not.toHaveBeenCalled();
});

test('PR_MONITOR_EXECUTE=false → execution off', async () => {
  process.env.GITHUB_TOKEN = 'tok';
  process.env.PR_MONITOR_EXECUTE = 'false';
  await run();
  expect(vi.mocked(monitor).mock.calls[0][0].execute).toBe(false);
  expect(core.warning).not.toHaveBeenCalled();
  expect(core.setFailed).not.toHaveBeenCalled();
});

test('the retired grant spelling still runs, and warns that neither half scoped anything', async () => {
  process.env.GITHUB_TOKEN = 'tok';
  process.env.PR_MONITOR_EXECUTE = 'o/conventions:detect';
  await run();
  expect(vi.mocked(monitor).mock.calls[0][0].execute).toBe(true);
  const warned = vi.mocked(core.warning).mock.calls[0][0] as string;
  expect(warned).toContain('o/conventions:detect');
  expect(warned).toMatch(/neither the repo nor the job/);
  expect(warned).toMatch(/execute: true/);
  expect(core.setFailed).not.toHaveBeenCalled();
});

test('prediction gets willfire’s own client, not the octokit one', async () => {
  process.env.GITHUB_TOKEN = 'tok';
  await run();
  expect(makeGithubClient).toHaveBeenCalledTimes(1);
  const params = vi.mocked(monitor).mock.calls[0][0];
  // The two are not interchangeable — willfire's client hands back raw file
  // text and unwrapped lists where octokit returns JSON and an envelope — so
  // handing prediction the polling client would fail on every workflow read.
  expect(params.predictClient).not.toBe(params.github);
});

test('malformed PR_MONITOR_EXECUTE → setFailed naming the value, monitor not called', async () => {
  process.env.GITHUB_TOKEN = 'tok';
  process.env.PR_MONITOR_EXECUTE = 'detect';
  await run();
  expect(core.setFailed).toHaveBeenCalledWith(
    "execute input value 'detect' is neither true nor false",
  );
  expect(monitor).not.toHaveBeenCalled();
});
