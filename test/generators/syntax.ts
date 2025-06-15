#!/usr/bin/env node

// Generator for syntax test data
// Creates HTML previews showing syntax highlighting test files

import * as fs from "fs";
import * as path from "path";

interface TestCase {
  name: string;
  title: string;
  content: string;
  file: string;
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

function highlightLedgerSyntax(content: string): string {
  // Simple syntax highlighting for ledger files
  let html = escapeHtml(content);

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

export function generateSyntaxHTML(
  testDataDir: string,
  outputDir: string,
): { name: string; testCases: number; outputFile: string } {
  const testCases: TestCase[] = [];

  // Read all test files
  const files = fs
    .readdirSync(testDataDir)
    .filter((file) => file.endsWith(".test.ledger"))
    .sort();

  for (const file of files) {
    const filePath = path.join(testDataDir, file);
    const content = fs.readFileSync(filePath, "utf8");
    const name = file.replace(".test.ledger", "");

    testCases.push({
      name,
      title: name.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
      content,
      file,
    });
  }

  const html = `<!DOCTYPE html>
<html>
<head>
    <title>Syntax Highlighting Test Cases</title>
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
            padding: 15px;
            background-color: #f0f8f0;
        }
        .content-header {
            font-weight: bold;
            margin-bottom: 10px;
            color: #666;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .content { 
            background-color: #ffffff; 
            padding: 12px; 
            border-radius: 4px; 
            border: 1px solid #e0e0e0;
            font-family: 'Courier New', monospace;
            font-size: 13px;
            line-height: 1.4;
            white-space: pre-wrap;
            margin: 0;
        }
        
        /* Syntax highlighting styles */
        .comment { color: #22863a; font-style: italic; }
        .date { color: #005cc5; font-weight: bold; }
        .amount { color: #d73a49; font-weight: bold; }
        .reconciliation { color: #6f42c1; font-weight: bold; }
        .account { color: #032f62; }
        
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
    <h1>Syntax Highlighting Test Cases</h1>
    
    <div class="summary">
        <h2>What This Shows</h2>
        <p>This preview shows syntax highlighting test files and how they should be highlighted.</p>
        <p><strong>Features being tested:</strong></p>
        <ul>
            <li><strong>Comments</strong>: Lines starting with ;</li>
            <li><strong>Dates</strong>: YYYY-MM-DD format</li>
            <li><strong>Amounts</strong>: Currency amounts with $ symbol</li>
            <li><strong>Reconciliation markers</strong>: * and ! symbols</li>
            <li><strong>Account names</strong>: Indented account hierarchies</li>
        </ul>
        <p><strong>Note:</strong> These are used by vscode-tmgrammar-test for TextMate grammar validation.</p>
        <p><strong>Test files:</strong> ${testCases.length}</p>
    </div>

${testCases
  .map(
    (testCase) => `
    <div class="test-case">
        <div class="test-header">
            <h3 class="test-title">${testCase.title}</h3>
            <p class="test-name">test/data/syntax/${testCase.file}</p>
        </div>
        <div class="test-content">
            <div class="content-header">Syntax Highlighted Content</div>
            <pre class="content">${highlightLedgerSyntax(testCase.content)}</pre>
        </div>
    </div>
`,
  )
  .join("")}

</body>
</html>`;

  const outputFile = path.join(outputDir, "syntax.html");
  fs.writeFileSync(outputFile, html, "utf8");
  return { name: "Syntax", testCases: testCases.length, outputFile };
}

if (require.main === module) {
  const testDataDir = process.argv[2] || path.join(__dirname, "../data/syntax");
  const outputDir = process.argv[3] || path.join(__dirname, "../preview");

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const result = generateSyntaxHTML(testDataDir, outputDir);
  console.log(
    `Generated ${result.name}: ${result.testCases} test cases -> ${result.outputFile}`,
  );
}
