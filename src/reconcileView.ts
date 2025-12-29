// WebView panel for reconciliation UI
// Displays uncleared transactions and allows toggling status

import * as vscode from "vscode";
import {
  ReconcileLedgerInterface,
  ReconciliationEntry,
} from "./reconcileLedgerInterface";
import { ReconcileFileEditor } from "./reconcileFileEditor";
import { parseBalance, formatBalance } from "./reconcileBalanceParser";

interface ReconcileState {
  account: string;
  targetBalance: number | null;
  transactions: ReconciliationEntry[];
  clearedPendingBalance: string;
  filePath: string;
}

/* c8 ignore start - WebView UI code that requires interactive testing */
export class ReconcileViewProvider {
  private panel: vscode.WebviewPanel | undefined;
  private state: ReconcileState | undefined;
  private fileWatcher: vscode.FileSystemWatcher | undefined;

  constructor(private context: vscode.ExtensionContext) {}

  async show(filePath: string, account?: string) {
    // If no account provided, let user pick one
    if (!account) {
      const ledgerInterface = new ReconcileLedgerInterface(filePath);
      const accounts = await ledgerInterface.getAccounts();

      if (accounts.length === 0) {
        vscode.window.showErrorMessage("No accounts found in ledger file");
        return;
      }

      const selectedAccount = await vscode.window.showQuickPick(accounts, {
        placeHolder: "Select account to reconcile",
      });

      if (!selectedAccount) {
        return;
      }

      account = selectedAccount;
    }

    // Initialize state
    this.state = {
      account,
      targetBalance: null,
      transactions: [],
      clearedPendingBalance: "$0.00",
      filePath,
    };

    // Create or reveal panel
    if (!this.panel) {
      this.panel = vscode.window.createWebviewPanel(
        "ledgerReconcile",
        `Reconcile: ${account}`,
        vscode.ViewColumn.Beside,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
        },
      );

      this.panel.onDidDispose(
        () => {
          this.panel = undefined;
          this.disposeWatcher();
        },
        null,
        this.context.subscriptions,
      );

      this.panel.webview.onDidReceiveMessage(
        (message) => this.handleMessage(message),
        undefined,
        this.context.subscriptions,
      );
    }

    // Set up file watcher
    this.setupFileWatcher(filePath);

    // Load initial data and update UI
    await this.refresh();
  }

  private setupFileWatcher(filePath: string) {
    this.disposeWatcher();

    const uri = vscode.Uri.file(filePath);
    this.fileWatcher = vscode.workspace.createFileSystemWatcher(uri.fsPath);

    this.fileWatcher.onDidChange(() => this.refresh());
    this.fileWatcher.onDidCreate(() => this.refresh());
    this.fileWatcher.onDidDelete(() => {
      if (this.panel) {
        this.panel.webview.html = this.getErrorHtml("Ledger file was deleted");
      }
    });

    this.context.subscriptions.push(this.fileWatcher);
  }

  private disposeWatcher() {
    if (this.fileWatcher) {
      this.fileWatcher.dispose();
      this.fileWatcher = undefined;
    }
  }

  private async refresh() {
    if (!this.panel || !this.state) {
      return;
    }

    try {
      const ledgerInterface = new ReconcileLedgerInterface(this.state.filePath);

      this.state.transactions =
        await ledgerInterface.getUnclearedTransactionsForAccount(
          this.state.account,
        );
      this.state.clearedPendingBalance =
        await ledgerInterface.getClearedAndPendingBalance(this.state.account);

      this.panel.webview.html = this.getHtml();
      this.panel.title = `Reconcile: ${this.state.account}`;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.panel.webview.html = this.getErrorHtml(errorMessage);
    }
  }

  private async handleMessage(message: {
    command: string;
    [key: string]: unknown;
  }) {
    if (!this.state) {
      return;
    }

    switch (message.command) {
      case "toggle": {
        const lineNumber = message.lineNumber as number;
        const currentStatus = message.currentStatus as "" | "!" | "*";
        const newStatus = currentStatus === "" ? "!" : "";

        const editor = new ReconcileFileEditor(this.state.filePath);
        const success = editor.updatePostingsStatus(
          [lineNumber],
          currentStatus,
          newStatus,
        );

        if (!success) {
          vscode.window.showErrorMessage("Failed to toggle posting status");
        }
        // File watcher will trigger refresh
        break;
      }

      case "reconcileAll": {
        // Find all pending postings and mark them as cleared
        const pendingPostings: number[] = [];
        for (const tx of this.state.transactions) {
          for (const posting of tx.accountPostings) {
            if (posting.status === "!") {
              pendingPostings.push(posting.lineNumber);
            }
          }
        }

        if (pendingPostings.length === 0) {
          vscode.window.showInformationMessage("No pending postings to clear");
          return;
        }

        const confirm = await vscode.window.showQuickPick(["Yes", "No"], {
          placeHolder: `Clear ${pendingPostings.length} pending posting(s)?`,
        });

        if (confirm !== "Yes") {
          return;
        }

        const editor = new ReconcileFileEditor(this.state.filePath);
        const success = editor.updatePostingsStatus(pendingPostings, "!", "*");

        if (!success) {
          vscode.window.showErrorMessage("Failed to clear pending postings");
        }
        break;
      }

      case "toggleAll": {
        // If any uncleared, mark all as pending; otherwise mark all as uncleared
        const unclearedPostings: number[] = [];
        const pendingPostings: number[] = [];

        for (const tx of this.state.transactions) {
          for (const posting of tx.accountPostings) {
            if (posting.status === "") {
              unclearedPostings.push(posting.lineNumber);
            } else if (posting.status === "!") {
              pendingPostings.push(posting.lineNumber);
            }
          }
        }

        const editor = new ReconcileFileEditor(this.state.filePath);
        if (unclearedPostings.length > 0) {
          // Mark all uncleared as pending
          editor.updatePostingsStatus(unclearedPostings, "", "!");
        } else if (pendingPostings.length > 0) {
          // Mark all pending as uncleared
          editor.updatePostingsStatus(pendingPostings, "!", "");
        }
        break;
      }

      case "openInEditor": {
        const lineNumber = message.lineNumber as number;
        const uri = vscode.Uri.file(this.state.filePath);
        const document = await vscode.workspace.openTextDocument(uri);
        const editorView = await vscode.window.showTextDocument(
          document,
          vscode.ViewColumn.One,
        );

        const position = new vscode.Position(lineNumber - 1, 0);
        editorView.selection = new vscode.Selection(position, position);
        editorView.revealRange(
          new vscode.Range(position, position),
          vscode.TextEditorRevealType.InCenter,
        );
        break;
      }

      case "setTarget": {
        const input = await vscode.window.showInputBox({
          prompt: "Enter target balance (e.g., $1,234.56)",
          value: this.state.targetBalance
            ? formatBalance(this.state.targetBalance)
            : "",
        });

        if (input !== undefined) {
          try {
            this.state.targetBalance = parseBalance(input);
            this.panel!.webview.html = this.getHtml();
          } catch {
            vscode.window.showErrorMessage("Invalid balance format");
          }
        }
        break;
      }

      case "switchAccount": {
        const ledgerInterface = new ReconcileLedgerInterface(
          this.state.filePath,
        );
        const accounts = await ledgerInterface.getAccounts();
        const selectedAccount = await vscode.window.showQuickPick(accounts, {
          placeHolder: "Select account to reconcile",
        });

        if (selectedAccount) {
          this.state.account = selectedAccount;
          this.state.targetBalance = null;
          await this.refresh();
        }
        break;
      }

      case "refresh":
        await this.refresh();
        break;
    }
  }

  private getHtml(): string {
    if (!this.state) {
      return this.getErrorHtml("No state");
    }

    const { account, targetBalance, transactions, clearedPendingBalance } =
      this.state;

    // Calculate delta if target is set
    let deltaHtml = "";
    if (targetBalance !== null) {
      const clearedAmount = parseBalance(clearedPendingBalance);
      const delta = targetBalance - clearedAmount;
      const deltaFormatted = formatBalance(delta);
      const deltaClass =
        Math.abs(delta) < 0.01 ? "delta-zero" : "delta-nonzero";
      deltaHtml = `<span class="${deltaClass}">Delta: ${deltaFormatted}</span>`;
    }

    // Build transaction rows
    const rows = transactions
      .map((tx) => {
        return tx.accountPostings
          .map((posting) => {
            const statusIcon = posting.status === "!" ? "!" : "·";
            const rowClass = posting.status === "!" ? "pending" : "";
            return `
            <tr class="${rowClass}" data-line="${posting.lineNumber}" data-status="${posting.status}">
              <td class="status">${statusIcon}</td>
              <td class="line">${tx.lineNumber}</td>
              <td class="date">${tx.date}</td>
              <td class="check">${tx.checkCode}</td>
              <td class="amount">${posting.amount}</td>
              <td class="description">${this.escapeHtml(tx.description)}</td>
            </tr>
          `;
          })
          .join("");
      })
      .join("");

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reconcile</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            margin: 0;
            padding: 10px;
        }
        .info-panel {
            margin-bottom: 15px;
            padding: 10px;
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border-radius: 4px;
        }
        .info-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 5px;
        }
        .info-row:last-child {
            margin-bottom: 0;
        }
        .delta-zero {
            color: var(--vscode-testing-iconPassed);
            font-weight: bold;
        }
        .delta-nonzero {
            color: var(--vscode-testing-iconFailed);
            font-weight: bold;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            font-family: var(--vscode-editor-font-family);
            font-size: var(--vscode-editor-font-size);
        }
        th, td {
            padding: 4px 8px;
            text-align: left;
            border-bottom: 1px solid var(--vscode-widget-border);
        }
        th {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            font-weight: bold;
        }
        tr:hover {
            background-color: var(--vscode-list-hoverBackground);
        }
        tr.pending {
            background-color: var(--vscode-diffEditor-insertedTextBackground);
        }
        tr.pending:hover {
            background-color: var(--vscode-diffEditor-insertedLineBackground);
        }
        .status {
            width: 20px;
            text-align: center;
            cursor: pointer;
        }
        .line {
            width: 50px;
        }
        .date {
            width: 90px;
        }
        .check {
            width: 60px;
        }
        .amount {
            width: 100px;
            text-align: right;
        }
        .toolbar {
            margin-top: 15px;
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
        }
        button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 6px 12px;
            cursor: pointer;
            border-radius: 2px;
        }
        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .clickable {
            cursor: pointer;
        }
    </style>
</head>
<body>
    <div class="info-panel">
        <div class="info-row">
            <span>Account: <strong>${this.escapeHtml(account)}</strong></span>
            <span>Target: <strong class="clickable" onclick="setTarget()">${targetBalance !== null ? formatBalance(targetBalance) : "(not set)"}</strong></span>
        </div>
        <div class="info-row">
            <span>Cleared+Pending: <strong>${clearedPendingBalance}</strong></span>
            ${deltaHtml}
        </div>
    </div>

    <table>
        <thead>
            <tr>
                <th></th>
                <th>Line</th>
                <th>Date</th>
                <th>Check</th>
                <th>Amount</th>
                <th>Description</th>
            </tr>
        </thead>
        <tbody>
            ${rows}
        </tbody>
    </table>

    <div class="toolbar">
        <button onclick="toggleAll()">! Toggle All</button>
        <button onclick="reconcileAll()">C Clear All !</button>
        <button onclick="setTarget()">T Set Target</button>
        <button onclick="switchAccount()">A Switch Account</button>
        <button onclick="refresh()">R Refresh</button>
    </div>

    <script>
        const vscode = acquireVsCodeApi();

        document.querySelectorAll('tbody tr').forEach(row => {
            row.addEventListener('click', (e) => {
                const lineNumber = parseInt(row.dataset.line);
                const currentStatus = row.dataset.status;

                if (e.target.classList.contains('status')) {
                    // Toggle status
                    vscode.postMessage({
                        command: 'toggle',
                        lineNumber: lineNumber,
                        currentStatus: currentStatus
                    });
                } else {
                    // Open in editor
                    vscode.postMessage({
                        command: 'openInEditor',
                        lineNumber: lineNumber
                    });
                }
            });
        });

        function toggleAll() {
            vscode.postMessage({ command: 'toggleAll' });
        }

        function reconcileAll() {
            vscode.postMessage({ command: 'reconcileAll' });
        }

        function setTarget() {
            vscode.postMessage({ command: 'setTarget' });
        }

        function switchAccount() {
            vscode.postMessage({ command: 'switchAccount' });
        }

        function refresh() {
            vscode.postMessage({ command: 'refresh' });
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === '!') toggleAll();
            else if (e.key === 'c' || e.key === 'C') reconcileAll();
            else if (e.key === 't' || e.key === 'T') setTarget();
            else if (e.key === 'a' || e.key === 'A') switchAccount();
            else if (e.key === 'r' || e.key === 'R') refresh();
        });
    </script>
</body>
</html>`;
  }

  private getErrorHtml(error: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reconcile Error</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-errorForeground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
        }
        .error {
            padding: 15px;
            background-color: var(--vscode-inputValidation-errorBackground);
            border: 1px solid var(--vscode-inputValidation-errorBorder);
            border-radius: 3px;
        }
    </style>
</head>
<body>
    <div class="error">
        <strong>Error:</strong> ${this.escapeHtml(error)}
    </div>
</body>
</html>`;
  }

  private escapeHtml(text: string): string {
    const map: { [key: string]: string } = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }
}
/* c8 ignore stop */
