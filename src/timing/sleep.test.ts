import { expect, test } from 'vitest';
import { sleep } from './sleep';

test('sleep(0) resolves', async () => {
  await expect(sleep(0)).resolves.toBeUndefined();
});

test('sleep(20) waits at least ~15ms', async () => {
  const start = Date.now();
  await sleep(20);
  expect(Date.now() - start).toBeGreaterThanOrEqual(15);
});
