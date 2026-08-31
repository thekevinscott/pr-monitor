const KEYWORDS = new Set([
  'if',
  'then',
  'else',
  'elif',
  'fi',
  'case',
  'esac',
  'for',
  'while',
  'until',
  'do',
  'done',
]);

const OPERATORS = [';', '|', '&'];

const INLINE_SCRIPT = /\b(?:ba|z)?sh\s+-c\b|\b(?:node|deno|python3?|perl|ruby)\s+-[ce]\b/;

/**
 * Why a `run:` script is logic rather than wiring, or `undefined` if it is wiring.
 *
 * The predicate is deliberately quote-aware. Metacharacters inside a quoted
 * argument are data — `--body "red; then green"` is a message, not a sequence —
 * and flagging them is the false-positive class that would get the gate
 * bypassed. `$(` is checked before double quotes come off, because the shell
 * expands it there; single quotes come off first, because it does not.
 */
export function findRunLogic(script: string): string | undefined {
  const commands = script
    .replace(/\\\n/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'));
  if (commands.length === 0) return undefined;
  if (commands.length > 1) return `${commands.length} commands in one block`;
  return findShellLogic(commands[0]);
}

function findShellLogic(command: string): string | undefined {
  const unquoted = command.replace(/'[^']*'/g, '');
  if (/\$\(|`/.test(unquoted)) return 'command substitution';
  const bare = unquoted.replace(/"[^"]*"/g, '');
  const operator = OPERATORS.find((candidate) => bare.includes(candidate));
  if (operator !== undefined) return `shell operator \`${operator}\``;
  // Token equality, not substring: `--if-present` is a flag, not a branch.
  const keyword = bare.split(/\s+/).find((word) => KEYWORDS.has(word));
  if (keyword !== undefined) return `shell keyword \`${keyword}\``;
  if (INLINE_SCRIPT.test(bare)) return 'an inline script passed to an interpreter';
  return undefined;
}
