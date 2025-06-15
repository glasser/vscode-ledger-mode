#!/usr/bin/env node

// Generator for error formatting test data
// Creates HTML previews showing input text and expected formatted HTML output

import * as fs from "fs";
import * as path from "path";
import { ERROR_FORMATTING_CSS } from "../../src/errorFormattingCss";

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

export function generateErrorFormattingHTML(
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
    const inputFile = path.join(testCaseDir, "input.txt");
    const expectedFile = path.join(testCaseDir, "expected.html");

    if (fs.existsSync(inputFile) && fs.existsSync(expectedFile)) {
      const input = fs.readFileSync(inputFile, "utf8");
      const expected = fs.readFileSync(expectedFile, "utf8");

      testCases.push({
        name: dir,
        title: dir.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
        input,
        expected,
      });
    }
  }

  const html = `<!DOCTYPE html>
<html>
<head>
    <title>Error Formatting Test Cases</title>
    <style>
        :root {
            /* VSCode theme variables for preview */
            --vscode-errorForeground: #d73027;
            --vscode-inputValidation-errorBackground: #fff2f0;
            --vscode-textCodeBlock-background: #f0f4f8;
            --vscode-textBlockQuote-border: #4a90e2;
            --vscode-descriptionForeground: #666;
            --vscode-textLink-foreground: #0066cc;
            --vscode-textLink-activeForeground: #004499;
            --vscode-editor-font-family: 'Courier New', monospace;
        }
        
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
        
        /* Imported error formatting styles from actual implementation */
        ${ERROR_FORMATTING_CSS}
    </style>
</head>
<body>
    <h1>Error Formatting Test Cases</h1>
    
    <div class="summary">
        <h2>What This Shows</h2>
        <p>This preview shows how raw ledger error output is transformed into styled HTML.</p>
        <p><strong>Features being tested:</strong></p>
        <ul>
            <li><strong>Error messages</strong>: Styled with red background and left border</li>
            <li><strong>Context labels</strong>: "While parsing..." phrases in italic gray</li>
            <li><strong>Quoted blocks</strong>: Lines starting with ">" grouped with blue background and left border</li>
        </ul>
        <p><strong>Test cases:</strong> ${testCases.length}</p>
    </div>

${testCases
  .map(
    (testCase) => `
    <div class="test-case">
        <div class="test-header">
            <h3 class="test-title">${testCase.title}</h3>
            <p class="test-name">test/data/error-formatting/${testCase.name}/</p>
        </div>
        <div class="comparison">
            <div class="column before">
                <div class="column-header">Input (Raw Text)</div>
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

  const outputFile = path.join(outputDir, "error-formatting.html");
  fs.writeFileSync(outputFile, html, "utf8");
  return { name: "Error Formatting", testCases: testCases.length, outputFile };
}

if (require.main === module) {
  const testDataDir =
    process.argv[2] || path.join(__dirname, "../data/error-formatting");
  const outputDir = process.argv[3] || path.join(__dirname, "../preview");

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const result = generateErrorFormattingHTML(testDataDir, outputDir);
  console.log(
    `Generated ${result.name}: ${result.testCases} test cases -> ${result.outputFile}`,
  );
}
