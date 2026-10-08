Scratch PR pr-monitor#245, `probe/167-stack-child` into `probe/167-stack-base`,
which was open as pr-monitor#244 into `main`. The two were linked as GitHub
stack #247 with `gh stack link`, then the child got a second commit so its
`synchronize` dispatch happened in stacked mode. Recorded with both PRs open
and the base branch alive, then both closed unmerged.
