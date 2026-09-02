/**
 * The cwd a `resolve-outputs` callback inherits. willfire spawns each callback
 * with no `cwd` of its own, so it gets the monitor process's — which has to be
 * the consumer's workspace, the directory a `run:` step starts in. Running the
 * monitor from the action's private install directory left callbacks there too.
 */

import { execFile } from 'node:child_process';
import { chmod, mkdir, mkdtemp, readFile, realpath, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { expect, test } from 'vitest';
import { parse } from 'yaml';

const execFileAsync = promisify(execFile);

const ACTION_PATH_EXPR = '${{ github.action_path }}';
const WORKSPACE_EXPR = '${{ github.workspace }}';

interface Step {
  name?: string;
  run?: string;
  'working-directory'?: string;
  env?: Record<string, string>;
}

const manifestPath = fileURLToPath(new URL('../../action.yml', import.meta.url));

const step = async (name: string): Promise<Step> => {
  const manifest = parse(await readFile(manifestPath, 'utf8')) as { runs: { steps: Step[] } };
  const found = manifest.runs.steps.find((s) => s.name === name);
  if (found === undefined) throw new Error(`action.yml has no '${name}' step`);
  return found;
};

test('the monitor runs from the workspace, so a callback inherits it', async () => {
  expect((await step('Run monitor'))['working-directory']).toBe(WORKSPACE_EXPR);
});

test('installing dependencies still runs from the action directory', async () => {
  expect((await step('Install runtime dependencies'))['working-directory']).toBe(ACTION_PATH_EXPR);
});

test('the monitor script interpolates nothing inline', async () => {
  expect((await step('Run monitor')).run).not.toContain('${{');
});

test('the monitor script resolves the action off env, not off the cwd', async () => {
  const { run, env = {} } = await step('Run monitor');
  const actionDir = await mkdtemp(join(tmpdir(), 'pr-monitor-action-'));
  const workspace = await realpath(await mkdtemp(join(tmpdir(), 'pr-monitor-workspace-')));

  // Stands in for the real tsx + entrypoint: all this run has to prove is which
  // directory the monitor process starts in.
  const tsx = join(actionDir, 'node_modules', '.bin', 'tsx');
  await mkdir(dirname(tsx), { recursive: true });
  await writeFile(tsx, '#!/bin/sh\necho "cwd=$(pwd -P)"\necho "entry=$1"\n');
  await chmod(tsx, 0o755);
  await mkdir(join(actionDir, 'src'), { recursive: true });
  await writeFile(join(actionDir, 'src', 'entry.ts'), '');

  const rendered = Object.fromEntries(
    Object.entries(env).map(([key, value]) => [
      key,
      value.includes(ACTION_PATH_EXPR) ? actionDir : '',
    ]),
  );

  const { stdout } = await execFileAsync(
    'bash',
    ['--noprofile', '--norc', '-e', '-o', 'pipefail', '-c', String(run)],
    { cwd: workspace, env: { PATH: process.env.PATH ?? '', ...rendered } },
  );

  expect(stdout).toContain(`cwd=${workspace}`);
  expect(stdout).toContain(`entry=${join(actionDir, 'src', 'entry.ts')}`);
});
