// Template-based generator that creates HTML previews using Handlebars templates
// This replaces the individual hardcoded generators with a template system

import * as fs from "fs";
import * as path from "path";
import * as Handlebars from "handlebars";

// Read CSS files directly from assets directory
const cssAssetsDir = path.join(__dirname, "..", "..", "assets");
const ANSI_COLORS_CSS = fs.readFileSync(
  path.join(cssAssetsDir, "ansi-colors.css"),
  "utf8",
);
const ERROR_FORMATTING_CSS = fs.readFileSync(
  path.join(cssAssetsDir, "error-formatting.css"),
  "utf8",
);

// Helper function to escape HTML
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Helper function to make trailing spaces visible
function showTrailingSpaces(text: string): string {
  // First escape HTML
  const escaped = escapeHtml(text);
  // Split into lines to handle each line separately
  return escaped.split('\n').map(line => {
    // Replace trailing spaces with visible marker
    return line.replace(/( +)$/g, (match) => {
      return '<span style="background-color: #ffcccc; border: 1px solid #ff6666;">·' + '·'.repeat(match.length - 1) + '</span>';
    });
  }).join('\n');
}

// Register common Handlebars helpers that are used across multiple templates
Handlebars.registerHelper("escapeHtml", escapeHtml);
Handlebars.registerHelper("showTrailingSpaces", (text: string) => {
  return new Handlebars.SafeString(showTrailingSpaces(text));
});
Handlebars.registerHelper("raw", (content: string) => {
  return new Handlebars.SafeString(content || "");
});

// Helper to include CSS content
Handlebars.registerHelper("ansiColorsCss", () => {
  return new Handlebars.SafeString(ANSI_COLORS_CSS);
});

Handlebars.registerHelper("errorFormattingCss", () => {
  return new Handlebars.SafeString(ERROR_FORMATTING_CSS);
});

// Helper to convert strings to title case (handles hyphenated names)
Handlebars.registerHelper("titleCase", (str: any) => {
  if (!str || typeof str !== "string") {
    return str;
  }
  return str
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
});

// Helper to match strings
Handlebars.registerHelper("match", (str: string, pattern: string) => {
  return str && str.includes(pattern);
});

// Helper to lookup test cases from the map
Handlebars.registerHelper("lookup", (obj: any, key: string) => {
  if (!obj || typeof obj !== "object") {
    return undefined;
  }
  return obj[key];
});

// Logical helpers used by multiple templates
Handlebars.registerHelper("or", (a: any, b: any) => {
  return a || b;
});

Handlebars.registerHelper("and", (a: any, b: any) => {
  return !!(a && b);
});

Handlebars.registerHelper("join", (array: string[], separator: string) => {
  if (!Array.isArray(array)) {
    return "";
  }
  return array.join(separator);
});

Handlebars.registerHelper("exists", (value: any) => {
  return value !== undefined && value !== null;
});

// Math helper for template calculations
Handlebars.registerHelper(
  "math",
  (lvalue: number, operator: string, rvalue: number) => {
    if (operator === "+") {
      return lvalue + rvalue;
    } else if (operator === "-") {
      return lvalue - rvalue;
    }
    return lvalue;
  },
);

interface TestCase {
  name: string;
  [key: string]: any;
}

interface TemplateData {
  title: string;
  testCases: TestCase[];
  summary?: string;
  totalTestCases?: number;
  [key: string]: any;
}

function findTemplateFile(testDataDir: string): string | null {
  const templatePath = path.join(testDataDir, "template.hbs");
  if (fs.existsSync(templatePath)) {
    return templatePath;
  }
  return null;
}

function loadTemplateHelpers(testDataDir: string): void {
  const helpersPath = path.join(testDataDir, "template-helpers.ts");
  if (fs.existsSync(helpersPath)) {
    try {
      // Use require to load the TypeScript file directly
      // Note: This requires ts-node to be available
      delete require.cache[require.resolve(helpersPath)];
      const helpers = require(helpersPath);

      // Register all exported functions as Handlebars helpers
      Object.keys(helpers).forEach((helperName) => {
        if (typeof helpers[helperName] === "function") {
          Handlebars.registerHelper(helperName, helpers[helperName]);
        }
      });

      console.log(`Loaded template helpers from ${helpersPath}`);
    } catch (error) {
      console.warn(
        `Could not load template helpers from ${helpersPath}:`,
        error,
      );
    }
  }
}

function loadTestCases(testDataDir: string): TestCase[] {
  const testCases: TestCase[] = [];

  try {
    const entries = fs.readdirSync(testDataDir, { withFileTypes: true });

    // First, check for file-based test cases (pattern: {name}-input.txt, {name}-expected.html)
    const files = entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name);
    const testNames = [
      ...new Set(
        files
          .filter(
            (f) => f.endsWith("-input.txt") || f.endsWith("-expected.html"),
          )
          .map((f) => f.replace(/-(?:input\.txt|expected\.html)$/, "")),
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
            .split("-")
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" "),
          input,
          expected,
        });
      }
    }

    // Check for JSON files directly in the directory (pattern: {name}.json)
    const jsonFiles = files.filter(
      (f) => f.endsWith(".json") && !f.includes("data.test"),
    );
    for (const jsonFile of jsonFiles) {
      const testName = path.basename(jsonFile, ".json");
      const jsonPath = path.join(testDataDir, jsonFile);

      try {
        const jsonContent = fs.readFileSync(jsonPath, "utf8");
        const jsonData = JSON.parse(jsonContent);

        testCases.push({
          name: testName,
          title: testName
            .split("-")
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" "),
          ...jsonData,
        });
      } catch (error) {
        console.warn(`Could not parse JSON file ${jsonPath}:`, error);
      }
    }

    // Check for ledger files directly in the directory (pattern: {name}.ledger)
    const ledgerFiles = files.filter(
      (f) => f.endsWith(".ledger") && !f.includes("data.test"),
    );
    for (const ledgerFile of ledgerFiles) {
      const testName = path.basename(ledgerFile, ".ledger");
      const ledgerPath = path.join(testDataDir, ledgerFile);

      try {
        const content = fs.readFileSync(ledgerPath, "utf8");

        testCases.push({
          name: testName,
          title: testName
            .split("-")
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" "),
          content,
          file: ledgerFile,
        });
      } catch (error) {
        console.warn(`Could not read ledger file ${ledgerPath}:`, error);
      }
    }

    // If no file-based test cases found, try directory-based approach
    if (testCases.length === 0) {
      const testCaseMap: any = {};

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const subdirPath = path.join(testDataDir, entry.name);

          // Check for testCases subdirectory
          const testCasesDir = path.join(subdirPath, "testCases");
          if (fs.existsSync(testCasesDir)) {
            // Load test cases from testCases directory
            const testCaseEntries = fs.readdirSync(testCasesDir, {
              withFileTypes: true,
            });
            for (const testCaseEntry of testCaseEntries) {
              if (testCaseEntry.isDirectory()) {
                const testCasePath = path.join(
                  testCasesDir,
                  testCaseEntry.name,
                );
                const testCase = loadTestCaseFromDirectory(testCasePath);
                if (testCase) {
                  testCaseMap[testCaseEntry.name] = testCase;
                  testCases.push(testCase);
                }
              }
            }
          } else {
            // Load test case directly from subdirectory
            const testCase = loadTestCaseFromDirectory(subdirPath);
            if (testCase) {
              testCaseMap[entry.name] = testCase;
              testCases.push(testCase);
            }
          }
        }
      }

      // For directory-based test cases, store the map but still return array
      // We'll pass the map via the template data
      if (Object.keys(testCaseMap).length > 0) {
        (testCases as any).testCaseMap = testCaseMap;
      }
    }
  } catch (error) {
    console.warn(
      `Warning: Could not load test cases from ${testDataDir}:`,
      error,
    );
  }

  return testCases;
}

function loadTestCaseFromDirectory(dirPath: string): TestCase | null {
  const testCase: TestCase = {
    name: path.basename(dirPath),
    title: path
      .basename(dirPath)
      .replace(/-/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase()),
  };

  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isFile()) {
        const filePath = path.join(dirPath, entry.name);
        const ext = path.extname(entry.name);
        const baseName = path.basename(entry.name, ext);

        if (ext === ".json") {
          try {
            const content = fs.readFileSync(filePath, "utf8");
            testCase[baseName] = JSON.parse(content);
          } catch (e) {
            console.warn(`Could not parse JSON file ${filePath}:`, e);
          }
        } else if (ext === ".yaml" || ext === ".yml") {
          try {
            const yaml = require("js-yaml");
            const content = fs.readFileSync(filePath, "utf8");
            testCase[baseName] = yaml.load(content);
            testCase[baseName + "Yaml"] = content; // Keep original YAML text too
          } catch (e) {
            console.warn(`Could not parse YAML file ${filePath}:`, e);
          }
        } else {
          // Read as text
          const content = fs.readFileSync(filePath, "utf8");
          testCase[baseName] = content;
        }
      }
    }
  } catch (error) {
    console.warn(`Warning: Could not load test case from ${dirPath}:`, error);
    return null;
  }

  return Object.keys(testCase).length > 1 ? testCase : null;
}

export function generateFromTemplate(
  testDataDir: string,
  outputDir: string,
  title: string,
): { name: string; testCases: number; outputFile: string } {
  const templateFile = findTemplateFile(testDataDir);
  if (!templateFile) {
    throw new Error(`No template.hbs found in ${testDataDir}`);
  }

  // Load template-specific helpers if they exist
  loadTemplateHelpers(testDataDir);

  const templateContent = fs.readFileSync(templateFile, "utf8");
  const template = Handlebars.compile(templateContent);

  const testCases = loadTestCases(testDataDir);

  const templateData: TemplateData = {
    title,
    testCases,
    totalTestCases: testCases.length,
    summary: `Test cases for ${title.toLowerCase()} functionality`,
  };

  // Add test case map if available for directory-based test cases
  if ((testCases as any).testCaseMap) {
    (templateData as any).testCaseMap = (testCases as any).testCaseMap;
  }

  const html = template(templateData);

  const outputFileName = `${path.basename(testDataDir)}.html`;
  const outputFile = path.join(outputDir, outputFileName);

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputFile, html, "utf8");

  return {
    name: path.basename(testDataDir),
    testCases: testCases.length,
    outputFile,
  };
}

// If run directly, generate all templates
if (require.main === module) {
  const testDataDir = path.join(__dirname, "../data");
  const outputDir = path.join(__dirname, "../preview");

  const directories = fs
    .readdirSync(testDataDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  for (const dir of directories) {
    const fullPath = path.join(testDataDir, dir);
    const templateFile = findTemplateFile(fullPath);

    if (templateFile) {
      try {
        const title =
          dir
            .split("-")
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ") + " Test Cases";

        const result = generateFromTemplate(fullPath, outputDir, title);
        console.log(
          `Generated ${result.outputFile} with ${result.testCases} test cases`,
        );
      } catch (error) {
        console.error(`Error generating ${dir}:`, error);
      }
    }
  }
}
