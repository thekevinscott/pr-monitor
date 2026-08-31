import { expect, test } from 'vitest';
import { classifyGithubFile } from './classifyGithubFile';

test('workflow and action YAML is what .github/ is for', () => {
  expect(classifyGithubFile('.github/workflows/test.yml')).toBe('yaml');
  expect(classifyGithubFile('.github/actions/setup/action.yaml')).toBe('yaml');
});

test('templates and CODEOWNERS are Actions config, not code', () => {
  expect(classifyGithubFile('.github/ISSUE_TEMPLATE/bug.md')).toBe('config');
  expect(classifyGithubFile('.github/CODEOWNERS')).toBe('config');
});

test('a file merely ending in CODEOWNERS is not the config file', () => {
  expect(classifyGithubFile('.github/MYCODEOWNERS')).toBe('code');
});

test('anything else under .github/ is code, shim or not', () => {
  expect(classifyGithubFile('.github/scripts/release.sh')).toBe('code');
  expect(classifyGithubFile('.github/scripts/release.mjs')).toBe('code');
  expect(classifyGithubFile('.github/scripts/release.ts')).toBe('code');
  expect(classifyGithubFile('.github/scripts/release.py')).toBe('code');
});
