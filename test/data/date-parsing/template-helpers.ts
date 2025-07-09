// Template helpers for date parsing tests
import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";

export function isNumeric(value: string): boolean {
  return /^\d+$/.test(value);
}

export function includes(str: string, substring: string): boolean {
  return str.includes(substring);
}

export function eq(a: string, b: string): boolean {
  return a === b;
}

export function and(...args: any[]): boolean {
  // Remove the last argument which is the Handlebars options object
  const conditions = args.slice(0, -1);
  return conditions.every(Boolean);
}

export function not(value: any): boolean {
  return !value;
}

export function loadTestCases(dataDir: string) {
  const testCases = [];
  const dirs = fs
    .readdirSync(dataDir)
    .filter((f) => fs.statSync(path.join(dataDir, f)).isDirectory());

  for (const dir of dirs) {
    const configPath = path.join(dataDir, dir, "config.yaml");
    if (fs.existsSync(configPath)) {
      const config = yaml.load(fs.readFileSync(configPath, "utf8"));
      testCases.push({
        name: dir.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
        config: config,
      });
    }
  }

  return testCases;
}
