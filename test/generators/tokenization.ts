#!/usr/bin/env node

// Generator for tokenization test data
// Creates HTML previews showing parsing test cases in a structured, readable format

import * as fs from "fs";
import * as path from "path";

interface TokenizationTestCase {
  description: string;
  input?: string;
  inputs?: string[];
  expected?: any;
  shouldParse?: boolean;
  reason?: string;
  type?: string;
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

function formatJson(obj: any): string {
  return JSON.stringify(obj, null, 2);
}

export function generateTokenizationHTML(
  testDataDir: string,
  outputDir: string,
): { name: string; testCases: number; outputFile: string } {
  const jsonFiles = fs
    .readdirSync(testDataDir)
    .filter((f) => f.endsWith(".json"))
    .sort();

  let totalTestCases = 0;

  const sections = jsonFiles.map((file) => {
    const content = fs.readFileSync(path.join(testDataDir, file), "utf8");
    let testCases: TokenizationTestCase[];

    try {
      testCases = JSON.parse(content);
      totalTestCases += testCases.length;
    } catch (e) {
      return `
        <div class="file-section">
          <h2>${file}</h2>
          <div class="error">Failed to parse JSON: ${e.message}</div>
        </div>
      `;
    }

    const sectionTitle = file.replace(/-/g, " ").replace(/\.json$/, "");
    const isParsingTest = file.includes("parsing-examples");
    const isInvalidTest = file.includes("invalid");

    if (isParsingTest) {
      // For parsing examples, show input/expected pairs nicely formatted
      return `
        <div class="file-section">
          <h2>${sectionTitle}</h2>
          <div class="test-cases-grid">
            ${testCases
              .map(
                (testCase, _index) => `
              <div class="test-case ${isInvalidTest ? "invalid-test" : ""}">
                <div class="test-header">
                  <h3>${testCase.description}</h3>
                  ${testCase.type ? `<span class="test-type">${testCase.type}</span>` : ""}
                </div>
                <div class="test-content">
                  ${
                    testCase.input
                      ? `
                    <div class="input-section">
                      <div class="section-header">Input</div>
                      <div class="ledger-line">${escapeHtml(testCase.input)}</div>
                    </div>
                    <div class="expected-section">
                      <div class="section-header">Expected</div>
                      <pre class="json-output">${escapeHtml(formatJson(testCase.expected))}</pre>
                    </div>
                  `
                      : testCase.inputs
                        ? `
                    <div class="input-section full-width">
                      <div class="section-header">Test Inputs ${testCase.shouldParse !== undefined ? `(Should ${testCase.shouldParse ? "Parse" : "Not Parse"})` : ""}</div>
                      <div class="inputs-list">
                        ${testCase.inputs
                          .map(
                            (input) => `
                          <div class="ledger-line">${escapeHtml(input)}</div>
                        `,
                          )
                          .join("")}
                      </div>
                      ${testCase.reason ? `<div class="reason">${escapeHtml(testCase.reason)}</div>` : ""}
                    </div>
                  `
                        : ""
                  }
                </div>
              </div>
            `,
              )
              .join("")}
          </div>
        </div>
      `;
    } else {
      // For other JSON files, show them in a more structured way
      return `
        <div class="file-section">
          <h2>${sectionTitle}</h2>
          <pre class="json-content">${escapeHtml(formatJson(testCases))}</pre>
        </div>
      `;
    }
  });

  const html = `<!DOCTYPE html>
<html>
<head>
    <title>Tokenization Test Cases</title>
    <style>
        body { 
            font-family: Arial, sans-serif; 
            margin: 20px; 
            line-height: 1.4;
            background-color: #ffffff;
            color: #333333;
        }
        
        h1 {
            color: #333;
            border-bottom: 2px solid #0066cc;
            padding-bottom: 10px;
            margin-bottom: 30px;
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
        
        .file-section {
            margin-bottom: 40px;
        }
        
        .file-section h2 {
            color: #333;
            border-bottom: 1px solid #ddd;
            padding-bottom: 8px;
            text-transform: capitalize;
        }
        
        .test-cases-grid {
            display: grid;
            gap: 20px;
        }
        
        .test-case {
            border: 1px solid #ddd;
            border-radius: 8px;
            overflow: hidden;
            background-color: #fafafa;
        }
        
        .test-case.invalid-test {
            border-color: #f39c12;
            background-color: #fef9e7;
        }
        
        .test-header {
            background-color: #f5f5f5;
            padding: 15px;
            border-bottom: 1px solid #ddd;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .invalid-test .test-header {
            background-color: #f8d7da;
        }
        
        .test-header h3 {
            margin: 0;
            font-size: 16px;
            color: #333;
        }
        
        .test-type {
            background-color: #007bff;
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            text-transform: uppercase;
        }
        
        .test-content {
            display: grid;
            grid-template-columns: 1fr;
            gap: 0;
        }
        
        .input-section.full-width {
            grid-column: 1 / -1;
        }
        
        .input-section, .expected-section {
            padding: 15px;
        }
        
        .input-section {
            background-color: #f8f9fa;
            border-bottom: 1px solid #ddd;
        }
        
        .expected-section {
            background-color: #f0f8f0;
        }
        
        .section-header {
            font-weight: bold;
            margin-bottom: 10px;
            color: #666;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .ledger-line {
            background-color: #ffffff;
            padding: 8px 12px;
            border-radius: 4px;
            border: 1px solid #e0e0e0;
            font-family: 'Courier New', monospace;
            font-size: 13px;
            margin-bottom: 8px;
            white-space: pre;
        }
        
        .inputs-list .ledger-line:last-child {
            margin-bottom: 0;
        }
        
        .json-output, .json-content {
            background-color: #ffffff;
            padding: 12px;
            border-radius: 4px;
            border: 1px solid #e0e0e0;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            margin: 0;
            overflow-x: auto;
        }
        
        .reason {
            margin-top: 10px;
            padding: 8px;
            background-color: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 4px;
            font-style: italic;
            color: #856404;
        }
        
        .error {
            color: #d73027;
            padding: 10px;
            background-color: #f8d7da;
            border-radius: 4px;
            border: 1px solid #f5c6cb;
        }
    </style>
</head>
<body>
    <h1>Tokenization Test Cases</h1>
    
    <div class="summary">
        <h2>What This Shows</h2>
        <p>Test cases for transaction and posting parsing functionality. These tests verify that the tokenization logic correctly parses ledger syntax into structured data.</p>
        <p><strong>Features being tested:</strong></p>
        <ul>
            <li><strong>Transaction parsing</strong>: Date, state markers, payee names, codes, effective dates</li>
            <li><strong>Posting parsing</strong>: Account names, amounts, state markers, comments</li>
            <li><strong>Invalid input handling</strong>: Ensuring malformed lines are properly rejected</li>
            <li><strong>Edge cases</strong>: Special characters, various date formats, complex amounts</li>
        </ul>
        <p><strong>Total test cases:</strong> ${totalTestCases}</p>
    </div>

    ${sections.join("")}

</body>
</html>`;

  const outputFile = path.join(outputDir, "tokenization.html");
  fs.writeFileSync(outputFile, html, "utf8");

  return {
    name: "Tokenization",
    testCases: totalTestCases,
    outputFile,
  };
}

if (require.main === module) {
  const testDataDir =
    process.argv[2] || path.join(__dirname, "../data/tokenization");
  const outputDir = process.argv[3] || path.join(__dirname, "../preview");

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const result = generateTokenizationHTML(testDataDir, outputDir);
  console.log(
    `Generated ${result.name}: ${result.testCases} test cases -> ${result.outputFile}`,
  );
}
