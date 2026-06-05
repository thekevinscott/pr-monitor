import type { GitHubContextType } from './types';

export function resolveCommitSha(context: GitHubContextType): string {
  const prSha = context.payload.pull_request?.head?.sha;
  if (typeof prSha === 'string') return prSha;
  return context.sha;
}
