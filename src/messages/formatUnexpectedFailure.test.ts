import { expect, test } from 'vitest';
import { formatUnexpectedFailure } from './formatUnexpectedFailure';

test('names the unpredicted runs and why that is fatal', () => {
  const msg = formatUnexpectedFailure(['.github/workflows/surprise.yml']);
  expect(msg).toContain('.github/workflows/surprise.yml');
  expect(msg).toContain('willfire did not predict them');
});
