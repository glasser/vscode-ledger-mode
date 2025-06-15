#!/usr/bin/env node

// Generator for format test data
// Creates HTML previews showing input and expected ledger file formatting

import * as fs from "fs";
import * as path from "path";

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

export function generateFormatHTML(
  testDataDir: string,
  outputDir: string,
): { name: string; testCases: number; outputFile: string } {
  // Extract the data directory name from the path to show correct path in HTML
  const dataDirName = path.basename(testDataDir);
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

  // Dynamic title based on data directory
  const pageTitle =
    dataDirName === "format"
      ? "Ledger Format Test Cases"
      : dataDirName === "organize-ledger"
        ? "Ledger Organization Test Cases"
        : `${dataDirName.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())} Test Cases`;

  const html = `<!DOCTYPE html>
<html>
<head>
    <title>${pageTitle}</title>
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
            color: #333;
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
    <h1>${pageTitle}</h1>
    
    <div class="summary">
        <h2>What This Shows</h2>
        <p>This preview shows how the ledger formatter transforms input ledger files into properly formatted output.</p>
        <p><strong>Features being tested:</strong></p>
        <ul>
            <li><strong>Amount alignment</strong>: Consistent column alignment for amounts</li>
            <li><strong>Account spacing</strong>: Proper spacing between accounts and amounts</li>
            <li><strong>Comment preservation</strong>: Comments are maintained in correct positions</li>
            <li><strong>Reconciliation markers</strong>: Status markers are normalized</li>
        </ul>
        <p><strong>Test cases:</strong> ${testCases.length}</p>
    </div>

${testCases
  .map(
    (testCase) => `
    <div class="test-case">
        <div class="test-header">
            <h3 class="test-title">${testCase.title}</h3>
            <p class="test-name">test/data/${dataDirName}/${testCase.name}/</p>
        </div>
        <div class="comparison">
            <div class="column before">
                <div class="column-header">Input (Unformatted)</div>
                <pre class="content input-content">${escapeHtml(testCase.input)}</pre>
            </div>
            <div class="column after">
                <div class="column-header">Expected Output (Formatted)</div>
                <pre class="content styled-content">${escapeHtml(testCase.expected)}</pre>
            </div>
        </div>
    </div>
`,
  )
  .join("")}

</body>
</html>`;

  const outputFile = path.join(outputDir, `${dataDirName}.html`);
  fs.writeFileSync(outputFile, html, "utf8");

  // Dynamic title based on data directory
  const title =
    dataDirName === "format"
      ? "Format"
      : dataDirName === "organize-ledger"
        ? "Organize Ledger"
        : dataDirName
            .replace(/-/g, " ")
            .replace(/\b\w/g, (l) => l.toUpperCase());

  return { name: title, testCases: testCases.length, outputFile };
}

if (require.main === module) {
  const testDataDir = process.argv[2] || path.join(__dirname, "../data/format");
  const outputDir = process.argv[3] || path.join(__dirname, "../preview");

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const result = generateFormatHTML(testDataDir, outputDir);
  console.log(
    `Generated ${result.name}: ${result.testCases} test cases -> ${result.outputFile}`,
  );
}
