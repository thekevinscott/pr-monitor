/**
 * GitHub.com connects the top-level caller plus ten reusable levels below it.
 * The docs say nine; measured live, ten ran and eleven failed (willfire#342,
 * runs 36417316158 / 36417315398). A cross-repo hop costs the same one level
 * as a local one, and this bound is also what stops a `uses:` cycle.
 */
export const MAX_REUSABLE_DEPTH = 10;
