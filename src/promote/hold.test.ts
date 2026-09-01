import { expect, test } from 'vitest';
import { hold } from './hold';

test('leaves the tag alone and succeeds, so a held tag is not a failure', () => {
  expect(hold('still running: Lint')).toEqual({
    move: false,
    exitCode: 0,
    lines: ['::notice::still running: Lint'],
  });
});
