import { expect, test } from 'vitest';
import { formatUnresolvedFailure } from './formatUnresolvedFailure';

const ENTRY = 'a.yml :: spread (dynamic matrix; no callback entry matches ...)';
const HEAD =
  `Unresolvable check names: ["${ENTRY}"]. willfire sees these jobs but cannot say what ` +
  'checks they will create, so the predicted set is incomplete and the gate cannot compare ' +
  'against it. Execution is always on; there is no input that enables it. Where a sandbox ' +
  'run or a resolver lookup failed, the entry names the reason. ';
const TAIL =
  ' Some jobs cannot be settled ahead of time at all, and `unknown` is the right answer for those.';

test('with no resolver declared, asks for one and gives the map key shape', () => {
  expect(formatUnresolvedFailure([ENTRY])).toBe(
    `${HEAD}No resolver is declared. For outputs the sandbox cannot compute, set the action's ` +
      '`resolve-outputs` input to one command per line, each printing a JSON map keyed by ' +
      '`<owner>/<repo>/<workflow-path>:<job-id>`.' +
      TAIL,
  );
});

test('with a resolver declared, sends the reader to the resolver and its matching rule', () => {
  expect(formatUnresolvedFailure([ENTRY], ['npx x resolve'])).toBe(
    `${HEAD}A resolver is declared, so the thing to debug is the resolver, not the workflow. ` +
      'Its map keys are `<owner>/<repo>/<workflow-path>:<job-id>`, and an entry matches on ' +
      'settled inputs only — one conditioned on an input willfire could not decide never ' +
      'matches, however right it looks.' +
      TAIL,
  );
});

test('never offers execution as something to switch on', () => {
  expect(formatUnresolvedFailure([ENTRY])).not.toContain('`execute` input');
});
