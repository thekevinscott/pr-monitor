import { afterEach, beforeEach, expect, test, vi } from 'vitest';

vi.mock('./run', async () => {
  const actual = await vi.importActual<typeof import('./run')>('./run');
  return { ...actual, run: vi.fn(() => new Promise<void>(() => undefined)) };
});

import { fail } from './entry';

beforeEach(() => {
  vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
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
