// GitHub filter pattern glob. Grammar per docs: * (any chars except /),
// ** (any chars), **/ (zero or more directories), ? (zero or one of preceding
// char), + (one or more of preceding char), [ranges], leading ! negates.

export function patternToRegex(pat: string): RegExp {
  let out = "";
  for (let i = 0; i < pat.length; i++) {
    const c = pat[i];
    if (c === "*") {
      if (pat[i + 1] === "*") {
        if (pat[i + 2] === "/") {
          // `**/` is zero or more directories, so the separator is optional:
          // `**/*.txt` fires for a top-level file (probe run 36429114415).
          out += "(?:.*/)?";
          i += 2;
        } else {
          out += ".*";
          i++;
        }
      } else {
        out += "[^/]*";
      }
    } else if (c === "?" || c === "+") {
      out += c;
    } else if (c === "[") {
      const j = pat.indexOf("]", i + 1);
      out += pat.slice(i, j + 1);
      i = j;
    } else {
      // A backslash escapes the next character, which is then taken literally.
      const lit = c === "\\" ? pat[++i] : c;
      out += lit.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
  }
  return new RegExp(`^${out}$`);
}
