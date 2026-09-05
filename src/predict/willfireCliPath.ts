import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

/**
 * willfire's `exports` map publishes no package.json and its `bin` is a shell
 * shim, so the library entry point is the only resolvable anchor for the CLI
 * sitting beside it.
 */
export function willfireCliPath(): string {
  return join(dirname(createRequire(import.meta.url).resolve('willfire')), 'cli.js');
}
