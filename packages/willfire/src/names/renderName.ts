import { evaluateValue } from "../expr/evaluateValue.js";
import type { Scope } from "../expr/val.js";
import { prScope } from "../jobs/prScope.js";
import { formatMatrixValue } from "../matrix/formatMatrixValue.js";
import type { Combo, Rendered } from "../types.js";

/**
 * Each `${{ }}` slot goes through the expression evaluator, not a prefix test.
 * `matrix.build && format(' {0}', matrix.build) || ''` starts with `matrix.`
 * but is not a path, and treating it as one left the whole name unresolved.
 *
 * `github` carries the prediction's seeded facts: probe #383 rendered
 * `github.ref` and a label `join` into check names.
 */
export function renderName(template: string, combo: Combo, github?: Scope["github"]): Rendered {
  let resolved = true;
  const scope = prScope({ github, matrix: combo ?? undefined });
  const text = template.replace(/\$\{\{(.*?)\}\}/g, (whole, inner) => {
    const val = evaluateValue(String(inner), scope);
    if (val.kind !== "value" && val.kind !== "json") {
      resolved = false;
      return whole;
    }
    return formatMatrixValue(val.v);
  });
  return { text, resolved };
}
