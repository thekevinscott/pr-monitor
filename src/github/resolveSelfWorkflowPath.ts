// `owner/repo/.github/workflows/gate.yml@refs/pull/5/merge` → the path in the middle.
const WORKFLOW_REF = /^[^/]+\/[^/]+\/(.+)@[^@]*$/;

/**
 * The workflow file this gate is running from, read from `GITHUB_WORKFLOW_REF`.
 * Available before any API call, so the expected set can be built up front.
 * Returns null when the variable is absent or malformed.
 */
export function resolveSelfWorkflowPath(ref: string | undefined): string | null {
  return WORKFLOW_REF.exec(ref ?? '')?.[1] ?? null;
}
