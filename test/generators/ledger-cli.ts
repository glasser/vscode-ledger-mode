#!/usr/bin/env node

// Generator for ledger CLI test data
// Creates HTML previews showing ledger files being tested and their expected validation results

import * as fs from "fs";
import * as path from "path";

interface LedgerTestCase {
  name: string;
  file: string;
  description: string;
  expectedErrors: Array<{
    message: string;
    line?: number;
    severity: string;
    description?: string;
  }>;
  content: string;
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
  errorLines: number[] = [],
): string {
  // Split content into lines and add line numbers with highlighting
  const lines = content.split("\n");
  const numberedLines = lines.map((line, index) => {
    const lineNumber = index + 1; // 1-based line numbers
    const hasError = errorLines.includes(lineNumber);

    // Apply syntax highlighting to the line content
    let highlighted = escapeHtml(line);

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

export function generateLedgerCliHTML(
  testDataDir: string,
  outputDir: string,
): { name: string; testCases: number; outputFile: string } {
  const testCases: LedgerTestCase[] = [];

  // Read all JSON configuration files
  const files = fs
    .readdirSync(testDataDir)
    .filter((file) => file.endsWith(".json"))
    .sort();

  for (const file of files) {
    const configPath = path.join(testDataDir, file);
    const configJson = fs.readFileSync(configPath, "utf8");
    let config: any;
    try {
      config = JSON.parse(configJson);
    } catch (e) {
      continue; // Skip malformed JSON files
    }

    // Resolve the ledger file path relative to the config file
    const ledgerFilePath = path.resolve(path.dirname(configPath), config.file);

    if (fs.existsSync(ledgerFilePath)) {
      const content = fs.readFileSync(ledgerFilePath, "utf8");
      const name = file.replace(".json", "");

      testCases.push({
        name,
        file: config.file,
        description: config.description || "No description",
        expectedErrors: config.expectedErrors || [],
        content,
      });
    }
  }

  const html = `<!DOCTYPE html>
<html>
<head>
    <title>Ledger CLI Test Cases</title>
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
        .test-description {
            font-size: 14px;
            color: #666;
            margin: 5px 0 0 0;
            font-style: italic;
        }
        .test-file {
            font-size: 12px;
            color: #666;
            margin: 5px 0 0 0;
            font-family: monospace;
        }
        .test-content {
            display: grid;
            grid-template-columns: 1fr 400px;
            gap: 0;
        }
        .ledger-column { 
            padding: 15px;
            border-right: 1px solid #ddd;
            background-color: #fafafa;
        }
        .errors-column { 
            padding: 15px;
            background-color: #f8f0f0;
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
        .errors-content {
            background-color: #ffffff;
            font-family: Arial, sans-serif;
            font-size: 14px;
            line-height: 1.4;
            white-space: normal;
        }
        .no-errors {
            color: #27ae60;
            font-weight: bold;
            text-align: center;
            padding: 20px;
            background-color: #e8f5e8;
            border-radius: 4px;
            border: 1px solid #27ae60;
        }
        .error-item {
            margin-bottom: 15px;
            padding: 10px;
            border-left: 4px solid #d73027;
            background-color: #fff2f0;
            border-radius: 0 4px 4px 0;
        }
        .error-message {
            font-weight: bold;
            color: #d73027;
            margin-bottom: 5px;
        }
        .error-line {
            font-size: 12px;
            color: #666;
            margin-bottom: 5px;
            font-family: monospace;
        }
        .error-severity {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 11px;
            font-weight: bold;
            text-transform: uppercase;
        }
        .error-severity.error {
            background-color: #d73027;
            color: white;
        }
        .error-severity.warning {
            background-color: #f39c12;
            color: white;
        }
        .error-description {
            font-size: 13px;
            color: #555;
            margin-top: 5px;
            font-style: italic;
        }
        
        /* Syntax highlighting styles */
        .comment { color: #22863a; font-style: italic; }
        .date { color: #005cc5; font-weight: bold; }
        .amount { color: #d73a49; font-weight: bold; }
        .reconciliation { color: #6f42c1; font-weight: bold; }
        .account { color: #032f62; }
        .directive { color: #e36209; font-weight: bold; }
        
        /* Line numbering and error highlighting */
        .line {
            display: block;
            position: relative;
        }
        .line.error-line {
            background-color: #ffeaea;
            border-left: 3px solid #d73027;
            margin: 0 -12px;
            padding: 0 12px;
            font-weight: bold;
        }
        .line-number {
            color: #666;
            margin-right: 10px;
            user-select: none;
            display: inline-block;
            font-weight: normal;
        }
        .error-line .line-number {
            color: #d73027;
            font-weight: bold;
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
    <h1>Ledger CLI Test Cases</h1>
    
    <div class="summary">
        <h2>What This Shows</h2>
        <p>This preview shows ledger files used for CLI validation testing and their expected error outputs.</p>
        <p><strong>Features being tested:</strong></p>
        <ul>
            <li><strong>File validation</strong>: Testing ledger CLI parsing and validation</li>
            <li><strong>Error detection</strong>: Expected errors, warnings, and their locations</li>
            <li><strong>Clean files</strong>: Files that should pass validation without errors</li>
        </ul>
        <p><strong>Test configurations:</strong> ${testCases.length}</p>
    </div>

${testCases
  .map(
    (testCase) => `
    <div class="test-case">
        <div class="test-header">
            <h3 class="test-title">${testCase.name}</h3>
            <p class="test-description">${testCase.description}</p>
            <p class="test-file">File: ${testCase.file}</p>
        </div>
        <div class="test-content">
            <div class="ledger-column">
                <div class="column-header">Ledger File Content</div>
                <pre class="content">${highlightLedgerSyntax(
                  testCase.content,
                  testCase.expectedErrors
                    .map((e) => e.line + 1) // Convert from 0-based to 1-based
                    .filter((line) => line !== undefined),
                )}</pre>
            </div>
            <div class="errors-column">
                <div class="column-header">Expected Validation Results</div>
                <div class="content errors-content">
                    ${
                      testCase.expectedErrors.length === 0
                        ? '<div class="no-errors">✅ No errors expected<br>File should pass validation</div>'
                        : testCase.expectedErrors
                            .map(
                              (error) => `
                            <div class="error-item">
                                <div class="error-message">${escapeHtml(error.message)}</div>
                                ${error.line !== undefined ? `<div class="error-line">Line ${error.line + 1}</div>` : ""}
                                <div class="error-severity ${error.severity}">${error.severity}</div>
                                ${error.description ? `<div class="error-description">${escapeHtml(error.description)}</div>` : ""}
                            </div>
                        `,
                            )
                            .join("")
                    }
                </div>
            </div>
        </div>
    </div>
`,
  )
  .join("")}

</body>
</html>`;

  const outputFile = path.join(outputDir, "ledger-cli.html");
  fs.writeFileSync(outputFile, html, "utf8");
  return { name: "Ledger CLI", testCases: testCases.length, outputFile };
}

if (require.main === module) {
  const testDataDir =
    process.argv[2] || path.join(__dirname, "../data/ledger-cli");
  const outputDir = process.argv[3] || path.join(__dirname, "../preview");

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const result = generateLedgerCliHTML(testDataDir, outputDir);
  console.log(
    `Generated ${result.name}: ${result.testCases} test cases -> ${result.outputFile}`,
  );
}
