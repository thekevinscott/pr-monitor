import { execFileSync } from 'node:child_process';
import { expect, test } from 'vitest';
import { compareObserved } from '../../src/checks/compareObserved';
import type { WorkflowJobSummary } from '../../src/types';

const PYTHON = '.github/workflows/python.yml';

test('botbox run 41439916480 skipped matrix checks pass the gate', () => {
  const raw = execFileSync('gh', ['api', 'repos/thekevinscott/botbox/actions/runs/41439916480/jobs'], {
    encoding: 'utf8',
  });
  const response = JSON.parse(raw) as { jobs: Array<{ id: number; name: string; status: string; conclusion: string | null }> };
  const jobs: WorkflowJobSummary[] = response.jobs.map((job) => ({ ...job, workflowPath: PYTHON }));
  const comparison = compareObserved(
    [{ id: 41439916480, name: 'Python', path: PYTHON, event: 'pull_request', status: 'completed', conclusion: 'success' }],
    jobs,
    {
      workflows: [PYTHON],
      names: ['scope / Scope', 'Typecheck', 'CI scripts', 'Relay coverage', 'Lint', 'Shellcheck',
        'Integration (3.12)', 'Integration (3.13)', 'Unit (3.12)', 'Unit (3.13)'],
      unresolved: [],
      runLevel: [],
    },
  );
  expect(comparison.unexpectedNames).toEqual([]);
  expect(comparison.missingNames).toEqual([]);
});
