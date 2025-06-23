#!/usr/bin/env node

// Helper functions for completion-provider template
// Ported from test/generators/completion-provider.ts

import * as yaml from "js-yaml";

// Provides ledger syntax highlighting, YAML formatting, and test organization

export function highlightLedgerSyntax(
  content: string,
  cursorLine?: number,
  cursorColumn?: number,
): string {
  // Simple syntax highlighting for ledger content with cursor positioning
  let highlighted = content
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  // Insert cursor marker if position is provided
  if (cursorLine !== undefined && cursorColumn !== undefined) {
    const lines = highlighted.split("\n");
    if (cursorLine < lines.length) {
      const line = lines[cursorLine];
      if (cursorColumn <= line.length) {
        // Insert cursor marker at the specified position
        const before = line.substring(0, cursorColumn);
        const after = line.substring(cursorColumn);
        lines[cursorLine] = before + '<span class="cursor">|</span>' + after;
        highlighted = lines.join("\n");
      }
    }
  }

  // Highlight dates
  highlighted = highlighted.replace(
    /(\d{4}[/-]\d{2}[/-]\d{2})/g,
    '<span class="date">$1</span>',
  );

  // Highlight amounts
  highlighted = highlighted.replace(
    /(\$[\d,]+\.?\d*)/g,
    '<span class="amount">$1</span>',
  );

  // Highlight accounts (lines starting with spaces followed by account names)
  highlighted = highlighted.replace(
    /^(\s+)([A-Za-z][A-Za-z0-9:]*)/gm,
    '$1<span class="account">$2</span>',
  );

  // Highlight comments
  highlighted = highlighted.replace(
    /(;.*$)/gm,
    '<span class="comment">$1</span>',
  );

  return highlighted;
}

export function formatYamlConfig(config: any): string {
  if (!config) {
    return "";
  }
  return yaml.dump(config, {
    quotingType: '"',
    forceQuotes: false,
    lineWidth: -1,
  });
}

// Helper to get negative assertions as an array for template use
export function getNegativeAssertions(testCase: any): string[] {
  const assertions: string[] = [];
  if (testCase.config?.noPayeeCompletions) {
    assertions.push("No payee completions expected");
  }
  if (testCase.config?.noAccountCompletions) {
    assertions.push("No account completions expected");
  }
  return assertions;
}

export function generateToc(testCases: any[]): string {
  if (!Array.isArray(testCases)) {
    return "";
  }

  const grouped = testCases.reduce(
    (acc: { [key: string]: any[] }, testCase) => {
      const category = testCase.name.split("-")[0];
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(testCase);
      return acc;
    },
    {},
  );

  return Object.entries(grouped)
    .map(
      ([category, cases]) => `
    <div class="toc-category">
      <h3>${category.charAt(0).toUpperCase() + category.slice(1)} Tests</h3>
      <ul>
        ${(cases as any[])
          .map(
            (testCase) =>
              `<li><a href="#${testCase.name}">${testCase.name}</a> - ${(
                testCase.config?.description || "No description"
              )
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;")}</li>`,
          )
          .join("")}
      </ul>
    </div>
  `,
    )
    .join("");
}
