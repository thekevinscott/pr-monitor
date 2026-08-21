import { expect, test } from 'vitest';
import { formatUnresolvedFailure } from './formatUnresolvedFailure';

test('names the entries willfire could not resolve and what to do about it', () => {
  const msg = formatUnresolvedFailure(['a.yml :: test (dynamic matrix)']);
  expect(msg).toContain('a.yml :: test (dynamic matrix)');
  expect(msg).toContain('the predicted set is incomplete');
  expect(msg).toContain('teach willfire');
});
