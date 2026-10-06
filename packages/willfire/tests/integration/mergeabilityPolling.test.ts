import { afterEach, expect, test, vi } from "vitest";
import { makeGithubClient } from "../../src/predict/makeGithubClient.js";

const params = { owner: "o", repo: "r", pull_number: 5 };
const requestUrl = "https://api.github.com/repos/o/r/pulls/5";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const stage = (mergeable: Array<boolean | null>, state = "open") => {
  const fetch = vi.fn(async (_url: URL) => {
    const value = mergeable.shift();
    if (value === undefined) throw new Error("unexpected extra getPull request");
    return new Response(JSON.stringify({ mergeable: value, state }));
  });
  vi.stubGlobal("fetch", fetch);
  vi.stubEnv("GH_TOKEN", "test-token");
  return fetch;
};

test("a transient unknown mergeability settles before a conflicting PR is returned", async () => {
  vi.useFakeTimers();
  const fetch = stage([null, null, false]);
  const response = makeGithubClient().getPull(params);
  await vi.runAllTimersAsync();

  expect((await response).mergeable).toBe(false);
  expect(fetch).toHaveBeenCalledTimes(3);
  for (const [url] of fetch.mock.calls) expect(String(url)).toBe(requestUrl);
});

test("an indefinitely unknown mergeability fails after a bounded number of reads", async () => {
  vi.useFakeTimers();
  const fetch = stage(Array(5).fill(null));
  const response = makeGithubClient().getPull(params);
  const outcome = response.then((value) => value, (error: unknown) => error);
  await vi.runAllTimersAsync();

  expect(await outcome).toBeInstanceOf(Error);
  expect(String(await outcome)).toMatch(/mergeab/i);
  expect(fetch).toHaveBeenCalledTimes(5);
});

test("a closed historical PR with null mergeability returns without polling", async () => {
  const fetch = stage([null], "closed");
  expect((await makeGithubClient().getPull(params)).mergeable).toBeNull();
  expect(fetch).toHaveBeenCalledTimes(1);
});
