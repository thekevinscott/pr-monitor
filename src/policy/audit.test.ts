import { expect, test } from 'vitest';
import { audit } from './audit';

const workflow = (run: string) =>
  ['name: Tests', 'jobs:', '  test:', '    steps:', `      - run: ${run}`].join('\n');

test('a clean .github/ passes and says what it looked at', () => {
  const report = audit([
    { path: '.github/workflows/test.yml', text: workflow('pnpm test') },
    { path: '.github/CODEOWNERS', text: '* @thekevinscott\n' },
  ]);
  expect(report).toEqual({
    exitCode: 0,
    lines: ['Checked 2 files under .github/. No code in YAML.'],
  });
});

test('a source file under .github/ fails and names the move', () => {
  const report = audit([{ path: '.github/scripts/release.sh', text: 'echo hi\n' }]);
  expect(report.exitCode).toBe(1);
  expect(report.lines).toEqual([
    '::error file=.github/scripts/release.sh::.github/scripts/release.sh is code under .github/, which holds workflow YAML and Actions config only. Move it into src/ and invoke it from the workflow.',
  ]);
});

test('logic in a run: block fails and names the reason', () => {
  const report = audit([
    { path: '.github/workflows/tag.yml', text: workflow('git tag -f v1 && git push -f') },
  ]);
  expect(report.exitCode).toBe(1);
  expect(report.lines).toEqual([
    '::error file=.github/workflows/tag.yml::A run: block carries logic (shell operator `&`). YAML is wiring: move the logic into src/ and invoke it as one command.',
  ]);
});

test('every offending block in a file is reported, not just the first', () => {
  const text = [
    'jobs:',
    '  a:',
    '    steps:',
    '      - run: cat x | grep y',
    '      - run: pnpm test',
    '      - run: a; b',
  ].join('\n');
  const report = audit([{ path: '.github/workflows/a.yml', text }]);
  expect(report.lines).toHaveLength(2);
});

test('config files carry no run: blocks and are not parsed as YAML', () => {
  const report = audit([{ path: '.github/PULL_REQUEST_TEMPLATE.md', text: '# not: [yaml' }]);
  expect(report).toEqual({
    exitCode: 0,
    lines: ['Checked 1 files under .github/. No code in YAML.'],
  });
});

test('unparseable YAML fails rather than passing unread', () => {
  const report = audit([{ path: '.github/workflows/bad.yml', text: 'a:\n- b\n  c: [' }]);
  expect(report.exitCode).toBe(1);
  expect(report.lines).toEqual([
    '::error file=.github/workflows/bad.yml::.github/workflows/bad.yml is not parseable YAML.',
  ]);
});

test('nothing to check is not a failure', () => {
  expect(audit([])).toEqual({
    exitCode: 0,
    lines: ['Checked 0 files under .github/. No code in YAML.'],
  });
});
