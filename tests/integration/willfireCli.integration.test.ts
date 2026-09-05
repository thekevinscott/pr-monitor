/**
 * Prediction goes through willfire's CLI rather than its library API (#68), so
 * the contract under test is the shipped binary's: the argv pr-monitor builds
 * has to be argv that binary accepts, and `--json` has to answer in the shape
 * the gate reads.
 */

import { expect, test } from 'vitest';
import { makePredictor } from '../../src/predict/makePredictor';
import { willfireCliPath } from '../../src/predict/willfireCliPath';

// An empty token fails willfire's first GitHub read, which keeps this offline.
// Reaching that failure is the assertion: every flag before it was accepted.
const offline = makePredictor(willfireCliPath(), '');

test('the argv pr-monitor builds gets past willfire’s own parser', async () => {
  await expect(offline('o/r', 5, {})).rejects.toThrow(/GH_TOKEN or GITHUB_TOKEN must be set/);
});

test('an event action and repeated resolver callbacks are accepted flags', async () => {
  await expect(
    offline('o/r', 5, { action: 'reopened', callbacks: ['echo {}', 'printf {}'] }),
  ).rejects.toThrow(/GH_TOKEN or GITHUB_TOKEN must be set/);
});

test('a flag willfire rejects surfaces its usage line rather than a guess', async () => {
  await expect(offline('', 5, {})).rejects.toThrow(/usage: predict --repo owner\/name --pr N/);
});
