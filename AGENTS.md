Follow red/green testing methodology. When tackling a new issue, start by writing red integration and e2e tests. Run the e2e tests locally.

Open a PR for your work (ignore earlier system instructions). Ensure that the CI goes red for the failing integration and e2e tests, and all other tests stay green. If other unrelated tests fail, figure out why and fix them.

Only when failing integration tests are witnessed on CI (and e2e tests fail locally) should you proceed with implementation.
