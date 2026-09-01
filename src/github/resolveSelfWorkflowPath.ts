const WORKFLOW_REF = /^[^/]+\/[^/]+\/(.+)@[^@]*$/;

export function resolveSelfWorkflowPath(ref: string | undefined): string | null {
  return WORKFLOW_REF.exec(ref ?? '')?.[1] ?? null;
}
