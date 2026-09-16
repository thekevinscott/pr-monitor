import { expect, test } from 'vitest';
import { isStalled } from './isStalled';
import type { GateComparison } from '../types';

function comparison(over: Partial<GateComparison> = {}): GateComparison {
  return {
    unexpected: [],
    unexpectedNames: [],
    missing: [],
    missingNames: [],
    matchedNames: [],
    matched: [],
    inProgress: [],
    nonPassing: [],
    ...over,
  };
}

test('a missing run with nothing still going is a stall', () => {
  expect(isStalled(comparison({ missing: ['a.yml'] }))).toBe(true);
});

test('a missing run is not a stall while another is still going', () => {
  expect(isStalled(comparison({ missing: ['a.yml'], inProgress: ['b.yml'] }))).toBe(false);
});

test('nothing missing is not a stall, however quiet', () => {
  expect(isStalled(comparison({ matched: ['a.yml'] }))).toBe(false);
});
