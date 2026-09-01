import { expect, test } from 'vitest';
import { block } from './block';

test('leaves the tag alone and fails the run, naming the reason as an error', () => {
  expect(block('v1 points off this history')).toEqual({
    move: false,
    exitCode: 1,
    lines: ['::error::v1 points off this history'],
  });
});
