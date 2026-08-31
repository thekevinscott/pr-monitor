import { basename, extname } from 'node:path';

/**
 * What a file under `.github/` is allowed to be.
 *
 * `code` is the failing verdict, and it is reached by allowlist rather than by
 * listing code extensions: the rule is itself phrased as an allowlist ("workflow
 * YAML and Actions config only"), and a denylist is only ever as complete as the
 * languages whoever wrote it thought of.
 */
export type GithubFileKind = 'yaml' | 'config' | 'code';

const YAML = new Set(['.yml', '.yaml']);

export function classifyGithubFile(path: string): GithubFileKind {
  if (YAML.has(extname(path))) return 'yaml';
  if (extname(path) === '.md' || basename(path) === 'CODEOWNERS') return 'config';
  return 'code';
}
