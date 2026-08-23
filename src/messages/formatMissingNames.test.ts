import { expect, test } from 'vitest';
import { formatMissingNames } from './formatMissingNames';

test('names the checks that never reported and rules out lateness', () => {
  const msg = formatMissingNames(['unit', 'spread (22)']);
  expect(msg).toContain('unit');
  expect(msg).toContain('spread (22)');
  expect(msg).toContain('Every predicted run finished');
});
