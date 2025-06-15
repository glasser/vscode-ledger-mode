#!/usr/bin/env node

// Generator for nowMarker test data
// Creates HTML previews showing ledger files and their expected cursor positions

import * as fs from "fs";
import * as path from "path";

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

export function generateNowMarkerHTML(
  testDataDir: string,
  outputDir: string,
): { name: string; testCases: number; outputFile: string } {
  const files = fs
    .readdirSync(testDataDir)
    .filter((f) => f.endsWith(".ledger"))
    .sort();

  const html = `<!DOCTYPE html>
<html>
<head>
    <title>Now Marker Test Cases</title>
    <style>
        body { 
            font-family: Arial, sans-serif; 
            margin: 20px; 
            line-height: 1.4;
            background-color: #ffffff;
            color: #333333;
        }
        .file { 
            margin-bottom: 30px; 
            border: 1px solid #ddd; 
            border-radius: 8px; 
            overflow: hidden; 
        }
        .file-header { 
            background-color: #f5f5f5; 
            padding: 15px; 
            font-weight: bold;
            border-bottom: 1px solid #ddd;
        }
        .file-description { 
            background-color: #e8f4f8; 
            padding: 10px 15px; 
            font-size: 14px; 
            color: #0066cc; 
            border-bottom: 1px solid #ddd;
            font-style: italic;
        }
        .file-content { 
            padding: 15px; 
            background-color: #fafafa; 
            font-family: 'Courier New', monospace; 
            white-space: pre-wrap; 
            line-height: 1.6; 
            font-size: 13px;
        }
        .highlighted-line { 
            background-color: #ffeb3b; 
            font-weight: bold; 
            display: block; 
            margin: 0 -15px; 
            padding: 0 15px; 
            min-height: 1.6em; 
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
    </style>
</head>
<body>
    <h1>Now Marker Test Cases</h1>
    
    <div class="summary">
        <h2>What This Shows</h2>
        <p>Test files for the "jump to now" functionality that finds the appropriate insertion point for today's date (2015-12-23).</p>
        <p><strong>Expected behavior:</strong> The cursor should jump to the highlighted line when the "jump to now" command is executed.</p>
        <p><strong>Test files:</strong> ${files.length}</p>
    </div>
    
    ${files
      .map((file) => {
        const content = fs.readFileSync(path.join(testDataDir, file), "utf8");

        // Extract expected line number from filename
        const match = file.match(/^(\S+)-to-line-(\d+)\.ledger$/);
        const expectedLine = match ? parseInt(match[2]) : null;
        const testName = match ? match[1].replace(/-/g, " ") : file;

        // Split content into lines and highlight the expected line
        const lines = content.split("\n");
        const highlightedContent = lines
          .map((line, index) => {
            const lineNumber = index + 1; // Convert to 1-based
            const escaped = escapeHtml(line);

            if (expectedLine && lineNumber === expectedLine) {
              // For blank lines, show a visible placeholder
              const displayContent =
                escaped.trim() === ""
                  ? "⌐ (expected cursor position)"
                  : escaped;
              return `<span class="highlighted-line">${displayContent}</span>`;
            }
            return `<span class="normal-line">${escaped}</span>`;
          })
          .join("");

        return `
        <div class="file">
          <div class="file-header">${file}</div>
          ${expectedLine ? `<div class="file-description">Expected cursor position: Line ${expectedLine} (${testName})</div>` : ""}
          <div class="file-content">${highlightedContent}</div>
        </div>
      `;
      })
      .join("")}

</body>
</html>`;

  const outputFile = path.join(outputDir, "nowMarker.html");
  fs.writeFileSync(outputFile, html, "utf8");
  return { name: "Now Marker", testCases: files.length, outputFile };
}

if (require.main === module) {
  const testDataDir =
    process.argv[2] || path.join(__dirname, "../data/nowMarker");
  const outputDir = process.argv[3] || path.join(__dirname, "../preview");

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const result = generateNowMarkerHTML(testDataDir, outputDir);
  console.log(
    `Generated ${result.name}: ${result.testCases} test cases -> ${result.outputFile}`,
  );
}
