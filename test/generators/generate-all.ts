#!/usr/bin/env node

// Master generator that creates HTML previews for ALL test fixture directories
// Uses Handlebars templates for consistent, maintainable HTML generation

import * as fs from "fs";
import * as path from "path";

// Import template generator
import { generateFromTemplate } from "./template-generator";

function hasFilesRecursively(dirPath: string): boolean {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isFile()) {
        return true;
      } else if (entry.isDirectory()) {
        const subdirPath = path.join(dirPath, entry.name);
        if (hasFilesRecursively(subdirPath)) {
          return true;
        }
      }
    }
    return false;
  } catch (e) {
    return false;
  }
}

interface TemplateConfig {
  name: string;
  title: string;
  description: string;
  dataDir: string;
}

// Define template configurations with their descriptions
const templateConfigs: TemplateConfig[] = [
  {
    name: "balance-quick-fix",
    title: "Balance Quick Fix",
    description:
      "Quick fix functionality for small balance errors that adds rounding postings",
    dataDir: "balance-quick-fix",
  },
  {
    name: "balance-report-ansi-colors",
    title: "Balance Report ANSI Colors",
    description:
      "ANSI color code conversion from ledger balance reports to HTML",
    dataDir: "balance-report-ansi-colors",
  },
  {
    name: "error-formatting",
    title: "Error Formatting",
    description: "Transformation of raw ledger error output into styled HTML",
    dataDir: "error-formatting",
  },
  {
    name: "format",
    title: "Ledger Formatting",
    description: "Input and expected output for ledger file formatting",
    dataDir: "format",
  },
  {
    name: "organize-ledger",
    title: "Ledger Organization",
    description: "Input and expected output for ledger file organization",
    dataDir: "organize-ledger",
  },
  {
    name: "completion-provider",
    title: "Completion Provider",
    description: "Autocompletion test cases with configurations",
    dataDir: "completion-provider",
  },
  {
    name: "syntax",
    title: "Syntax Highlighting",
    description: "TextMate grammar test files for syntax highlighting",
    dataDir: "syntax",
  },
  {
    name: "transaction-completion",
    title: "Transaction Completion",
    description:
      "Transaction completion test cases with input, expected output, and configuration",
    dataDir: "transaction-completion",
  },
  {
    name: "ledger-cli",
    title: "Ledger CLI",
    description:
      "Ledger CLI validation test cases with files and expected error outputs",
    dataDir: "ledger-cli",
  },
  {
    name: "toggle-reconciliation",
    title: "Toggle Reconciliation",
    description:
      "Reconciliation toggle test cases with cursor positioning and expected changes",
    dataDir: "toggle-reconciliation",
  },
  {
    name: "tokenization",
    title: "Tokenization",
    description:
      "Transaction and posting parsing test cases with input/expected pairs",
    dataDir: "tokenization",
  },
  {
    name: "nowMarker",
    title: "Now Marker",
    description:
      "Test files for 'jump to now' functionality with expected cursor positions",
    dataDir: "nowMarker",
  },
  {
    name: "recurring",
    title: "Recurring Transactions",
    description:
      "Recurring transaction generation from RECUR comments with various periods",
    dataDir: "recurring",
  },
  {
    name: "indentation",
    title: "Indentation",
    description:
      "Automatic indentation behavior when pressing Enter on transaction lines",
    dataDir: "indentation",
  },
  {
    name: "date-parsing",
    title: "Date Parsing",
    description:
      "Date parsing test cases including single integer parsing as most recent day of month",
    dataDir: "date-parsing",
  },
];

function hasTemplate(dataDir: string): boolean {
  const templatePath = path.join(dataDir, "template.hbs");
  return fs.existsSync(templatePath);
}

function generateAllHTML() {
  const testDataDir = path.join(__dirname, "../data");
  const outputDir = path.join(__dirname, "../preview");

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Generate HTML for each test data type using templates
  const results: any[] = [];

  for (const config of templateConfigs) {
    const dataPath = path.join(testDataDir, config.dataDir);

    if (fs.existsSync(dataPath)) {
      if (hasTemplate(dataPath)) {
        console.log(`Generating ${config.title}...`);

        const result = generateFromTemplate(dataPath, outputDir, config.title);
        results.push({ ...config, ...result });
      } else {
        console.log(
          `Skipping ${config.title} - no template found at: ${path.join(dataPath, "template.hbs")}`,
        );
      }
    } else {
      console.log(
        `Skipping ${config.title} - directory not found: ${dataPath}`,
      );
    }
  }

  // Check for unconfigured directories with files
  const allDataDirs = fs
    .readdirSync(testDataDir, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);

  const configuredDirs = templateConfigs.map((g) => g.dataDir);
  const unconfiguredDirs = allDataDirs.filter(
    (dir) => !configuredDirs.includes(dir),
  );

  // Check if any unconfigured directories have files
  for (const dir of unconfiguredDirs) {
    const dataPath = path.join(testDataDir, dir);
    const hasFiles = hasFilesRecursively(dataPath);
    if (hasFiles) {
      throw new Error(
        `Found unconfigured directory with files: ${dir}\n` +
          `Please add a template configuration for this directory to the templateConfigs array in generate-all.ts`,
      );
    }
  }

  // Sort results alphabetically by fixture directory name
  results.sort((a, b) => a.name.localeCompare(b.name));

  // Generate index.html
  const indexHtml = `<!DOCTYPE html>
<html>
<head>
    <title>VSCode Ledger Mode - Test Fixture Previews</title>
    <style>
        body { 
            font-family: Arial, sans-serif; 
            margin: 40px auto; 
            max-width: 1200px;
            line-height: 1.6;
            background-color: #ffffff;
            color: #333333;
        }
        h1 {
            color: #333;
            border-bottom: 3px solid #0066cc;
            padding-bottom: 15px;
            margin-bottom: 30px;
        }
        .intro {
            background-color: #e8f4f8;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 40px;
            border-left: 5px solid #0066cc;
        }
        .generator-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
        }
        .generator-card {
            border: 1px solid #ddd;
            border-radius: 8px;
            overflow: hidden;
            transition: box-shadow 0.2s ease;
        }
        .generator-card:hover {
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .card-header {
            background-color: #f5f5f5;
            padding: 15px;
            border-bottom: 1px solid #ddd;
        }
        .card-title {
            margin: 0 0 8px 0;
            font-size: 18px;
            font-weight: bold;
        }
        .card-title a {
            color: #0066cc;
            text-decoration: none;
        }
        .card-title a:hover {
            text-decoration: underline;
        }
        .card-stats {
            color: #666;
            font-size: 14px;
        }
        .card-body {
            padding: 15px;
        }
        .card-description {
            color: #555;
            margin: 0;
        }
        .footer {
            text-align: center;
            padding: 20px;
            border-top: 1px solid #ddd;
            margin-top: 40px;
            color: #666;
        }
        .stats-summary {
            background-color: #f0f8f0;
            padding: 15px;
            border-radius: 6px;
            margin-bottom: 30px;
            border-left: 4px solid #28a745;
        }
        .stats-summary h3 {
            margin-top: 0;
            color: #28a745;
        }
    </style>
</head>
<body>
    <h1>🧾 VSCode Ledger Mode - Test Fixture Previews</h1>
    
    <div class="intro">
        <h2 style="margin-top: 0;">📋 About This Preview</h2>
        <p>This directory contains HTML previews of all test fixture data used by the VSCode Ledger Mode extension. Each preview shows the test inputs, expected outputs, and configurations in an easy-to-read format.</p>
        <p><strong>🎯 Purpose:</strong> These previews help developers understand test cases, verify formatting, and ensure test data quality.</p>
    </div>
    
    <div class="stats-summary">
        <h3>📊 Test Coverage Summary</h3>
        <ul>
            <li><strong>Total test fixture types:</strong> ${results.length}</li>
            <li><strong>Total test cases:</strong> ${results.reduce((sum: number, r: any) => sum + r.testCases, 0)}</li>
        </ul>
    </div>
    
    <div class="generator-grid">
        ${results
          .map(
            (result: any) => `
            <div class="generator-card">
                <div class="card-header">
                    <h3 class="card-title">
                        <a href="${path.basename(result.outputFile)}">${result.title}</a>
                    </h3>
                    <div class="card-stats">${result.testCases} test case${result.testCases !== 1 ? "s" : ""}</div>
                </div>
                <div class="card-body">
                    <p class="card-description">${result.description}</p>
                </div>
            </div>
        `,
          )
          .join("")}
    </div>
    
    <div class="footer">
        <p>🤖 Generated automatically by the VSCode Ledger Mode test fixture preview system</p>
        <p><strong>Command:</strong> <code>npm run preview:generate</code></p>
    </div>
</body>
</html>`;

  const indexFile = path.join(outputDir, "index.html");
  fs.writeFileSync(indexFile, indexHtml, "utf8");

  console.log("\\n✅ Generation complete!");
  console.log(`📁 Output directory: ${outputDir}`);
  console.log(`📄 Index file: ${indexFile}`);
  console.log(
    `🎯 Generated ${results.length} preview files covering ${results.reduce((sum: number, r: any) => sum + r.testCases, 0)} test cases`,
  );

  results.forEach((result: any) => {
    console.log(`   • ${result.title}: ${result.testCases} test cases`);
  });

  return { results, indexFile, outputDir };
}

export { generateAllHTML };

if (require.main === module) {
  generateAllHTML();
}
