// Provides a webview panel for displaying balance reports
// Auto-updates when the source ledger file changes

import * as vscode from "vscode";
import { LedgerCli, BalanceReporter, LedgerCommandError } from "./ledgerCli";
import * as path from "path";
import * as fs from "fs";
import { ERROR_FORMATTING_CSS } from "./errorFormattingCss";
import { ANSI_COLORS_CSS } from "./ansiColorsCss";

export class BalanceReportViewProvider {
  private panel: vscode.WebviewPanel | undefined;
  private balanceReporter: BalanceReporter;
  private currentFilePath: string | undefined;
  private fileWatcher: vscode.FileSystemWatcher | undefined;
  private priceDbWatcher: vscode.FileSystemWatcher | undefined;

  constructor(
    private context: vscode.ExtensionContext,
    balanceReporter?: BalanceReporter,
  ) {
    this.balanceReporter = balanceReporter || new LedgerCli();
  }

  async show(filePath: string) {
    this.currentFilePath = filePath;

    // Extract price database path before setting up watchers
    const priceDbPath = await this.extractPriceDbPath(filePath);

    if (!this.panel) {
      this.panel = vscode.window.createWebviewPanel(
        "ledgerBalanceReport",
        "Ledger Balance Report",
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

      // Handle messages from the webview
      this.panel.webview.onDidReceiveMessage(
        (message) => {
          switch (message.command) {
            case "openFile":
              this.openFileAtLine(message.filePath, message.lineNumber);
              break;
          }
        },
        undefined,
        this.context.subscriptions,
      );
    }

    // Set up file watcher for auto-updates
    this.setupFileWatcher(filePath, priceDbPath);

    // Initial update
    await this.updateReport();
  }

  private setupFileWatcher(filePath: string, priceDbPath: string) {
    // Dispose existing watchers
    this.disposeWatcher();

    // Create new watcher for the ledger file
    const uri = vscode.Uri.file(filePath);
    this.fileWatcher = vscode.workspace.createFileSystemWatcher(uri.fsPath);

    // Watch for changes, creates, and deletes
    this.fileWatcher.onDidChange(() => this.updateReport());
    this.fileWatcher.onDidCreate(() => this.updateReport());
    this.fileWatcher.onDidDelete(() => {
      if (this.panel) {
        this.panel.webview.html = this.getErrorHtml("Ledger file was deleted");
      }
    });

    this.context.subscriptions.push(this.fileWatcher);

    // Also watch the price database file if it exists
    if (priceDbPath && fs.existsSync(priceDbPath)) {
      const priceDbUri = vscode.Uri.file(priceDbPath);
      this.priceDbWatcher = vscode.workspace.createFileSystemWatcher(
        priceDbUri.fsPath,
      );

      // Watch for changes to the price database
      this.priceDbWatcher.onDidChange(() => this.updateReport());
      this.priceDbWatcher.onDidCreate(() => this.updateReport());
      this.priceDbWatcher.onDidDelete(() => this.updateReport());

      this.context.subscriptions.push(this.priceDbWatcher);
    }
  }

  private disposeWatcher() {
    if (this.fileWatcher) {
      this.fileWatcher.dispose();
      this.fileWatcher = undefined;
    }
    if (this.priceDbWatcher) {
      this.priceDbWatcher.dispose();
      this.priceDbWatcher = undefined;
    }
  }

  async updateReport() {
    if (!this.panel || !this.currentFilePath) {
      return;
    }

    try {
      const report = await this.balanceReporter.getBalanceReport(
        this.currentFilePath,
      );
      this.panel.webview.html = this.getReportHtml(report);

      // Update title with timestamp
      const fileName = path.basename(this.currentFilePath);
      const time = new Date().toLocaleTimeString();
      this.panel.title = `Balance: ${fileName} (${time})`;
    } catch (error) {
      // Extract the raw ledger stderr if available, otherwise use the error message
      let errorMessage: string;
      if (error instanceof LedgerCommandError) {
        /* c8 ignore next 2 */
        // Use the raw stderr from ledger
        errorMessage = error.result.stderr;
      } else {
        errorMessage =
          error instanceof Error
            ? error.message
            : /* c8 ignore next */ String(error);
      }
      this.panel.webview.html = this.getErrorHtml(errorMessage);
    }
  }

  getReportHtml(report: string): string {
    const htmlReport = this.ansiToHtml(report);

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Balance Report</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            margin: 0;
            padding: 15px;
        }
        pre {
            font-family: var(--vscode-editor-font-family);
            font-size: var(--vscode-editor-font-size);
            margin: 0;
            white-space: pre;
            overflow-x: auto;
        }
        .header {
            color: var(--vscode-textLink-foreground);
            margin-bottom: 10px;
            font-size: 0.9em;
            opacity: 0.8;
        }
        .timestamp {
            float: right;
        }
        /* ANSI color mappings from shared CSS */
        ${ANSI_COLORS_CSS}
    </style>
</head>
<body>
    <div class="header">
        Balance Report <span class="timestamp">Auto-updating</span>
    </div>
    <pre>${htmlReport}</pre>
</body>
</html>`;
  }

  private getErrorHtml(error: string): string {
    const formattedError = this.formatLedgerError(error);

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Balance Report Error</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-errorForeground);
            background-color: var(--vscode-editor-background);
            margin: 0;
            padding: 15px;
        }
        .error {
            padding: 15px;
            background-color: var(--vscode-inputValidation-errorBackground);
            border: 1px solid var(--vscode-inputValidation-errorBorder);
            border-radius: 3px;
            line-height: 1.5;
        }
        .error-location {
            color: var(--vscode-textLink-foreground);
            cursor: pointer;
            text-decoration: underline;
            margin: 8px 0;
            font-weight: bold;
        }
        .error-location:hover {
            color: var(--vscode-textLink-activeForeground);
        }
${ERROR_FORMATTING_CSS}
        .error-details {
            margin-top: 10px;
            padding: 8px;
            background-color: var(--vscode-editor-background);
            border-radius: 3px;
            font-family: var(--vscode-editor-font-family);
            white-space: pre-wrap;
        }
        .error-type {
            font-weight: bold;
            color: var(--vscode-errorForeground);
            margin-bottom: 8px;
        }
    </style>
    <script>
        const vscode = acquireVsCodeApi();
        
        function goToLocation(filePath, lineNumber) {
            vscode.postMessage({
                command: 'openFile',
                filePath: filePath,
                lineNumber: lineNumber
            });
        }
    </script>
</head>
<body>
    <div class="error">
        <div class="error-type">⚠️ Balance Report Error</div>
        ${formattedError}
    </div>
</body>
</html>`;
  }

  public formatLedgerError(error: string): string {
    // Format the error details with better line breaks
    let formatted = this.formatErrorDetails(error.trim());

    // Make file locations clickable inline
    formatted = this.linkifyFileLocations(formatted);

    return `<div class="error-details">${formatted}</div>`;
  }

  public formatErrorDetails(details: string): string {
    // Escape HTML first for security
    let html = this.escapeHtml(details);

    // Style error messages
    html = html.replace(
      /Error: (.+)/g,
      '<span class="error-message">Error: $1</span>',
    );

    // Group consecutive quoted lines into blocks
    html = html.replace(/(^&gt; .+\n)+/gm, (match) => {
      const lines = match.trim();
      return `<span class="quoted-block">${lines}\n</span>`;
    });

    // Style context phrases for better readability
    html = html.replace(
      /^(While parsing file)/gm,
      '<span class="context-label">$1</span>',
    );
    html = html.replace(
      /^(While balancing transaction)/gm,
      '<span class="context-label">$1</span>',
    );
    html = html.replace(
      /^(While parsing transaction)/gm,
      '<span class="context-label">$1</span>',
    );

    return html;
  }

  public linkifyFileLocations(text: string): string {
    // Replace file location patterns with clickable links
    // Note: text is already HTML-escaped, so quotes are &quot;

    // Pattern 1: While parsing file "path", line 123: (after context labeling)
    text = text.replace(
      /<span class="context-label">While parsing file<\/span> &quot;([^&]+)&quot;, line (\d+):/g,
      (match, filePath, lineNumber) => {
        const fileName = path.basename(filePath);
        return `<span class="context-label">While parsing file</span> <span class="file-link" onclick="goToLocation('${filePath}', ${lineNumber})" title="Click to open ${filePath} at line ${lineNumber}">&quot;${fileName}&quot;, line ${lineNumber}</span>:`;
      },
    );

    // Pattern 2: While balancing transaction from "path", lines 123-456: (after context labeling)
    text = text.replace(
      /<span class="context-label">While balancing transaction<\/span> from &quot;([^&]+)&quot;, lines (\d+)-(\d+):/g,
      (match, filePath, startLine, endLine) => {
        const fileName = path.basename(filePath);
        return `<span class="context-label">While balancing transaction</span> from &quot;${fileName}&quot;, lines <span class="file-link" onclick="goToLocation('${filePath}', ${startLine})" title="Click to open ${filePath} at line ${startLine}">${startLine}</span>-<span class="file-link" onclick="goToLocation('${filePath}', ${endLine})" title="Click to open ${filePath} at line ${endLine}">${endLine}</span>:`;
      },
    );

    return text;
  }

  private async openFileAtLine(filePath: string, lineNumber: string) {
    try {
      const line = parseInt(lineNumber) - 1; // VSCode uses 0-based line numbers
      const uri = vscode.Uri.file(filePath);

      const document = await vscode.workspace.openTextDocument(uri);
      const editor = await vscode.window.showTextDocument(
        document,
        vscode.ViewColumn.One,
      );

      // Move cursor to the specified line
      const position = new vscode.Position(line, 0);
      editor.selection = new vscode.Selection(position, position);
      editor.revealRange(
        new vscode.Range(position, position),
        vscode.TextEditorRevealType.InCenter,
      );
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to open file: ${error}`);
    }
  }

  ansiToHtml(text: string): string {
    // First escape HTML special characters
    let html = this.escapeHtml(text);

    // Convert ANSI color codes to HTML spans
    // Map of ANSI codes to CSS classes
    const colorMap: { [key: string]: string } = {
      "30": "ansi-black",
      "31": "ansi-red",
      "32": "ansi-green",
      "33": "ansi-yellow",
      "34": "ansi-blue",
      "35": "ansi-magenta",
      "36": "ansi-cyan",
      "37": "ansi-white",
    };

    // Process ANSI codes - handle color codes and resets
    let result = "";
    let lastIndex = 0;
    const regex = /\x1b\[(\d+)m/g;
    let match;
    let openSpan = false;
    let currentClass = "";

    while ((match = regex.exec(html)) !== null) {
      // Add text before this match
      result += html.slice(lastIndex, match.index);

      const code = match[1];
      if (code === "0") {
        // Reset code - close any open span
        if (openSpan) {
          /* c8 ignore next 2 */
          result += "</span>";
          openSpan = false;
        }
      } else if (colorMap[code]) {
        /* c8 ignore next 7 */
        // Color code - close previous span if open, then open new one
        if (openSpan) {
          result += "</span>";
        }
        currentClass = colorMap[code];
        result += `<span class="${currentClass}">`;
        openSpan = true;
      }

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    /* c8 ignore next 2 */
    result += html.slice(lastIndex);

    // Close any unclosed span
    /* c8 ignore next 3 */
    if (openSpan) {
      result += "</span>";
    }

    return result;
  }

  private escapeHtml(text: string): string {
    const map: { [key: string]: string } = {};
    map["&"] = "&amp;";
    map["<"] = "&lt;";
    map[">"] = "&gt;";
    map['"'] = "&quot;";
    map["'"] = "&#039;";
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }

  private async extractPriceDbPath(filePath: string): Promise<string> {
    try {
      const content = fs.readFileSync(filePath, "utf8");
      const lines = content.split("\n");

      // Look for comment directive: ; price-db: path/to/prices
      for (const line of lines.slice(0, 20)) {
        // Check first 20 lines
        const match = line.match(/^\s*;\s*price-db:\s*(.+)$/);
        if (match) {
          const priceDb = match[1].trim();
          // Resolve relative paths relative to the ledger file directory
          return path.isAbsolute(priceDb)
            ? priceDb
            : path.resolve(path.dirname(filePath), priceDb);
        }
      }

      // Default to 'prices' in the same directory as the ledger file
      return path.join(path.dirname(filePath), "prices");
    } catch (error) {
      // If we can't read the file, return default
      return path.join(path.dirname(filePath), "prices");
    }
  }
}
