import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { expect, test } from 'vitest';
import { willfireCliPath } from './willfireCliPath';

const execFileAsync = promisify(execFile);

test('resolves the CLI willfire ships, not a path that merely looks right', async () => {
  // Its own usage line is the proof; a wrong or stale path could not print it.
  await expect(execFileAsync(process.execPath, [willfireCliPath()])).rejects.toMatchObject({
    code: 2,
    stderr: expect.stringContaining('usage: predict --repo owner/name --pr N'),
  });
});
