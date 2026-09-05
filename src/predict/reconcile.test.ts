import { predict as willfirePredict } from 'willfire';
import { expect, test, vi } from 'vitest';
import { reconcile } from './reconcile';
import type { PredictClient, PredictPr } from '../types';

const HEAD = 'head-sha';
const SELF = '.github/workflows/pr-monitor.yml';
const CALLER = '.github/workflows/caller.yml';
const CALLEE_PATH = '.github/workflows/reusable.yml';

const step = '    runs-on: ubuntu-latest\n    steps:\n      - run: echo hi\n';
const job = (id: string) => `  ${id}:\n${step}`;
const reusable = (jobs: string) => `name: Reusable\non:\n  workflow_call:\njobs:\n${jobs}`;

const CALLEE_AT: Record<string, string> = {
  'callee-a': reusable(job('alpha')),
  'callee-b': reusable(job('alpha') + job('beta')),
  'callee-dynamic': reusable(
    `  setup:\n    runs-on: ubuntu-latest\n    outputs:\n      matrix: \${{ steps.emit.outputs.matrix }}\n    steps:\n      - id: emit\n        run: echo 'matrix=["x"]' >> "$GITHUB_OUTPUT"\n` +
      `  spread:\n    needs: setup\n    runs-on: ubuntu-latest\n    strategy:\n      matrix:\n        leg: \${{ fromJSON(needs.setup.outputs.matrix) }}\n${step}`,
  ),
};

const OWN: Record<string, string> = {
  [SELF]: `name: PR Monitor\non: pull_request\njobs:\n${job('monitor')}`,
  [CALLER]: `name: Caller\non: pull_request\njobs:\n  call:\n    uses: o/shared/${CALLEE_PATH}@v0\n`,
};

const callee = { owner: 'o', repo: 'shared', ref: 'v0', sha: 'callee-a' };
const head = { owner: 'o', repo: 'r', ref: HEAD, sha: HEAD };

function makeGithub(tagSha: string | null) {
  const listRepoWorkflows = vi.fn(async () => ({
    data: Object.keys(OWN).map((path) => ({ path, state: 'active' })),
  }));
  const rest = {
    pulls: {
      get: async () => ({ data: { commits: 1, base: { ref: 'main' }, head: { sha: HEAD } } }),
      listFiles: async () => ({ data: [{ filename: 'src/index.ts' }] }),
    },
    repos: {
      getCommit: async ({ ref }: { ref: string }) => {
        if (ref === HEAD) return { data: { sha: HEAD, commit: { message: 'a normal commit' } } };
        if (tagSha === null) throw new Error('404');
        return { data: { sha: tagSha, commit: { message: 'the callee' } } };
      },
      getContent: async ({ repo, path, ref }: { repo: string; path: string; ref: string }) => {
        if (repo === 'shared') {
          if (path !== CALLEE_PATH || !(ref in CALLEE_AT)) throw new Error('404');
          return { data: CALLEE_AT[ref] };
        }
        if (!(path in OWN)) throw new Error('404');
        return { data: OWN[path] };
      },
    },
    actions: { listRepoWorkflows },
  };
  const github = {
    rest,
    paginate: async (fn: (p: unknown) => Promise<{ data: unknown }>, params: unknown) =>
      (await fn(params)).data,
  } as unknown as PredictClient;
  return { github, listRepoWorkflows };
}

function params(github: PredictClient, callbacks?: readonly string[]) {
  // Production spawns willfire's CLI; taking the same prediction from the library
  // against the fake client keeps the re-prediction real without a network.
  const predict: PredictPr = (slug, pullNumber, inputs) =>
    willfirePredict(github, slug, pullNumber, inputs);
  return {
    github,
    predict,
    slug: 'o/r',
    pullNumber: 5,
    inputs: { action: 'opened' as const, callbacks },
    selfPath: SELF,
    sources: [head, callee],
  };
}

test('every ref still names its commit -> nothing to reconcile, and no re-prediction', async () => {
  const { github, listRepoWorkflows } = makeGithub('callee-a');
  expect(await reconcile(params(github))).toEqual({ kind: 'unchanged' });
  expect(listRepoWorkflows).not.toHaveBeenCalled();
});

test('a ref that moved -> the checks the new commit predicts', async () => {
  const { github } = makeGithub('callee-b');
  const outcome = await reconcile(params(github));
  expect(outcome.kind).toBe('repredicted');
  if (outcome.kind !== 'repredicted') return;
  expect(outcome.expected.names).toEqual(['call / alpha', 'call / beta']);
  expect(outcome.detail).toBe(
    'Refs behind the prediction moved: o/shared@v0 callee-a -> callee-b. Re-predicted at the new commits.',
  );
});

test('a ref that stopped resolving -> failed, naming it, without predicting', async () => {
  const { github, listRepoWorkflows } = makeGithub(null);
  const outcome = await reconcile(params(github));
  expect(outcome.kind).toBe('failed');
  if (outcome.kind !== 'failed') return;
  expect(outcome.detail).toContain('o/shared@v0 callee-a -> could not be re-resolved');
  expect(listRepoWorkflows).not.toHaveBeenCalled();
});

test('a move onto a program with a hole in it -> failed, naming the hole', async () => {
  const { github } = makeGithub('callee-dynamic');
  const outcome = await reconcile(params(github));
  expect(outcome.kind).toBe('failed');
  if (outcome.kind !== 'failed') return;
  expect(outcome.detail).toContain('callee-dynamic');
  expect(outcome.detail).toContain('Unresolvable check names');
  expect(outcome.detail).toContain('No resolver is declared');
});

test('the hole is reported against the resolver when one was declared', async () => {
  const { github } = makeGithub('callee-dynamic');
  const outcome = await reconcile(params(github, ['echo {}']));
  expect(outcome.kind).toBe('failed');
  if (outcome.kind !== 'failed') return;
  expect(outcome.detail).toContain('A resolver is declared');
});
