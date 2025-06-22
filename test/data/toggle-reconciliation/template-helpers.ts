#!/usr/bin/env node

// Helper functions for toggle-reconciliation template
// Provides difference highlighting for input vs expected content

export function gt(a: number, b: number): string {
  return a > b ? 'multi-expected' : '';
}

export function getExpectedResults(testCase: any): Array<{lineNumber: number, fileName: string, content: string}> {
  const results: Array<{lineNumber: number, fileName: string, content: string}> = [];
  
  // Look for properties that match expected-line{number} pattern
  for (const key in testCase) {
    const match = key.match(/^expected-line(\d+)$/);
    if (match) {
      const lineNumber = parseInt(match[1], 10);
      const fileName = `${key}.ledger`;
      const content = testCase[key];
      
      results.push({
        lineNumber,
        fileName,
        content
      });
    }
  }
  
  // Sort by line number
  results.sort((a, b) => a.lineNumber - b.lineNumber);
  
  return results;
}

export function highlightDifferences(
  input: string,
  expected: string,
  cursorLine: number,
  mode: string
): string {
  const inputLines = input.split('\n');
  const expectedLines = expected.split('\n');

  // Find which lines changed
  const changedLines = new Set<number>();
  for (let i = 0; i < Math.max(inputLines.length, expectedLines.length); i++) {
    const inputLine = inputLines[i] || '';
    const expectedLine = expectedLines[i] || '';
    if (inputLine !== expectedLine) {
      changedLines.add(i);
    }
  }

  if (mode === 'input') {
    // Generate HTML with highlighting for input - let CSS handle line display
    return inputLines
      .map((line, index) => {
        const escaped = line
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");
        if (index === cursorLine) {
          return `<span class="cursor-line">${escaped}</span>`;
        }
        return `<span class="normal-line">${escaped}</span>`;
      })
      .join('');
  } else {
    // Generate HTML with highlighting for expected
    return expectedLines
      .map((line, index) => {
        const escaped = line
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");
        if (changedLines.has(index)) {
          return `<span class="changed-line">${escaped}</span>`;
        }
        return `<span class="normal-line">${escaped}</span>`;
      })
      .join('');
  }
}