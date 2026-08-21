import { expect, test } from 'vitest';
import { parseGrants } from './parseGrants';

test('empty input grants nothing', () => {
  expect(parseGrants('')).toEqual({ grants: [] });
});

test('whitespace-only input grants nothing', () => {
  expect(parseGrants('  \n ')).toEqual({ grants: [] });
});

test('one grant with one job', () => {
  expect(parseGrants('o/conventions:detect')).toEqual({
    grants: [{ repo: 'o/conventions', jobs: ['detect'] }],
  });
});

test('comma-separated jobs', () => {
  expect(parseGrants('o/r:detect,scan')).toEqual({
    grants: [{ repo: 'o/r', jobs: ['detect', 'scan'] }],
  });
});

test('multiple grants split on any whitespace', () => {
  expect(parseGrants('o/a:one\no/b:two three/c:x,y')).toEqual({
    grants: [
      { repo: 'o/a', jobs: ['one'] },
      { repo: 'o/b', jobs: ['two'] },
      { repo: 'three/c', jobs: ['x', 'y'] },
    ],
  });
});

test('no colon → refused naming the entry', () => {
  expect(parseGrants('o/r')).toEqual({ malformed: 'o/r' });
});

test('empty repo → refused', () => {
  expect(parseGrants(':detect')).toEqual({ malformed: ':detect' });
});

test('repo without an owner → refused', () => {
  expect(parseGrants('r:detect')).toEqual({ malformed: 'r:detect' });
});

test('repo with an empty half → refused', () => {
  expect(parseGrants('o/:detect')).toEqual({ malformed: 'o/:detect' });
});

test('no jobs after the colon → refused', () => {
  expect(parseGrants('o/r:')).toEqual({ malformed: 'o/r:' });
});

test('jobs that are only commas → refused', () => {
  expect(parseGrants('o/r:,')).toEqual({ malformed: 'o/r:,' });
});

test('one bad entry refuses the input even when others are fine', () => {
  expect(parseGrants('o/a:one nope o/b:two')).toEqual({ malformed: 'nope' });
});
