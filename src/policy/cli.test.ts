import { beforeEach, expect, test, vi, type Mock } from 'vitest';

// `./cli` reports at import so the module is the script entrypoint. Exit and the
// log have to be captured before that import runs, which is what vi.hoisted buys
// over a spy in beforeEach.
const { exit, logged } = vi.hoisted(() => {
  const lines: string[] = [];
  return {
    exit: vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never),
    log: vi.spyOn(console, 'log').mockImplementation((line: unknown) => {
      lines.push(String(line));
    }),
    logged: lines,
  };
});

vi.mock('node:fs/promises', async () => {
  const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
  return {
    ...actual,
    readdir: vi.fn(() => Promise.resolve([])),
    readFile: vi.fn(() => Promise.resolve('')),
  };
});

import { readdir, readFile } from 'node:fs/promises';
import { report } from './cli';

const readdirMock = readdir as unknown as Mock;
const readFileMock = readFile as unknown as Mock;

const dirent = (parentPath: string, name: string, file = true) => ({
  parentPath,
  name,
  isFile: () => file,
});

beforeEach(() => {
  vi.clearAllMocks();
  logged.length = 0;
});

test('reads every file under the root and prints what the audit found', async () => {
  readdirMock.mockResolvedValue([dirent('.github/workflows', 'test.yml')]);
  readFileMock.mockResolvedValue('jobs:\n  a:\n    steps:\n      - run: pnpm test\n');

  await report('.github');

  expect(readdirMock).toHaveBeenCalledWith('.github', { recursive: true, withFileTypes: true });
  expect(readFileMock).toHaveBeenCalledWith('.github/workflows/test.yml', 'utf8');
  expect(logged).toEqual(['Checked 1 files under .github/. No code in YAML.']);
  expect(exit).toHaveBeenCalledWith(0);
});

test('directories are not files to read', async () => {
  readdirMock.mockResolvedValue([
    dirent('.github', 'workflows', false),
    dirent('.github/workflows', 'test.yml'),
  ]);
  readFileMock.mockResolvedValue('jobs: {}\n');

  await report('.github');

  expect(readFileMock).toHaveBeenCalledTimes(1);
});

test('a finding leaves the process red', async () => {
  readdirMock.mockResolvedValue([dirent('.github/scripts', 'release.sh')]);
  readFileMock.mockResolvedValue('echo hi\n');

  await report('.github');

  expect(exit).toHaveBeenCalledWith(1);
  expect(logged[0]).toContain('::error file=.github/scripts/release.sh::');
});
