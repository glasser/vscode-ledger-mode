#!/usr/bin/env node

// Generator for toggle-reconciliation test data
// Creates HTML previews showing the input, cursor position, and expected output with highlighted changes

import * as fs from "fs";
import * as path from "path";

interface ToggleTestCase {
  name: string;
  title: string;
  input: string;
  expectedResults: Array<{
    lineNumber: number;
    fileName: string;
    content: string;
  }>;
}

function escapeHtml(text: string): string {
  const map: { [key: string]: string } = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

function highlightDifferences(
  input: string,
  expected: string,
  cursorLine: number,
): { inputHtml: string; expectedHtml: string } {
  const inputLines = input.split("\n");
  const expectedLines = expected.split("\n");

  // Find which lines changed
  const changedLines = new Set<number>();
  for (let i = 0; i < Math.max(inputLines.length, expectedLines.length); i++) {
    const inputLine = inputLines[i] || "";
    const expectedLine = expectedLines[i] || "";
    if (inputLine !== expectedLine) {
      changedLines.add(i);
    }
  }

  // Generate HTML with highlighting - let CSS handle line display
  const inputHtml = inputLines
    .map((line, index) => {
      const escaped = escapeHtml(line);
      if (index === cursorLine) {
        return `<span class="cursor-line">${escaped}</span>`;
      }
      return `<span class="normal-line">${escaped}</span>`;
    })
    .join("");

  const expectedHtml = expectedLines
    .map((line, index) => {
      const escaped = escapeHtml(line);
      if (changedLines.has(index)) {
        return `<span class="changed-line">${escaped}</span>`;
      }
      return `<span class="normal-line">${escaped}</span>`;
    })
    .join("");

  return { inputHtml, expectedHtml };
}

export function generateToggleReconciliationHTML(
  testDataDir: string,
  outputDir: string,
): { name: string; testCases: number; outputFile: string } {
  const testCases: ToggleTestCase[] = [];

  // Read all test case directories
  const dirs = fs
    .readdirSync(testDataDir, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name)
    .sort();

  for (const dir of dirs) {
    if (dir === "show-all.sh") {
      continue; // Skip shell script
    }

    const testCaseDir = path.join(testDataDir, dir);
    const inputFile = path.join(testCaseDir, "input.ledger");

    if (fs.existsSync(inputFile)) {
      const input = fs.readFileSync(inputFile, "utf8");
      const expectedFiles = fs
        .readdirSync(testCaseDir)
        .filter((f) => f.startsWith("expected-line") && f.endsWith(".ledger"))
        .sort();

      const expectedResults: any[] = [];

      for (const expectedFile of expectedFiles) {
        const match = expectedFile.match(/expected-line(\d+)\.ledger$/);
        if (match) {
          const lineNumber = parseInt(match[1]);
          const content = fs.readFileSync(
            path.join(testCaseDir, expectedFile),
            "utf8",
          );
          expectedResults.push({
            lineNumber,
            fileName: expectedFile,
            content,
          });
        }
      }

      testCases.push({
        name: dir,
        title: dir
          .replace(/-/g, " ")
          .replace(/\b\w/g, (l: string) => l.toUpperCase()),
        input,
        expectedResults,
      });
    }
  }

  const html = `<!DOCTYPE html>
<html>
<head>
    <title>Toggle Reconciliation Test Cases</title>
    <style>
        body { 
            font-family: Arial, sans-serif; 
            margin: 20px; 
            line-height: 1.4;
            background-color: #ffffff;
            color: #333333;
        }
        .test-case { 
            margin-bottom: 40px;
            border: 1px solid #ddd;
            border-radius: 8px;
            overflow: hidden;
        }
        .test-header {
            background-color: #f5f5f5;
            padding: 15px;
            border-bottom: 1px solid #ddd;
        }
        .test-title {
            font-size: 18px;
            font-weight: bold;
            margin: 0;
            color: #333;
        }
        .test-name {
            font-size: 12px;
            color: #666;
            margin: 5px 0 0 0;
            font-family: monospace;
        }
        .test-content {
            display: block;
        }
        .expected-column { 
            padding: 15px;
        }
        .column-header {
            font-weight: bold;
            margin-bottom: 10px;
            color: #666;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .content { 
            background-color: #f8f8f8; 
            padding: 12px; 
            border-radius: 4px; 
            border: 1px solid #e0e0e0;
            font-family: 'Courier New', monospace;
            font-size: 13px;
            line-height: 1.4;
            white-space: pre-wrap;
            margin: 0;
        }
        .expected-item {
            margin-bottom: 15px;
        }
        .expected-item:last-child {
            margin-bottom: 0;
        }
        .expected-name {
            font-weight: bold;
            color: #666;
            margin-bottom: 5px;
            font-size: 12px;
        }
        .cursor-line {
            background-color: #e3f2fd;
            display: block;
            margin: 0 -12px;
            padding: 0 12px;
            border-left: 3px solid #2196f3;
        }
        .changed-line {
            background-color: #e8f5e8;
            display: block;
            margin: 0 -12px;
            padding: 0 12px;
            border-left: 3px solid #4caf50;
            font-weight: bold;
        }
        .normal-line {
            display: block;
        }
        
        h1 {
            color: #333;
            border-bottom: 2px solid #0066cc;
            padding-bottom: 10px;
        }
        .summary {
            background-color: #e8f4f8;
            padding: 15px;
            border-radius: 6px;
            margin-bottom: 30px;
            border-left: 4px solid #0066cc;
        }
        .summary h2 {
            margin-top: 0;
            color: #0066cc;
        }
        .legend {
            background-color: #f9f9f9;
            padding: 10px;
            border-radius: 4px;
            margin-bottom: 10px;
            font-size: 12px;
        }
        .cursor-indicator { 
            background-color: #e3f2fd; 
            padding: 2px 4px; 
            border-radius: 2px; 
            border-left: 3px solid #2196f3;
        }
        .changed-indicator { 
            background-color: #e8f5e8; 
            padding: 2px 4px; 
            border-radius: 2px; 
            border-left: 3px solid #4caf50;
            font-weight: bold;
        }
    </style>
</head>
<body>
    <h1>Toggle Reconciliation Test Cases</h1>
    
    <div class="summary">
        <h2>What This Shows</h2>
        <p>Tests for the reconciliation toggle feature that adds/removes reconciliation markers (* and !) from transactions and postings.</p>
        <p><strong>Testing process:</strong></p>
        <ol>
            <li>Place cursor on a specific line (shown with blue highlighting)</li>
            <li>Execute the "Toggle Reconciliation" command</li>
            <li>Verify the output matches expected result (changed lines shown with green highlighting)</li>
        </ol>
        <div class="legend">
            <strong>Legend:</strong>
            <span class="cursor-indicator">Cursor position (line where toggle command is executed)</span> |
            <span class="changed-indicator">Changed lines (showing the toggle result)</span>
        </div>
        <p><strong>Test cases:</strong> ${testCases.length}</p>
    </div>

${testCases
  .map(
    (testCase) => `
    <div class="test-case ${testCase.expectedResults.length > 1 ? "multi-expected" : ""}">
        <div class="test-header">
            <h3 class="test-title">${testCase.title}</h3>
            <p class="test-name">test/data/toggle-reconciliation/${testCase.name}/</p>
        </div>
        <div class="test-content">
            <div class="expected-column">
                <div class="column-header">Test Results (by cursor line)</div>
                ${testCase.expectedResults
                  .map((expected: any) => {
                    const { inputHtml, expectedHtml } = highlightDifferences(
                      testCase.input,
                      expected.content,
                      expected.lineNumber,
                    );
                    return `
                    <div class="expected-item">
                        <div class="expected-name">Line ${expected.lineNumber} → ${expected.fileName}</div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
                            <div>
                                <div style="font-size: 11px; color: #666; margin-bottom: 5px;">Input (cursor position)</div>
                                <pre class="content" style="margin: 0; font-size: 11px;">${inputHtml}</pre>
                            </div>
                            <div>
                                <div style="font-size: 11px; color: #666; margin-bottom: 5px;">Expected (changes highlighted)</div>
                                <pre class="content" style="margin: 0; font-size: 11px;">${expectedHtml}</pre>
                            </div>
                        </div>
                    </div>
                  `;
                  })
                  .join("")}
            </div>
        </div>
    </div>
`,
  )
  .join("")}

</body>
</html>`;

  const outputFile = path.join(outputDir, "toggle-reconciliation.html");
  fs.writeFileSync(outputFile, html, "utf8");

  const totalTestCases = testCases.reduce(
    (sum, tc) => sum + tc.expectedResults.length,
    0,
  );
  return {
    name: "Toggle Reconciliation",
    testCases: totalTestCases,
    outputFile,
  };
}

if (require.main === module) {
  const testDataDir =
    process.argv[2] || path.join(__dirname, "../data/toggle-reconciliation");
  const outputDir = process.argv[3] || path.join(__dirname, "../preview");

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const result = generateToggleReconciliationHTML(testDataDir, outputDir);
  console.log(
    `Generated ${result.name}: ${result.testCases} test cases -> ${result.outputFile}`,
  );
}
