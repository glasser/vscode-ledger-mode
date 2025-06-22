#!/usr/bin/env node

// Helper functions for ledger-cli template
// Ported from test/generators/ledger-cli.ts

import * as fs from 'fs';
import * as path from 'path';

// Provides ledger file reading, syntax highlighting, and error processing

// Port of the original highlightLedgerSyntax function
export function highlightLedgerSyntax(
  content: string,
  errorLines: number[] = [],
): string {
  // Split content into lines and add line numbers with highlighting
  const lines = content.split("\n");
  const numberedLines = lines.map((line, index) => {
    const lineNumber = index + 1; // 1-based line numbers
    const hasError = errorLines.includes(lineNumber);

    // Apply syntax highlighting to the line content
    let highlighted = line
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

    // Highlight comments (lines starting with ; # % | *)
    highlighted = highlighted.replace(
      /^([;#%|*].*)$/,
      '<span class="comment">$1</span>',
    );

    // Highlight dates (YYYY-MM-DD pattern)
    highlighted = highlighted.replace(
      /(\b\d{4}-\d{2}-\d{2}\b)/g,
      '<span class="date">$1</span>',
    );

    // Highlight amounts (currency symbols and numbers)
    highlighted = highlighted.replace(
      /(\$[\d,]+\.?\d*)/g,
      '<span class="amount">$1</span>',
    );

    // Highlight reconciliation markers (* and !)
    highlighted = highlighted.replace(
      /(\s[*!]\s)/g,
      '<span class="reconciliation">$1</span>',
    );

    // Highlight account names (indented lines that look like accounts)
    highlighted = highlighted.replace(
      /^(\s+)([A-Za-z][A-Za-z0-9:_-]+)/,
      '$1<span class="account">$2</span>',
    );

    // Highlight directives (account, payee, commodity, etc.)
    highlighted = highlighted.replace(
      /^(account|payee|commodity|year|tag|define|alias|bucket|P|D)\b/,
      '<span class="directive">$1</span>',
    );

    // Wrap the line content with line number and error highlighting if needed
    const lineNumberHtml = `<span class="line-number">${lineNumber.toString().padStart(3, " ")}</span>`;
    const lineClass = hasError ? " error-line" : "";

    return `<span class="line${lineClass}">${lineNumberHtml} ${highlighted}</span>`;
  });

  return numberedLines.join("");
}

// Helper to read ledger file content based on the file path in config
export function readLedgerFile(testCase: any): string {
  if (!testCase.file) {
    return '';
  }
  
  // The config files are in test/data/ledger-cli/ and reference ../../fixtures/file.ledger
  // So we need to resolve relative to the config file location  
  // Since we know the structure, resolve relative to test/data/ledger-cli
  const testDataDir = path.join(__dirname);
  const ledgerFilePath = path.resolve(testDataDir, testCase.file);
  
  if (fs.existsSync(ledgerFilePath)) {
    return fs.readFileSync(ledgerFilePath, 'utf8');
  }
  
  return `File not found: ${ledgerFilePath}`;
}

// Helper to get error lines from expectedErrors array
export function getErrorLines(expectedErrors: any[]): number[] {
  if (!Array.isArray(expectedErrors)) {
    return [];
  }
  
  return expectedErrors
    .map(error => error.line + 1) // Convert from 0-based to 1-based
    .filter(line => line !== undefined && typeof line === 'number');
}

