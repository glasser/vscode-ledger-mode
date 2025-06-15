// Interface to the ledger binary for executing commands
// Provides methods to validate files and generate balance reports

import { spawn, SpawnOptionsWithoutStdio } from "child_process";
import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

export interface LedgerError {
  message: string;
  line?: number;
  column?: number;
  severity: "error" | "warning";
}

export interface LedgerCommandResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
}

export class LedgerCommandError extends Error {
  constructor(
    message: string,
    public result: LedgerCommandResult,
  ) {
    super(message);
    this.name = "LedgerCommandError";
  }
}

export interface BalanceReporter {
  getBalanceReport(filePath: string): Promise<string>;
}

export class LedgerCli {
  private ledgerPath: string;

  constructor() {
    this.ledgerPath = vscode.workspace
      .getConfiguration("ledger")
      .get("executablePath", "ledger");
  }

  private async runLedgerCommand(
    args: string[],
    filePath: string,
    options?: SpawnOptionsWithoutStdio,
  ): Promise<LedgerCommandResult> {
    return new Promise((resolve, reject) => {
      const fullArgs = ["-f", filePath, "--no-color", ...args];
      const ledger = spawn(this.ledgerPath, fullArgs, options);

      let stdout = "";
      let stderr = "";

      ledger.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      ledger.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      ledger.on("close", (code) => {
        resolve({
          success: code === 0,
          stdout,
          stderr,
          exitCode: code || 0,
        });
      });

      /* c8 ignore next 3 */
      ledger.on("error", (error) => {
        reject(error);
      });
    });
  }

  private createLedgerError(
    message: string,
    result: LedgerCommandResult,
  ): LedgerCommandError {
    return new LedgerCommandError(message, result);
  }

  private async runLedgerCommandOrThrow(
    args: string[],
    filePath: string,
    options?: SpawnOptionsWithoutStdio,
  ): Promise<string> {
    const result = await this.runLedgerCommand(args, filePath, options);
    if (!result.success) {
      throw this.createLedgerError(
        `Ledger command failed (code ${result.exitCode}): ${result.stderr}`,
        result,
      );
    }
    return result.stdout;
  }

  async validateFile(filePath: string): Promise<LedgerError[]> {
    const result = await this.runLedgerCommand(["balance"], filePath);
    if (result.success) {
      return [];
    }

    // Parse errors directly from stderr - no need for text extraction
    return this.parseErrors(result.stderr);
  }

  async getBalanceReport(filePath: string): Promise<string> {
    // Use David's custom balance report format from emacs config
    const priceDb = await this.extractPriceDbPath(filePath);
    const args = [];

    // Only add price-db argument if the file exists
    // For relative paths, resolve them relative to the ledger file directory
    /* c8 ignore next 6 */
    const priceDbPath = path.isAbsolute(priceDb)
      ? priceDb
      : path.resolve(path.dirname(filePath), priceDb);

    if (await this.fileExists(priceDbPath)) {
      args.push("--price-db", priceDbPath); // Use the resolved absolute path, not the relative one
      /* c8 ignore next */
    }

    args.push(
      "--force-color",
      "-X",
      "$",
      "-s",
      "--real",
      "bal",
      "not",
      "^Income",
      "and",
      "not",
      "^Expense",
    );

    try {
      return await this.runLedgerCommandOrThrow(args, filePath);
    } catch (error) {
      throw new Error(`Failed to generate balance report: ${error}`);
    }
  }

  /* c8 ignore next 8 */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async extractPriceDbPath(filePath: string): Promise<string> {
    try {
      const content = fs.readFileSync(filePath, "utf8");
      const lines = content.split("\n");

      // Look for comment directive: ; price-db: path/to/prices
      /* c8 ignore next 12 */
      for (const line of lines.slice(0, 20)) {
        // Check first 20 lines
        const match = line.match(/^\s*;\s*price-db:\s*(.+)$/);
        if (match) {
          return match[1].trim();
        }
      }

      // Default to 'prices' if no directive found
      return "prices";
    } catch (error) {
      // If file can't be read, use default
      return "prices";
    }
  }

  parseErrors(errorOutput: string): LedgerError[] {
    const errors: LedgerError[] = [];
    const lines = errorOutput.split("\n");
    const processedLines = new Set<number>();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim().length === 0 || processedLines.has(i)) {
        continue;
      }

      // Try to parse ledger balance error format: 'While parsing file "filename", line X:'
      const ledgerMatch = line.match(
        /^While parsing file "([^"]+)", line (\d+):/,
      );
      if (ledgerMatch) {
        // Look ahead for the actual error message and balance details
        let errorMessage = "Transaction error";
        let unbalancedRemainder = "";

        for (let j = i + 1; j < lines.length; j++) {
          const nextLine = lines[j];

          if (
            nextLine.startsWith("Unbalanced remainder is:") &&
            j + 1 < lines.length
          ) {
            unbalancedRemainder = lines[j + 1].trim();
            processedLines.add(j); // Mark this line as processed
            processedLines.add(j + 1); // Mark the amount line as processed
          } else if (
            nextLine.startsWith("Amount to balance against:") &&
            j + 1 < lines.length
          ) {
            // Skip amount to balance line - not currently used in error messages
            processedLines.add(j); // Mark this line as processed
            processedLines.add(j + 1); // Mark the amount line as processed
          } else if (nextLine.startsWith("Error:")) {
            errorMessage = nextLine.substring(6).trim();

            // If this is a balance error and we have the amounts, enhance the message
            if (
              errorMessage === "Transaction does not balance" &&
              unbalancedRemainder
            ) {
              errorMessage = `Transaction does not balance (off by ${unbalancedRemainder})`;
            }
            processedLines.add(j); // Mark the Error: line as processed
            break;
          } else if (
            nextLine.startsWith("While balancing transaction") ||
            nextLine.startsWith(">")
          ) {
            processedLines.add(j); // Mark transaction details as processed
          }
        }

        errors.push({
          message: errorMessage,
          line: parseInt(ledgerMatch[2]) - 1, // VSCode uses 0-based line numbers
          severity: "error",
        });
        continue;
      }

      // Try to parse error format: "filename:line:column: Error: message"
      const match = line.match(
        /^([^:]+):(\d+):(\d+):\s*(Error|Warning):\s*(.+)$/,
      );
      if (match) {
        errors.push({
          message: match[5],
          line: parseInt(match[2]) - 1, // VSCode uses 0-based line numbers
          column: parseInt(match[3]) - 1,
          severity:
            match[4].toLowerCase() === "error"
              ? "error"
              : /* c8 ignore next */ "warning",
        });
      } else {
        // Try simpler format: "filename:line: Error: message"
        const simpleMatch = line.match(
          /^([^:]+):(\d+):\s*(Error|Warning):\s*(.+)$/,
        );
        /* c8 ignore next 7 */
        if (simpleMatch) {
          errors.push({
            message: simpleMatch[4],
            line: parseInt(simpleMatch[2]) - 1,
            severity:
              simpleMatch[3].toLowerCase() === "error" ? "error" : "warning",
          });
        } else if (line.includes("Error:") || line.includes("Warning:")) {
          // Fallback for unstructured error messages
          errors.push({
            message: line,
            severity: line.includes("Warning:")
              ? /* c8 ignore next */ "warning"
              : "error",
          });
        }
      }
    }

    return errors;
  }

  async isLedgerAvailable(): Promise<boolean> {
    try {
      const result = await this.runLedgerCommand(["--version"], "");
      return result.success;
      /* c8 ignore next 3 */
    } catch {
      return false;
    }
  }
}
