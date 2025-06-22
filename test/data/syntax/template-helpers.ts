#!/usr/bin/env node

// Helper functions for syntax template
// Provides syntax highlighting for ledger test files

export function highlightSyntaxForLedger(content: string): string {
  // Simple syntax highlighting for ledger files - matches original generator exactly
  let html = content
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  // Highlight comments (lines starting with ;)
  html = html.replace(/^(;.*)$/gm, '<span class="comment">$1</span>');

  // Highlight dates (YYYY-MM-DD pattern)
  html = html.replace(
    /(\b\d{4}-\d{2}-\d{2}\b)/g,
    '<span class="date">$1</span>',
  );

  // Highlight amounts (currency symbols and numbers)
  html = html.replace(/(\$[\d,]+\.?\d*)/g, '<span class="amount">$1</span>');

  // Highlight reconciliation markers (* and !)
  html = html.replace(/(\s[*!]\s)/g, '<span class="reconciliation">$1</span>');

  // Highlight account names (indented lines that look like accounts)
  html = html.replace(
    /^(\s+)([A-Za-z][A-Za-z0-9:_-]+)/gm,
    '$1<span class="account">$2</span>',
  );

  return html;
}