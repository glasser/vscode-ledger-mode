#!/usr/bin/env node

// Helper functions for transaction completion template
// Handles cursor position highlighting and syntax highlighting

export function highlightLedgerSyntax(
  text: string,
  cursorLine?: number,
  cursorColumn?: number,
  selectionStart?: { line: number; column: number },
  selectionEnd?: { line: number; column: number },
): string {
  if (!text) {
    return "";
  }

  const lines = text.split("\n");

  return lines
    .map((line, lineIndex) => {
      let processedLine = line
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

      // Add selection if this line is within the selection range
      if (
        selectionStart &&
        selectionEnd &&
        lineIndex >= selectionStart.line &&
        lineIndex <= selectionEnd.line
      ) {
        const startCol =
          lineIndex === selectionStart.line ? selectionStart.column : 0;
        const endCol =
          lineIndex === selectionEnd.line ? selectionEnd.column : line.length;

        if (startCol < endCol) {
          const beforeSelection = line
            .substring(0, startCol)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
          const selection = line
            .substring(startCol, endCol)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
          const afterSelection = line
            .substring(endCol)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
          processedLine =
            beforeSelection +
            '<span class="selection">' +
            selection +
            "</span>" +
            afterSelection;
        }
      }

      // Add cursor if this is the cursor line (only if no selection or cursor is outside selection)
      if (
        cursorLine !== undefined &&
        cursorColumn !== undefined &&
        lineIndex === cursorLine &&
        (!selectionStart ||
          !selectionEnd ||
          lineIndex < selectionStart.line ||
          lineIndex > selectionEnd.line ||
          (lineIndex === selectionStart.line &&
            cursorColumn < selectionStart.column) ||
          (lineIndex === selectionEnd.line &&
            cursorColumn > selectionEnd.column))
      ) {
        if (cursorColumn <= line.length) {
          const beforeCursor = line
            .substring(0, cursorColumn)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
          const afterCursor = line
            .substring(cursorColumn)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
          processedLine =
            beforeCursor + '<span class="cursor">|</span>' + afterCursor;
        }
      }

      // Apply syntax highlighting
      processedLine = applySyntaxHighlighting(processedLine);

      return processedLine;
    })
    .join("\n");
}

function applySyntaxHighlighting(line: string): string {
  // Skip if line already has cursor or selection markup to avoid double-processing
  if (line.includes('<span class="cursor">')) {
    return applySyntaxHighlightingWithCursor(line);
  }
  if (line.includes('<span class="selection">')) {
    return applySyntaxHighlightingWithSelection(line);
  }

  // Date highlighting (start of line)
  line = line.replace(
    /^(\d{4}[-/]\d{2}[-/]\d{2})/g,
    '<span class="date">$1</span>',
  );

  // Amount highlighting (dollar amounts)
  line = line.replace(/(\$[\d,.-]+)/g, '<span class="amount">$1</span>');

  // Account highlighting (only words with colons and that are indented)
  line = line.replace(
    /^(\s+)([A-Za-z][A-Za-z0-9:.\s]+?)(\s+)/g,
    (match, indent, account, space) => {
      if (account.includes(":")) {
        return indent + '<span class="account">' + account + "</span>" + space;
      }
      return match;
    },
  );

  // Comment highlighting
  line = line.replace(/(;.*$)/g, '<span class="comment">$1</span>');

  return line;
}

function applySyntaxHighlightingWithCursor(line: string): string {
  // Split at cursor, apply highlighting to each part, then rejoin
  const parts = line.split('<span class="cursor">|</span>');
  if (parts.length !== 2) {
    return applySyntaxHighlighting(line);
  }

  const beforeCursor = applySyntaxHighlighting(parts[0]);
  const afterCursor = applySyntaxHighlighting(parts[1]);

  return beforeCursor + '<span class="cursor">|</span>' + afterCursor;
}

function applySyntaxHighlightingWithSelection(line: string): string {
  // Split at selection, apply highlighting to each part, then rejoin
  const parts = line.split(/<span class="selection">(.*?)<\/span>/);
  if (parts.length !== 3) {
    return applySyntaxHighlighting(line);
  }

  const beforeSelection = applySyntaxHighlighting(parts[0]);
  const selection = parts[1];
  const afterSelection = applySyntaxHighlighting(parts[2]);

  return (
    beforeSelection +
    '<span class="selection">' +
    selection +
    "</span>" +
    afterSelection
  );
}
