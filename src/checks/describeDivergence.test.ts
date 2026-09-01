import { expect, test } from 'vitest';
import { describeDivergence } from './describeDivergence';
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

test('an agreeing set is not divergence', () => {
  expect(describeDivergence(comparison({ matchedNames: ['unit'] }))).toBeNull();
});

test('an unpredicted run is divergence', () => {
  expect(describeDivergence(comparison({ unexpected: ['a.yml'] }))).toContain('a.yml');
});

test('an unpredicted check name is divergence', () => {
  expect(describeDivergence(comparison({ unexpectedNames: ['a.yml :: rogue'] }))).toContain('rogue');
});

test('an unpredicted run outranks a predicted name that never reported', () => {
  expect(
    describeDivergence(comparison({ unexpected: ['a.yml'], missingNames: ['unit'] })),
  ).toContain('a.yml');
});

test('a predicted name that never reported is divergence once everything finished', () => {
  expect(describeDivergence(comparison({ missingNames: ['unit'] }))).toContain('unit');
});

test('a predicted name is not missing while a predicted run has yet to register', () => {
  expect(describeDivergence(comparison({ missingNames: ['unit'], missing: ['a.yml'] }))).toBeNull();
});

test('a predicted name is not missing while a run is still going', () => {
  expect(
    describeDivergence(comparison({ missingNames: ['unit'], inProgress: ['a.yml'] })),
  ).toBeNull();
});

test('a failed run suppresses the missing names it caused', () => {
  expect(
    describeDivergence(comparison({ missingNames: ['unit'], nonPassing: ['a.yml (failure)'] })),
  ).toBeNull();
});
