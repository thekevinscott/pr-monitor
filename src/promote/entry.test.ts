import { afterEach, beforeEach, expect, test, vi } from 'vitest';

// Importing ./entry runs `run().then(exit).catch(fail)` at module load; a promise
// that never settles keeps the load inert so both branches are tested directly.
vi.mock('./run', async () => {
  const actual = await vi.importActual<typeof import('./run')>('./run');
  return { ...actual, run: vi.fn(() => new Promise<number>(() => undefined)) };
});

import { exit, fail } from './entry';

beforeEach(() => {
  vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

test('exits with the code it is given', () => {
  exit(1);
  expect(process.exit).toHaveBeenCalledWith(1);
});

test('an Error rejection is annotated and fails the step', () => {
  fail(new Error('boom'));
  expect(console.log).toHaveBeenCalledWith('::error::boom');
  expect(process.exit).toHaveBeenCalledWith(1);
});

test('a non-Error rejection is stringified', () => {
  fail('nope');
  expect(console.log).toHaveBeenCalledWith('::error::nope');
});
