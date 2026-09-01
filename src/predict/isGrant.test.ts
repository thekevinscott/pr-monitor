import { expect, test } from 'vitest';
import { isGrant } from './isGrant';

test('owner, repo and one job → a grant', () => {
  expect(isGrant('o/r:detect')).toBe(true);
});

test('several comma-separated jobs → a grant', () => {
  expect(isGrant('three/c:x,y')).toBe(true);
});

test('no colon → not a grant, however much of a repo the rest looks like', () => {
  expect(isGrant('owner/repo')).toBe(false);
});

test('a leading colon → not a grant', () => {
  expect(isGrant(':detect')).toBe(false);
});

test('a repo without an owner → not a grant', () => {
  expect(isGrant('r:detect')).toBe(false);
});

test('a repo with an empty half → not a grant', () => {
  expect(isGrant('o/:detect')).toBe(false);
});

test('more than two path halves → not a grant', () => {
  expect(isGrant('o/r/x:detect')).toBe(false);
});

test('no jobs after the colon → not a grant', () => {
  expect(isGrant('o/r:')).toBe(false);
});

test('jobs that are only commas → not a grant', () => {
  expect(isGrant('o/r:,')).toBe(false);
});
