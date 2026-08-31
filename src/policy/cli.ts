import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { audit } from './audit';

/**
 * Composition root: read the tree, print what `audit` decided, exit on its code.
 * Every judgement — including which files are worth reading — belongs to `audit`,
 * so this reads all of them. Exported so the wiring is tested; the call below
 * makes the module the script entrypoint.
 */
export async function report(root: string): Promise<void> {
  const entries = await readdir(root, { recursive: true, withFileTypes: true });
  const files = await Promise.all(
    entries
      .filter((entry) => entry.isFile())
      .map(async (entry) => {
        const path = join(entry.parentPath, entry.name);
        return { path, text: await readFile(path, 'utf8') };
      }),
  );
  const { exitCode, lines } = audit(files);
  for (const line of lines) console.log(line);
  process.exit(exitCode);
}

await report('.github');
