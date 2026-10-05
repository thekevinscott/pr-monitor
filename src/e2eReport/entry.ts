import { run } from './run';

export function fail(err: unknown): void {
  console.log(`::error::${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}

run().catch(fail);
