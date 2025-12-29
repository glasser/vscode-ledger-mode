// Template helpers for reconcile-ledger-interface test preview generation
// Provides formatting functions for ledger file display

import * as Handlebars from "handlebars";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function numberLines(content: string): Handlebars.SafeString {
  if (!content) {
    return new Handlebars.SafeString("(no content)");
  }

  const lines = content.split("\n");
  const result = lines
    .map((line, idx) => {
      const lineNum = idx + 1;
      const numSpan = `<span style="color: #999; display: inline-block; width: 25px; text-align: right; margin-right: 10px; user-select: none;">${lineNum}</span>`;
      return `${numSpan}${escapeHtml(line)}`;
    })
    .join("\n");

  return new Handlebars.SafeString(result);
}

export function statusClass(status: string): string {
  if (status === "!") {
    return "status-pending";
  }
  if (status === "*") {
    return "status-cleared";
  }
  return "status-empty";
}
