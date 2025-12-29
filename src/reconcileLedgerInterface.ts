// Interface to the ledger CLI for reconciliation data extraction
// Gets accounts, uncleared transactions, and balance information

import { spawn } from "child_process";
import * as vscode from "vscode";
import { SExpParser, SExpValue } from "./sexpParser";

export interface LedgerPosting {
  account: string;
  amount: string;
  status: "" | "!" | "*";
  lineNumber: number;
}

export interface ReconciliationEntry {
  date: string;
  description: string;
  lineNumber: number;
  checkCode: string;
  accountPostings: LedgerPosting[];
}

export class ReconcileLedgerInterface {
  private ledgerPath: string;
  private sexpParser: SExpParser;

  constructor(private ledgerFile: string) {
    this.ledgerPath = vscode.workspace
      .getConfiguration("ledger")
      .get("executablePath", "ledger");
    this.sexpParser = new SExpParser();
  }

  private runLedgerCommand(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const fullArgs = [
        "-f",
        this.ledgerFile,
        "--no-aliases",
        "--no-pager",
        "--price-db",
        "/dev/null",
        ...args,
      ];
      const ledger = spawn(this.ledgerPath, fullArgs);

      let stdout = "";
      let stderr = "";

      ledger.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      ledger.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      ledger.on("close", (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Ledger exited with code ${code}: ${stderr}`));
        }
      });

      ledger.on("error", (error) => {
        reject(error);
      });
    });
  }

  async getAccounts(): Promise<string[]> {
    try {
      const output = await this.runLedgerCommand(["accounts"]);
      const accounts = output
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
      return accounts.sort();
    } catch {
      return [];
    }
  }

  async getUnclearedTransactionsForAccount(
    account: string,
  ): Promise<ReconciliationEntry[]> {
    try {
      const output = await this.runLedgerCommand([
        "--uncleared",
        "emacs",
        account,
      ]);
      return this.parseLedgerEmacsOutput(output);
    } catch {
      return [];
    }
  }

  async getClearedAndPendingBalance(account: string): Promise<string> {
    try {
      const output = await this.runLedgerCommand([
        "--limit",
        "cleared or pending",
        "balance",
        account,
      ]);
      const lines = output.trim().split("\n");
      if (lines.length > 0 && lines[0].trim()) {
        const parts = lines[0].trim().split(/\s+/);
        if (parts.length > 0) {
          return parts[0];
        }
      }
      return "$0.00";
    } catch {
      return "$0.00";
    }
  }

  private parseLedgerEmacsOutput(output: string): ReconciliationEntry[] {
    const transactions: ReconciliationEntry[] = [];

    if (!output.trim()) {
      return transactions;
    }

    // Normalize whitespace and parse
    const normalized = output.split(/\s+/).join(" ");

    if (!normalized.startsWith("(")) {
      return transactions;
    }

    const parsed = this.sexpParser.parse(normalized);
    if (!parsed || !Array.isArray(parsed)) {
      return transactions;
    }

    // Each top-level element is a transaction
    for (const transactionData of parsed) {
      if (Array.isArray(transactionData) && transactionData.length >= 5) {
        const transaction = this.createTransactionFromData(transactionData);
        if (transaction) {
          transactions.push(transaction);
        }
      }
    }

    return transactions;
  }

  private createTransactionFromData(
    data: SExpValue[],
  ): ReconciliationEntry | null {
    try {
      if (data.length < 5) {
        return null;
      }

      const lineNumber = data[1] as number;

      // Date is (high low microseconds) - convert to string
      const dateInfo = data[2];
      let date: string;
      if (Array.isArray(dateInfo) && dateInfo.length >= 2) {
        const seconds =
          (dateInfo[0] as number) * 65536 + (dateInfo[1] as number);
        const dt = new Date(seconds * 1000);
        date = `${dt.getFullYear()}/${String(dt.getMonth() + 1).padStart(2, "0")}/${String(dt.getDate()).padStart(2, "0")}`;
      } else {
        date = "2024/01/01";
      }

      const description = (data[4] as string) || "";
      const checkCode = (data[3] as string) || "";

      // Parse postings
      const postings: LedgerPosting[] = [];
      for (let i = 5; i < data.length; i++) {
        const postingData = data[i];
        if (Array.isArray(postingData) && postingData.length >= 3) {
          const status = this.convertStatus(postingData[3]);
          postings.push({
            account: (postingData[1] as string) || "",
            amount: (postingData[2] as string) || "",
            status,
            lineNumber: (postingData[0] as number) || 0,
          });
        }
      }

      return {
        date,
        description,
        lineNumber,
        checkCode,
        accountPostings: postings,
      };
    } catch {
      return null;
    }
  }

  private convertStatus(ledgerStatus: SExpValue): "" | "!" | "*" {
    if (!ledgerStatus) {
      return "";
    }
    if (ledgerStatus === "pending") {
      return "!";
    }
    if (ledgerStatus === "cleared") {
      return "*";
    }
    return "";
  }
}
