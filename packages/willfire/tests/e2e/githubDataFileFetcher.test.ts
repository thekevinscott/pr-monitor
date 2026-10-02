import { expect, test } from "vitest";
import { makeGithubClient, willfire } from "willfire";
import { discoverCases } from "../cases.js";
import { getResponse } from "../getResponse.js";

const github = makeGithubClient();

const CASES = discoverCases(new URL("./responses/", import.meta.url));

test.each(CASES)(
  "$owner/$repo#$pr still predicts the committed list",
  async ({ owner, repo, pr, dir, action }) => {
    const expected = getResponse(dir);

    const { checkNames } = await willfire(github, `${owner}/${repo}`, pr, { action });

    expect(checkNames).toEqual(expected);
  },
);
