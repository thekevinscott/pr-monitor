import { parse } from 'yaml';
import { classifyGithubFile } from './classifyGithubFile';
import { collectRunScripts } from './collectRunScripts';
import { findRunLogic } from './findRunLogic';

export interface PolicyFile {
  path: string;
  text: string;
}

export interface PolicyReport {
  exitCode: number;
  lines: string[];
}

/**
 * The whole decision: what `.github/` holds, and whether any `run:` block in it
 * carries logic. Pure — parsing is the only work it does that a caller might
 * mistake for I/O, and it lives here so that unreadable YAML is a finding the
 * gate reports rather than a crash the caller has to interpret.
 */
export function audit(files: PolicyFile[]): PolicyReport {
  const errors = files.flatMap((file) => auditFile(file));
  return errors.length === 0
    ? { exitCode: 0, lines: [`Checked ${files.length} files under .github/. No code in YAML.`] }
    : { exitCode: 1, lines: errors };
}

function auditFile({ path, text }: PolicyFile): string[] {
  const kind = classifyGithubFile(path);
  if (kind === 'code') {
    return [
      `::error file=${path}::${path} is code under .github/, which holds workflow YAML and Actions config only. Move it into src/ and invoke it from the workflow.`,
    ];
  }
  if (kind === 'config') return [];
  let doc: unknown;
  try {
    doc = parse(text);
  } catch {
    return [`::error file=${path}::${path} is not parseable YAML.`];
  }
  return collectRunScripts(doc).flatMap((script) => {
    const reason = findRunLogic(script);
    return reason === undefined
      ? []
      : [
          `::error file=${path}::A run: block carries logic (${reason}). YAML is wiring: move the logic into src/ and invoke it as one command.`,
        ];
  });
}
