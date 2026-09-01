import { run } from './run';

/** The only place the process exit code is set. */
export function exit(code: number): void {
  process.exit(code);
}

/** An unexpected throw is a red, never a quiet skip that leaves the tag stale. */
export function fail(err: unknown): void {
  console.log(`::error::${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}

run().then(exit).catch(fail);
