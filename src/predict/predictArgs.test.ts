import { expect, test } from 'vitest';
import { predictArgs } from './predictArgs';

test('the repo, the pull number, and JSON output are always asked for', () => {
  expect(predictArgs('o/r', 5, {})).toEqual(['--repo', 'o/r', '--pr', '5', '--json']);
});

test('a known event action is passed rather than left to willfire’s guess', () => {
  expect(predictArgs('o/r', 5, { action: 'reopened' })).toEqual([
    '--repo',
    'o/r',
    '--pr',
    '5',
    '--action',
    'reopened',
    '--json',
  ]);
});

test('an unknown event action is omitted, since the flag refuses anything else', () => {
  expect(predictArgs('o/r', 5, { action: undefined })).not.toContain('--action');
});

test('each resolver command becomes its own --callback, in the order given', () => {
  expect(predictArgs('o/r', 5, { callbacks: ['echo a', 'echo b'] })).toEqual([
    '--repo',
    'o/r',
    '--pr',
    '5',
    '--callback',
    'echo a',
    '--callback',
    'echo b',
    '--json',
  ]);
});

test('no resolver commands means no --callback at all', () => {
  expect(predictArgs('o/r', 5, { callbacks: [] })).not.toContain('--callback');
});
