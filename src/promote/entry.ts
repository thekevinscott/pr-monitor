import { run } from './run';

export function exit(code: number): void {
  process.exit(code);
}

export function fail(err: unknown): void {
  console.log(`::error::${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}

run().then(exit).catch(fail);
