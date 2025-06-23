#!/usr/bin/env node

// Helper functions for nowMarker template
// Ported from test/generators/nowMarker.ts

import * as fs from "fs";
import * as path from "path";

// Loads ledger files and highlights expected cursor positions

export interface NowMarkerFile {
  filename: string;
  content: string;
  expectedLine: number | null;
  testName: string;
  highlightedContent: string;
}

export function loadNowMarkerFiles(): NowMarkerFile[] {
  const testDataDir = __dirname;
  const files = fs
    .readdirSync(testDataDir)
    .filter((f) => f.endsWith(".ledger"))
    .sort();

  return files.map((file) => {
    const content = fs.readFileSync(path.join(testDataDir, file), "utf8");

    // Extract expected line number from filename
    const match = file.match(/^(\S+)-to-line-(\d+)\.ledger$/);
    const expectedLine = match ? parseInt(match[2]) : null;
    const testName = match ? match[1].replace(/-/g, " ") : file;

    // Split content into lines and highlight the expected line
    const lines = content.split("\n");
    const highlightedContent = lines
      .map((line, index) => {
        const lineNumber = index + 1; // Convert to 1-based
        const escaped = line
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");

        if (expectedLine && lineNumber === expectedLine) {
          // For blank lines, show a visible placeholder
          const displayContent =
            escaped.trim() === "" ? "⌐ (expected cursor position)" : escaped;
          return `<span class="highlighted-line">${displayContent}</span>`;
        }
        return `<span class="normal-line">${escaped}</span>`;
      })
      .join("");

    return {
      filename: file,
      content,
      expectedLine,
      testName,
      highlightedContent,
    };
  });
}
