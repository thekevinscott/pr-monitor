import { expect, test } from 'vitest';
import { findRunLogic } from './findRunLogic';

test('one command with arguments is wiring, not logic', () => {
  expect(findRunLogic('pnpm install --frozen-lockfile')).toBeUndefined();
  expect(findRunLogic('"$RUNNER_TEMP/actionlint" -color')).toBeUndefined();
});

test('a command wrapped across lines with backslashes is still one command', () => {
  expect(findRunLogic('pnpm exec tsc \\\n  --noEmit \\\n  -p tsconfig.json')).toBeUndefined();
});

test('blank lines and comments are not commands', () => {
  expect(findRunLogic('\n# set the version\npnpm run promote\n')).toBeUndefined();
  expect(findRunLogic('   \n\n')).toBeUndefined();
});

test('a second command makes the block a script', () => {
  expect(findRunLogic('git tag -f v1\ngit push origin -f v1')).toBe('2 commands in one block');
});

test('command substitution computes, so it is logic', () => {
  expect(findRunLogic('echo "sha=$(git rev-parse HEAD)" >> "$GITHUB_OUTPUT"')).toBe(
    'command substitution',
  );
  expect(findRunLogic('echo `date`')).toBe('command substitution');
});

test('single quotes make a substitution inert, so it stays wiring', () => {
  expect(findRunLogic("echo 'literal $(not a call)'")).toBeUndefined();
});

test('sequencing and pipes are logic', () => {
  expect(findRunLogic('pnpm build; pnpm test')).toBe('shell operator `;`');
  expect(findRunLogic('cat log | grep FAIL')).toBe('shell operator `|`');
  expect(findRunLogic('pnpm build && pnpm test')).toBe('shell operator `&`');
});

test('control flow is logic even without an operator on the line', () => {
  expect(findRunLogic('while read line')).toBe('shell keyword `while`');
  expect(findRunLogic('case "$RUNNER_OS" in')).toBe('shell keyword `case`');
});

test('a keyword inside a flag is not a keyword', () => {
  expect(findRunLogic('pnpm run --if-present build')).toBeUndefined();
});

test('a script smuggled into an interpreter flag is still a script', () => {
  expect(findRunLogic('bash -c "cd src; pnpm test"')).toBe(
    'an inline script passed to an interpreter',
  );
  expect(findRunLogic('node -e "process.exit(1)"')).toBe(
    'an inline script passed to an interpreter',
  );
});

test('an interpreter running a checked-in file is a normal invocation', () => {
  expect(findRunLogic('node scripts/release.js')).toBeUndefined();
  expect(findRunLogic('python -m pytest')).toBeUndefined();
});

test('metacharacters inside a quoted argument are data', () => {
  expect(findRunLogic('gh pr comment --body "red; then green"')).toBeUndefined();
});

test('redirecting into a GitHub env file is wiring', () => {
  expect(findRunLogic('echo "version=1" >> "$GITHUB_OUTPUT"')).toBeUndefined();
});
