#!/usr/bin/env node

// Generator for transaction completion test data
// Creates HTML previews showing input, expected output, and configuration

import * as fs from "fs";
import * as path from "path";

interface TestCase {
  name: string;
  title: string;
  input: string;
  expected: string;
  config: any;
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

function highlightLedgerSyntax(
  content: string,
  cursorLine?: number,
  cursorColumn?: number,
): string {
  // Insert cursor marker BEFORE applying syntax highlighting to avoid position shifts
  let processedContent = content;

  if (cursorLine !== undefined && cursorColumn !== undefined) {
    const lines = content.split("\n");
    if (cursorLine < lines.length) {
      const line = lines[cursorLine];
      if (cursorColumn <= line.length) {
        // Insert cursor marker at the specified position
        const before = line.substring(0, cursorColumn);
        const after = line.substring(cursorColumn);
        lines[cursorLine] = before + "{{CURSOR_MARKER}}" + after;
        processedContent = lines.join("\n");
      }
    }
  }

  // Apply HTML escaping
  let highlighted = escapeHtml(processedContent);

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

  // Replace cursor marker with styled cursor
  highlighted = highlighted.replace(
    /\{\{CURSOR_MARKER\}\}/g,
    '<span class="cursor">|</span>',
  );

  return highlighted;
}

function formatConfig(config: any): string {
  if (config.error) {
    return `<span style="color: #d73027;">${escapeHtml(config.error)}</span>`;
  }

  let html = "";
  if (config.description) {
    html += `<div class="config-description">${escapeHtml(config.description)}</div>`;
  }

  html += `<div class="config-item"><strong>Cursor Position:</strong> Line ${config.cursorLine}, Column ${config.cursorColumn}</div>`;

  if (config.expectedAction) {
    html += `<div class="config-item"><strong>Expected Action:</strong> ${escapeHtml(config.expectedAction)}</div>`;
  }

  return html;
}

export function generateTransactionCompletionHTML(
  testDataDir: string,
  outputDir: string,
): { name: string; testCases: number; outputFile: string } {
  const testCases: TestCase[] = [];

  // Read all test case directories
  const dirs = fs
    .readdirSync(testDataDir, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name)
    .sort();

  for (const dir of dirs) {
    const testCaseDir = path.join(testDataDir, dir);
    const inputFile = path.join(testCaseDir, "input.ledger");
    const expectedFile = path.join(testCaseDir, "expected.ledger");
    const configFile = path.join(testCaseDir, "config.json");

    if (
      fs.existsSync(inputFile) &&
      fs.existsSync(expectedFile) &&
      fs.existsSync(configFile)
    ) {
      const input = fs.readFileSync(inputFile, "utf8");
      const expected = fs.readFileSync(expectedFile, "utf8");
      const configJson = fs.readFileSync(configFile, "utf8");
      let config: any;
      try {
        config = JSON.parse(configJson);
      } catch (e) {
        config = { error: `Failed to parse JSON: ${e.message}` };
      }

      testCases.push({
        name: dir,
        title: dir.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
        input,
        expected,
        config,
      });
    }
  }

  const html = `<!DOCTYPE html>
<html>
<head>
    <title>Transaction Completion Test Cases</title>
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
            display: grid;
            grid-template-columns: 1fr 1fr 300px;
            gap: 0;
        }
        .column { 
            padding: 15px;
            border-right: 1px solid #ddd;
        }
        .column:last-child {
            border-right: none;
        }
        .input-column { 
            background-color: #fafafa; 
        }
        .expected-column { 
            background-color: #f0f8f0; 
        }
        .config-column { 
            background-color: #f8f0f8; 
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
        .config-content {
            background-color: #ffffff;
            font-family: Arial, sans-serif;
            font-size: 14px;
            line-height: 1.4;
            white-space: normal;
        }
        .config-description {
            color: #666;
            font-style: italic;
            margin-bottom: 10px;
            padding: 8px;
            background-color: #f0f4f8;
            border-radius: 4px;
        }
        .config-item {
            margin-bottom: 8px;
        }
        
        /* Syntax highlighting styles */
        .date {
            color: #e74c3c;
            font-weight: bold;
        }
        
        .amount {
            color: #2ecc71;
            font-weight: bold;
        }
        
        .account {
            color: #3498db;
        }
        
        .comment {
            color: #95a5a6;
            font-style: italic;
        }
        
        .cursor {
            color: #dc2626;
            font-weight: bold;
            font-size: 1.2em;
            animation: blink 1s infinite;
            background: rgba(220, 38, 38, 0.2);
            padding: 0 2px;
            border-radius: 2px;
        }
        
        @keyframes blink {
            0%, 50% { opacity: 1; }
            51%, 100% { opacity: 0.3; }
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
    </style>
</head>
<body>
    <h1>Transaction Completion Test Cases</h1>
    
    <div class="summary">
        <h2>What This Shows</h2>
        <p>This preview shows transaction completion test cases with input, expected output, and configuration.</p>
        <p><strong>Features being tested:</strong></p>
        <ul>
            <li><strong>Transaction completion</strong>: Ctrl+C Tab completes transactions based on existing patterns</li>
            <li><strong>Posting patterns</strong>: Learns from existing transactions with same payee</li>
            <li><strong>Cursor positioning</strong>: Tests work with different cursor positions</li>
            <li><strong>Exact formatting</strong>: Preserves whitespace and newlines precisely</li>
        </ul>
        <p><strong>Test cases:</strong> ${testCases.length}</p>
    </div>

${testCases
  .map(
    (testCase) => `
    <div class="test-case">
        <div class="test-header">
            <h3 class="test-title">${testCase.title}</h3>
            <p class="test-name">test/data/transaction-completion/${testCase.name}/</p>
        </div>
        <div class="test-content">
            <div class="column input-column">
                <div class="column-header">Input</div>
                <pre class="content">${highlightLedgerSyntax(testCase.input, testCase.config.cursorLine, testCase.config.cursorColumn)}</pre>
            </div>
            <div class="column expected-column">
                <div class="column-header">Expected After Completion</div>
                <pre class="content">${highlightLedgerSyntax(testCase.expected)}</pre>
            </div>
            <div class="column config-column">
                <div class="column-header">Configuration</div>
                <div class="content config-content">${formatConfig(testCase.config)}</div>
            </div>
        </div>
    </div>
`,
  )
  .join("")}

</body>
</html>`;

  const outputFile = path.join(outputDir, "transaction-completion.html");
  fs.writeFileSync(outputFile, html, "utf8");
  return {
    name: "Transaction Completion",
    testCases: testCases.length,
    outputFile,
  };
}

if (require.main === module) {
  const testDataDir =
    process.argv[2] || path.join(__dirname, "../data/transaction-completion");
  const outputDir = process.argv[3] || path.join(__dirname, "../preview");

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const result = generateTransactionCompletionHTML(testDataDir, outputDir);
  console.log(
    `Generated ${result.name}: ${result.testCases} test cases -> ${result.outputFile}`,
  );
}
