import { expect, test } from 'vitest';
import { requireEnv } from './requireEnv';

test('returns the value when it is set', () => {
  expect(requireEnv('PROMOTE_TAG', 'v1')).toBe('v1');
});

test('throws naming the variable when it is unset', () => {
  expect(() => requireEnv('PROMOTE_TAG', undefined)).toThrow('PROMOTE_TAG is required');
});

test('an empty value is as absent as no value', () => {
  expect(() => requireEnv('PROMOTE_SHA', '')).toThrow('PROMOTE_SHA is required');
});
