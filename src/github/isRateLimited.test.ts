import { expect, test } from 'vitest';
import { isRateLimited } from './isRateLimited';

test('a string is not rate-limited', () => {
  expect(isRateLimited('403')).toBe(false);
});

test('null is not rate-limited', () => {
  expect(isRateLimited(null)).toBe(false);
});

test('an object with no status is not rate-limited', () => {
  expect(isRateLimited({})).toBe(false);
});

test('a status of the wrong type is not rate-limited', () => {
  expect(isRateLimited({ status: '403', response: { headers: { 'retry-after': '30' } } })).toBe(
    false,
  );
});

test('a non-rate-limit 403 with no response is not rate-limited', () => {
  expect(isRateLimited({ status: 403 })).toBe(false);
});

test('a 500 with rate-limit-shaped headers is not rate-limited', () => {
  expect(isRateLimited({ status: 500, response: { headers: { 'retry-after': '30' } } })).toBe(
    false,
  );
});

test('a 403 with a null response is not rate-limited', () => {
  expect(isRateLimited({ status: 403, response: null })).toBe(false);
});

test('a 403 with a response but no headers is not rate-limited', () => {
  expect(isRateLimited({ status: 403, response: {} })).toBe(false);
});

test('a 403 with null headers is not rate-limited', () => {
  expect(isRateLimited({ status: 403, response: { headers: null } })).toBe(false);
});

test('a 403 with headers but no rate-limit evidence is not rate-limited', () => {
  expect(isRateLimited({ status: 403, response: { headers: {} } })).toBe(false);
});

test('a 403 with remaining quota left is not rate-limited', () => {
  expect(
    isRateLimited({ status: 403, response: { headers: { 'x-ratelimit-remaining': '10' } } }),
  ).toBe(false);
});

test('a 403 with retry-after present is rate-limited', () => {
  expect(
    isRateLimited({ status: 403, response: { headers: { 'retry-after': '30' } } }),
  ).toBe(true);
});

test('a 429 with retry-after present is rate-limited', () => {
  expect(
    isRateLimited({ status: 429, response: { headers: { 'retry-after': '30' } } }),
  ).toBe(true);
});

test('a 403 with x-ratelimit-remaining of 0 is rate-limited', () => {
  expect(
    isRateLimited({ status: 403, response: { headers: { 'x-ratelimit-remaining': '0' } } }),
  ).toBe(true);
});
