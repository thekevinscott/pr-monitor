import { expect, test } from 'vitest';
import { advance } from './advance';

test('moves the tag, succeeds, and notices the message', () => {
  expect(advance('v1 → abc123')).toEqual({
    move: true,
    exitCode: 0,
    lines: ['::notice::v1 → abc123'],
  });
});
