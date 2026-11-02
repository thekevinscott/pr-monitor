import { expect, test } from 'vitest';
import { matchSkippedMatrix } from './matchSkippedMatrix';

test('matches expanded names while treating literal punctuation as exact', () => {
  const names = new Set(['Unit [linux] (3.12)', 'Unit [linux] (3.13)', 'Unit linux (3.12)']);
  expect(matchSkippedMatrix('Unit [linux] (${{ matrix.python-version }})', names)).toEqual([
    'Unit [linux] (3.12)',
    'Unit [linux] (3.13)',
  ]);
});

test('matches multiple matrix expressions in one skipped name', () => {
  const names = new Set(['Test (linux, 3.12)', 'Test (windows, 3.13)', 'Build (linux, 3.12)']);
  expect(matchSkippedMatrix('Test (${{ matrix.os }}, ${{ matrix.python-version }})', names)).toEqual([
    'Test (linux, 3.12)',
    'Test (windows, 3.13)',
  ]);
});

test('an ordinary name supplies no matrix cells', () => {
  expect(matchSkippedMatrix('Unit', new Set(['Unit (3.12)']))).toEqual([]);
});
