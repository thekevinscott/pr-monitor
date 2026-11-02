import { expect, test } from 'vitest';
import { transientServerError } from './transientServerError';

test.each([500, 502, 503, 504])('recognizes retryable status %i and Octokit endpoint', (status) => {
  expect(transientServerError({ status, message: 'Server Error', request: { url: '/runs/1/jobs' } }))
    .toEqual({ status, endpoint: '/runs/1/jobs' });
});

test('reads the endpoint from willfire errors and response URLs', () => {
  expect(transientServerError({ status: 503, message: 'GitHub API 503 for /repos/o/r/pulls/5' }))
    .toEqual({ status: 503, endpoint: '/repos/o/r/pulls/5' });
  expect(transientServerError({ status: 500, response: { url: '/actions/runs' } }))
    .toEqual({ status: 500, endpoint: '/actions/runs' });
  expect(transientServerError({ status: 500 })).toEqual({ status: 500, endpoint: 'unknown endpoint' });
  expect(transientServerError({ status: 503, message: 'prefix GitHub API 503 for /x' }))
    .toEqual({ status: 503, endpoint: 'unknown endpoint' });
  expect(transientServerError({ status: 503, message: 'GitHub API 503 for /x\nextra' }))
    .toEqual({ status: 503, endpoint: 'unknown endpoint' });
});

test.each([403, 404, 429, 501, undefined])('does not retry status %s', (status) => {
  expect(transientServerError({ status, request: { url: '/x' } })).toBeNull();
});

test('accepts a null thrown value without retrying', () => {
  expect(transientServerError(null)).toBeNull();
});
