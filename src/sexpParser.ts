// S-expression parser for parsing ledger emacs command output
// Converts S-expressions to JavaScript values (arrays, strings, numbers, null)

export type SExpValue = string | number | null | SExpValue[];

export class SExpParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SExpParseError";
  }
}

export class SExpParser {
  private truncateForError(text: string, maxLength: number = 20): string {
    if (text.length <= maxLength) {
      return text;
    }
    return text.slice(0, maxLength) + "...";
  }

  parse(s: string): SExpValue {
    s = s.trim();
    if (!s) {
      return null;
    }

    if (s[0] === '"') {
      const [result, consumed] = this.parseQuotedString(s);
      const remaining = s.slice(consumed).trim();
      if (remaining) {
        throw new SExpParseError(
          `Unexpected content after string: ${this.truncateForError(remaining)}`,
        );
      }
      return result;
    }

    if (s[0] !== "(") {
      // For atoms, the entire string should be the atom
      const [result, consumed] = this.parseAtom(s);
      const remaining = s.slice(consumed).trim();
      if (remaining) {
        throw new SExpParseError(
          `Unexpected content after atom: ${this.truncateForError(remaining)}`,
        );
      }
      return result;
    }

    // Parse the list and get how much was consumed
    const [result, consumed] = this.parseList(s);
    const remaining = s.slice(consumed).trim();
    if (remaining) {
      throw new SExpParseError(
        `Unexpected content after list: ${this.truncateForError(remaining)}`,
      );
    }
    return result;
  }

  private parseQuotedString(s: string): [string, number] {
    if (!s.startsWith('"')) {
      throw new SExpParseError(
        `Expected quoted string to start with quote, got: ${s.slice(0, 10)}`,
      );
    }

    const result: string[] = [];
    let i = 1;
    while (i < s.length && s[i] !== '"') {
      if (s[i] === "\\" && i + 1 < s.length) {
        // Handle escape sequences
        const nextChar = s[i + 1];
        if (nextChar === '"') {
          result.push('"');
        } else if (nextChar === "\\") {
          result.push("\\");
        } else if (nextChar === "n") {
          result.push("\n");
        } else if (nextChar === "t") {
          result.push("\t");
        } else if (nextChar === "r") {
          result.push("\r");
        } else {
          // Unknown escape, keep the character
          result.push(nextChar);
        }
        i += 2;
      } else {
        result.push(s[i]);
        i += 1;
      }
    }

    if (i >= s.length) {
      throw new SExpParseError(`Unterminated quoted string: ${s}`);
    }

    return [result.join(""), i + 1]; // +1 for the closing quote
  }

  private parseAtom(s: string): [string | number | null, number] {
    let i = 0;
    while (i < s.length && !/\s/.test(s[i]) && s[i] !== "(" && s[i] !== ")") {
      i += 1;
    }

    const atomStr = s.slice(0, i);
    if (atomStr === "nil") {
      return [null, i];
    }
    if (/^-?\d+$/.test(atomStr)) {
      return [parseInt(atomStr, 10), i];
    }
    return [atomStr, i];
  }

  private parseList(s: string): [SExpValue[], number] {
    if (!s.startsWith("(")) {
      throw new SExpParseError(
        "Expected list to start with opening parenthesis",
      );
    }

    const elements: SExpValue[] = [];
    let i = 1; // skip opening paren

    while (i < s.length) {
      if (/\s/.test(s[i])) {
        i += 1;
        continue;
      }

      if (s[i] === ")") {
        // Found the closing paren for this list
        i += 1; // consume the closing paren
        return [elements, i];
      }

      if (s[i] === '"') {
        // String element
        const [result, consumed] = this.parseQuotedString(s.slice(i));
        elements.push(result);
        i += consumed;
      } else if (s[i] === "(") {
        // Nested list element
        const [result, consumed] = this.parseList(s.slice(i));
        elements.push(result);
        i += consumed;
      } else {
        // Atom element
        const [result, consumed] = this.parseAtom(s.slice(i));
        elements.push(result);
        i += consumed;
      }
    }

    // If we reach here, we ran out of characters without finding a closing paren
    throw new SExpParseError("Unclosed list - missing closing parenthesis");
  }
}
