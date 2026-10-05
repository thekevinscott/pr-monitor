import { afterEach, beforeEach, expect, test, vi } from 'vitest';

vi.mock('@octokit/rest', async () => {
  const actual = await vi.importActual<typeof import('@octokit/rest')>('@octokit/rest');
  return { ...actual, Octokit: vi.fn(() => ({})) };
});

vi.mock('./reportFailure', async () => {
  const actual = await vi.importActual<typeof import('./reportFailure')>('./reportFailure');
  return { ...actual, reportFailure: vi.fn() };
});

import { Octokit } from '@octokit/rest';
import { reportFailure } from './reportFailure';
import { run } from './run';

beforeEach(() => {
  vi.clearAllMocks();
  process.env.GITHUB_TOKEN = 'tok';
  process.env.GITHUB_API_URL = 'https://api.example';
  process.env.E2E_OWNER = 'o';
  process.env.E2E_REPO = 'r';
  process.env.E2E_RUN_URL = 'https://run';
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

test('reports the run named in the environment and logs the outcome', async () => {
  vi.mocked(reportFailure).mockResolvedValue('Opened x');

  await run();

  expect(Octokit).toHaveBeenCalledWith({ auth: 'tok', baseUrl: 'https://api.example' });
  expect(reportFailure).toHaveBeenCalledWith({}, 'o', 'r', 'https://run');
  expect(console.log).toHaveBeenCalledWith('Opened x');
});

test('refuses to run without a run URL', async () => {
  delete process.env.E2E_RUN_URL;

  await expect(run()).rejects.toThrow('E2E_RUN_URL is required');
});
