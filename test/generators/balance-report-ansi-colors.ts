#!/usr/bin/env node

// Generator for balance report ANSI color test data
// Creates HTML previews showing input text and expected HTML output

import * as fs from "fs";
import * as path from "path";
import { ANSI_COLORS_CSS } from "../../src/ansiColorsCss";

interface TestCase {
  name: string;
  title: string;
  input: string;
  expected: string;
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

export function generateBalanceReportAnsiColorsHTML(
  testDataDir: string,
  outputDir: string,
): { name: string; testCases: number; outputFile: string } {
  const testCases: TestCase[] = [];

  // Read all test case files
  const files = fs.readdirSync(testDataDir);
  const testNames = [
    ...new Set(
      files.map((f) => f.replace(/-(?:input\.txt|expected\.html)$/, "")),
    ),
  ];

  for (const testName of testNames) {
    const inputFile = path.join(testDataDir, `${testName}-input.txt`);
    const expectedFile = path.join(testDataDir, `${testName}-expected.html`);

    if (fs.existsSync(inputFile) && fs.existsSync(expectedFile)) {
      const input = fs.readFileSync(inputFile, "utf8");
      const expected = fs.readFileSync(expectedFile, "utf8");

      testCases.push({
        name: testName,
        title: testName
          .replace(/-/g, " ")
          .replace(/\b\w/g, (l) => l.toUpperCase()),
        input,
        expected,
      });
    }
  }

  const html = `<!DOCTYPE html>
<html>
<head>
    <title>Balance Report ANSI Colors Test Cases</title>
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
        .comparison { 
            display: flex;
        }
        .column { 
            flex: 1; 
            padding: 15px;
        }
        .before { 
            background-color: #fafafa; 
            border-right: 1px solid #ddd;
        }
        .after { 
            background-color: #f0f8f0; 
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
        .input-content {
            color: #666;
        }
        .styled-content {
            background-color: #ffffff; 
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
        
        /* Imported ANSI color styles from actual implementation */
        ${ANSI_COLORS_CSS}
    </style>
</head>
<body>
    <h1>Balance Report ANSI Colors Test Cases</h1>
    
    <div class="summary">
        <h2>What This Shows</h2>
        <p>This preview shows how ANSI color codes from ledger balance reports are converted to HTML.</p>
        <p><strong>Test cases:</strong> ${testCases.length}</p>
    </div>

${testCases
  .map(
    (testCase) => `
    <div class="test-case">
        <div class="test-header">
            <h3 class="test-title">${testCase.title}</h3>
            <p class="test-name">test/data/balance-report-ansi-colors/${testCase.name}</p>
        </div>
        <div class="comparison">
            <div class="column before">
                <div class="column-header">Input (Raw ANSI)</div>
                <pre class="content input-content">${escapeHtml(testCase.input)}</pre>
            </div>
            <div class="column after">
                <div class="column-header">Expected Output (Styled)</div>
                <pre class="content styled-content">${testCase.expected}</pre>
            </div>
        </div>
    </div>
`,
  )
  .join("")}

</body>
</html>`;

  const outputFile = path.join(outputDir, "balance-report-ansi-colors.html");
  fs.writeFileSync(outputFile, html, "utf8");
  return {
    name: "Balance Report ANSI Colors",
    testCases: testCases.length,
    outputFile,
  };
}

if (require.main === module) {
  const testDataDir =
    process.argv[2] ||
    path.join(__dirname, "../data/balance-report-ansi-colors");
  const outputDir = process.argv[3] || path.join(__dirname, "../preview");

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const result = generateBalanceReportAnsiColorsHTML(testDataDir, outputDir);
  console.log(
    `Generated ${result.name}: ${result.testCases} test cases -> ${result.outputFile}`,
  );
}
