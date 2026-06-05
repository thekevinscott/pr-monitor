import { expect, test } from 'vitest';
import { resolveCommitSha } from './resolveCommitSha';
import type { GitHubContextType } from '../types';

function ctx(payload: Record<string, unknown>, sha: string): GitHubContextType {
  return { payload, sha, repo: { owner: 'o', repo: 'r' } } as unknown as GitHubContextType;
}

test('uses pull_request head sha when present', () => {
  expect(resolveCommitSha(ctx({ pull_request: { head: { sha: 'pr-sha' } } }, 'merge-sha'))).toBe('pr-sha');
});

test('falls back to context.sha when pull_request absent', () => {
  expect(resolveCommitSha(ctx({}, 'push-sha'))).toBe('push-sha');
});

test('falls back when pull_request lacks head', () => {
  expect(resolveCommitSha(ctx({ pull_request: {} }, 'fallback'))).toBe('fallback');
});

test('falls back when head lacks sha', () => {
  expect(resolveCommitSha(ctx({ pull_request: { head: {} } }, 'fallback'))).toBe('fallback');
});
