import { expect, test } from 'vitest';
import { willfireCliPath } from './willfireCliPath';

test('names the CLI sitting beside willfire’s library entry point', () => {
  expect(willfireCliPath()).toMatch(/[/\\]willfire[/\\]dist[/\\]cli\.js$/);
});

test('resolves against the installed package rather than this repo', () => {
  expect(willfireCliPath()).toContain('node_modules');
});
