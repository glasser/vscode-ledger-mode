#!/usr/bin/env node

// Generator for completion provider test data
// Creates HTML previews showing ledger files and completion configuration
// Based on the original generate-test-review.ts with all its features

import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";

interface TestCase {
  name: string;
  title: string;
  input: string;
  config: any;
  configYaml: string;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function highlightLedgerSyntax(
  content: string,
  cursorLine?: number,
  cursorColumn?: number,
): string {
  // Simple syntax highlighting for ledger content with cursor positioning
  let highlighted = escapeHtml(content);

  // Insert cursor marker if position is provided
  if (cursorLine !== undefined && cursorColumn !== undefined) {
    const lines = highlighted.split("\n");
    if (cursorLine < lines.length) {
      const line = lines[cursorLine];
      if (cursorColumn <= line.length) {
        // Insert cursor marker at the specified position
        const before = line.substring(0, cursorColumn);
        const after = line.substring(cursorColumn);
        lines[cursorLine] = before + '<span class="cursor">|</span>' + after;
        highlighted = lines.join("\n");
      }
    }
  }

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

  return highlighted;
}

function formatYamlConfig(config: any): string {
  return yaml.dump(config, {
    quotingType: '"',
    forceQuotes: false,
    lineWidth: -1,
  });
}

function generateTestCaseHtml(testCase: TestCase): string {
  // Get cursor position - it's stored directly as cursorLine/cursorColumn in YAML
  const cursorLine = testCase.config.cursorLine;
  const cursorColumn = testCase.config.cursorColumn;

  const cursorInfo =
    cursorLine !== undefined && cursorColumn !== undefined
      ? `<p><strong>Cursor Position:</strong> Line ${cursorLine}, Column ${cursorColumn}</p>`
      : "";

  const expectedCompletions = testCase.config.expectedCompletions
    ? testCase.config.expectedCompletions
        .map(
          (comp: any) =>
            `<li><strong>${escapeHtml(comp.label)}</strong> (${comp.kind || "unknown"}) - ${escapeHtml(comp.detail || "")}${comp.mustContain ? ` (contains: "${escapeHtml(comp.mustContain)}")` : ""}</li>`,
        )
        .join("")
    : "";

  const completionType = testCase.config.completionType
    ? `<p><strong>Completion Type:</strong> ${escapeHtml(testCase.config.completionType)}</p>`
    : "";

  const negativeAssertions: string[] = [];
  if (testCase.config.noPayeeCompletions) {
    negativeAssertions.push("No payee completions expected");
  }
  if (testCase.config.noAccountCompletions) {
    negativeAssertions.push("No account completions expected");
  }

  const negativeAssertionsHtml =
    negativeAssertions.length > 0
      ? `<p><strong>Negative Assertions:</strong> ${negativeAssertions.join(", ")}</p>`
      : "";

  return `
    <div class="test-case" id="${testCase.name}">
      <h2>${testCase.name}</h2>
      <p class="description">${escapeHtml(testCase.config.description || "No description")}</p>
      
      <div class="test-details">
        ${cursorInfo}
        ${completionType}
        ${negativeAssertionsHtml}
        
        ${
          expectedCompletions
            ? `
          <div class="expected-completions">
            <h4>Expected Completions:</h4>
            <ul>${expectedCompletions}</ul>
          </div>
        `
            : ""
        }
      </div>
      
      <div class="test-content">
        <div class="input-section">
          <h4>Input Content (input.ledger):</h4>
          <pre class="ledger-content">${highlightLedgerSyntax(testCase.input, cursorLine, cursorColumn)}</pre>
        </div>
        
        <div class="config-section">
          <h4>Configuration (config.yaml):</h4>
          <pre class="yaml-content">${escapeHtml(formatYamlConfig(testCase.config))}</pre>
        </div>
      </div>
    </div>
  `;
}

function generateToc(testCases: TestCase[]): string {
  const grouped = testCases.reduce(
    (acc: { [key: string]: TestCase[] }, testCase) => {
      const category = testCase.name.split("-")[0];
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(testCase);
      return acc;
    },
    {},
  );

  return Object.entries(grouped)
    .map(
      ([category, cases]) => `
    <div class="toc-category">
      <h3>${category.charAt(0).toUpperCase() + category.slice(1)} Tests</h3>
      <ul>
        ${cases
          .map(
            (testCase) =>
              `<li><a href="#${testCase.name}">${testCase.name}</a> - ${escapeHtml(testCase.config.description || "No description")}</li>`,
          )
          .join("")}
      </ul>
    </div>
  `,
    )
    .join("");
}

export function generateCompletionProviderHTML(
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
    const configFile = path.join(testCaseDir, "config.yaml");

    if (fs.existsSync(inputFile) && fs.existsSync(configFile)) {
      const input = fs.readFileSync(inputFile, "utf8");
      const configYaml = fs.readFileSync(configFile, "utf8");
      let config: any;
      try {
        config = yaml.load(configYaml);
      } catch (e) {
        config = { error: `Failed to parse YAML: ${e.message}` };
      }

      testCases.push({
        name: dir,
        title: dir.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
        input,
        config,
        configYaml,
      });
    }
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Completion Provider Test Cases</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        
        .header {
            text-align: center;
            margin-bottom: 40px;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 8px;
        }
        
        .header h1 {
            color: #2c3e50;
            margin-bottom: 10px;
        }
        
        
        .toc {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 30px;
        }
        
        .toc h2 {
            margin-top: 0;
            color: #2c3e50;
        }
        
        .toc-category {
            margin-bottom: 20px;
        }
        
        .toc-category h3 {
            color: #34495e;
            border-bottom: 2px solid #e9ecef;
            padding-bottom: 5px;
        }
        
        .toc ul {
            list-style-type: none;
            padding-left: 0;
        }
        
        .toc li {
            padding: 5px 0;
            border-bottom: 1px solid #e9ecef;
        }
        
        .toc a {
            color: #3498db;
            text-decoration: none;
        }
        
        .toc a:hover {
            text-decoration: underline;
        }
        
        .test-case {
            margin-bottom: 40px;
            padding: 20px;
            border: 1px solid #e9ecef;
            border-radius: 8px;
            background: white;
        }
        
        .test-case h2 {
            color: #2c3e50;
            margin-top: 0;
            font-family: 'Monaco', 'Menlo', monospace;
            background: #f8f9fa;
            padding: 10px;
            border-radius: 4px;
        }
        
        .description {
            background: #e8f5e8;
            padding: 10px;
            border-left: 4px solid #27ae60;
            margin: 10px 0;
            font-style: italic;
        }
        
        .test-details {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 4px;
            margin: 15px 0;
        }
        
        .test-details p {
            margin: 5px 0;
        }
        
        .expected-completions {
            margin-top: 10px;
        }
        
        .expected-completions ul {
            margin: 5px 0;
            padding-left: 20px;
        }
        
        .test-content {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-top: 20px;
        }
        
        @media (max-width: 768px) {
            .test-content {
                grid-template-columns: 1fr;
            }
        }
        
        .input-section, .config-section {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 4px;
        }
        
        .input-section h4, .config-section h4 {
            margin-top: 0;
            color: #34495e;
        }
        
        pre {
            background: white;
            border: 1px solid #ddd;
            border-radius: 4px;
            padding: 10px;
            overflow-x: auto;
            font-size: 0.9em;
            line-height: 1.4;
        }
        
        .ledger-content {
            font-family: 'Monaco', 'Menlo', monospace;
        }
        
        .yaml-content {
            font-family: 'Monaco', 'Menlo', monospace;
        }
        
        /* Syntax highlighting for ledger content */
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
        
        .summary {
            background: #e8f4f8;
            padding: 15px;
            border-left: 4px solid #3498db;
            margin-bottom: 30px;
        }
        
        .back-to-top {
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #3498db;
            color: white;
            padding: 10px 15px;
            border-radius: 50px;
            text-decoration: none;
            font-size: 0.9em;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        }
        
        .back-to-top:hover {
            background: #2980b9;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Completion Provider Test Cases</h1>
    </div>
    
    <div class="summary">
        <h3>Overview</h3>
        <p>This page provides a comprehensive review of all data-driven test cases for the completion provider functionality. 
        Each test case includes the input ledger content, cursor position, expected completions, and configuration details.</p>
        <p><strong>Total Test Cases:</strong> ${testCases.length}</p>
        <p><strong>Visual Indicators:</strong> The <span class="cursor">|</span> symbol shows exactly where the cursor is positioned when the completion is triggered.</p>
    </div>
    
    <div class="toc">
        <h2>Table of Contents</h2>
        ${generateToc(testCases)}
    </div>
    
    <div class="test-cases">
        ${testCases.map(generateTestCaseHtml).join("")}
    </div>
    
    <a href="#" class="back-to-top">↑ Top</a>
    
    <script>
        // Smooth scrolling for anchor links
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                e.preventDefault();
                const target = document.querySelector(this.getAttribute('href'));
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            });
        });
    </script>
</body>
</html>`;

  const outputFile = path.join(outputDir, "completion-provider.html");
  fs.writeFileSync(outputFile, html, "utf8");
  return {
    name: "Completion Provider",
    testCases: testCases.length,
    outputFile,
  };
}

if (require.main === module) {
  const testDataDir =
    process.argv[2] || path.join(__dirname, "../data/completion-provider");
  const outputDir = process.argv[3] || path.join(__dirname, "../preview");

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const result = generateCompletionProviderHTML(testDataDir, outputDir);
  console.log(
    `Generated ${result.name}: ${result.testCases} test cases -> ${result.outputFile}`,
  );
}
