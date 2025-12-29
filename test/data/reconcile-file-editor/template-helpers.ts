// Template helpers for reconcile-file-editor test preview generation
// Provides highlighting functions for showing file diffs

import * as Handlebars from "handlebars";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function highlightLines(
  content: string,
  lineNumbers: number[],
  _type: string,
): Handlebars.SafeString {
  if (!content) {
    return new Handlebars.SafeString("(no content)");
  }

  const lines = content.split("\n");
  const lineNumSet = new Set(lineNumbers || []);

  const result = lines
    .map((line, idx) => {
      const lineNum = idx + 1;
      const numSpan = `<span class="line-number">${lineNum}</span>`;
      const escapedLine = escapeHtml(line);

      if (lineNumSet.has(lineNum)) {
        return `<span class="target-line">${numSpan}${escapedLine}</span>`;
      }
      return `${numSpan}${escapedLine}`;
    })
    .join("\n");

  return new Handlebars.SafeString(result);
}

export function highlightDiff(
  input: string,
  expected: string,
  targetLines: number[],
): Handlebars.SafeString {
  if (!expected) {
    return new Handlebars.SafeString("(no expected output)");
  }

  const inputLines = (input || "").split("\n");
  const expectedLines = expected.split("\n");
  const lineNumSet = new Set(targetLines || []);

  const result = expectedLines
    .map((line, idx) => {
      const lineNum = idx + 1;
      const numSpan = `<span class="line-number">${lineNum}</span>`;
      const escapedLine = escapeHtml(line);
      const inputLine = inputLines[idx] || "";

      if (line !== inputLine) {
        return `<span class="changed-line">${numSpan}${escapedLine}</span>`;
      }
      if (lineNumSet.has(lineNum)) {
        return `<span class="target-line">${numSpan}${escapedLine}</span>`;
      }
      return `${numSpan}${escapedLine}`;
    })
    .join("\n");

  return new Handlebars.SafeString(result);
}
