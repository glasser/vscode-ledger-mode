# Ledger Mode

A comprehensive Visual Studio Code extension for working with [Ledger](https://ledger-cli.org/) accounting files. Inspired by [Emacs ledger-mode](https://github.com/ledger/ledger-mode), this extension brings essential ledger editing features to VSCode with native integration.

## Features

### Syntax Highlighting

- Emacs-inspired styling with transaction state-based color coding that works with any VSCode theme
- Visual hierarchy where cleared (`*`) transactions are dimmed, uncleared transactions are prominent, and pending (`!`) transactions are highlighted
- Bold dates for easy scanning
- Uses semantic markup scopes that adapt to your current VSCode theme
- Support for all Ledger file format elements: transactions, accounts, amounts, comments, and directives

### Error-Tolerant Autocompletion

- Merchant/payee completion: type on transaction lines and get suggestions from existing payees
- Account completion with hierarchical support
- Works even when your file has syntax errors or unbalanced transactions
- Context-aware completion that knows whether you're on a transaction line or posting line
- Frequency-based sorting with most common completions appearing first

### Error Diagnostics

- Real-time validation using the `ledger` CLI
- Errors and warnings appear in VSCode's Problems panel
- Debounced checking for performance (1-second delay after typing)
- Automatic clearing of diagnostics when files are closed

### Balance Reports

- Command: "Ledger: Show Balance Report" to generate and view balance reports
- Reports open in a non-editable webview panel with ANSI color support
- Auto-updates whenever the ledger file is saved
- Colorblind-friendly highlighting with negative balances shown with red background
- Clickable error locations: click file references in errors to jump to the line
- Uses custom format: `ledger --price-db prices -X $ -s --real bal not ^Income and not ^Expense`
- Supports custom price database via `; price-db: path` comment directive

### File Organization & Formatting

- Format on Save: automatically organize ledger files when you save (configurable)
- Transaction sorting: sort transactions chronologically while preserving comments
- Amount alignment: align posting amounts to consistent columns for readability
- Data preservation: robust validation ensures no financial data is lost during organization
- Indentation detection: respects existing indentation style (1-space, 4-space, etc.)
- Comment preservation: maintains all comments and associates them with correct transactions

### Smart Transaction Completion (Ctrl+C Tab)

- After typing a payee name, press `Ctrl+C Tab` to autocomplete the entire transaction
- Analyzes existing transactions with the same payee
- Suggests the most common posting pattern (breaking ties with recency)
- Multiple patterns available via VSCode's QuickPick interface
- Automatically removes transaction state markers (`*`, `!`) while preserving your date

### Date Insertion (Ctrl+C Ctrl+T)

- Smart date insertion with interactive prompts
- Supports natural language dates: "today", "yesterday", "last monday", etc.
- Smart positioning: automatically finds the correct chronological position
- Multiple formats: YYYY-MM-DD, MM/DD/YYYY, MM-DD-YYYY, and relative dates
- Shares positioning logic with the "Jump to Now" marker

### Reconciliation Management (Ctrl+C Ctrl+C)

- Toggle reconciliation status of transactions and postings
- Click any line in a transaction and toggle its reconciliation state
- Smart state management: automatically consolidates all postings to transaction level when possible
- Individual posting control: break apart consolidated transactions to control individual postings
- Supports all reconciliation markers: uncleared, cleared (`*`), and pending (`!`)

### Navigation Features

- Jump to Now marker: command to quickly navigate to today's position in chronologically-sorted files
- Current date highlighting: visual marker showing where today's transactions would be inserted

## Requirements

- VSCode: Version 1.74.0 or higher
- Ledger CLI: The extension uses the `ledger` binary for validation and data extraction
  - Install from: https://ledger-cli.org/download.html
  - Or via package managers: `brew install ledger`, `apt install ledger`, etc.

Note: The extension will work for syntax highlighting and basic features even without the Ledger CLI installed, but autocompletion, diagnostics, and reports require it.

## Installation

### Method 1: Install from VSIX (Recommended)

1. Download or build the `.vsix` file (see Development section)
2. Open VSCode
3. Open Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
4. Run "Extensions: Install from VSIX..."
5. Select the `.vsix` file

### Method 2: Development Installation

1. Clone this repository
2. Open the folder in VSCode
3. Press `F5` to run the extension in a new Extension Development Host window

## Usage

1. Open a Ledger file: Files with `.ledger` or `.rec` extensions are automatically recognized
2. Start typing: Get Emacs-style syntax highlighting immediately that adapts to your current VSCode theme
3. Autocompletion:
   - On transaction lines: Type a space after the date to get payee suggestions
   - On posting lines: Type account names to get account suggestions
4. Error checking: Save the file to see validation errors in the Problems panel
5. Balance reports: Use Command Palette → "Ledger: Show Balance Report"
6. Transaction completion: Type a payee name and press `Ctrl+C Tab`
7. Format on save: Enable in VSCode settings or manually format with `Shift+Alt+F`
8. Insert date: Press `Ctrl+C Ctrl+T` for smart date insertion with prompts
9. Toggle reconciliation: Press `Ctrl+C Ctrl+C` to toggle transaction reconciliation status

## Configuration

### VSCode Settings

The extension supports standard VSCode formatting settings:

```json
{
  "ledger.executablePath": "ledger",
  "[ledger]": {
    "editor.formatOnSave": true
  }
}
```

- `ledger.executablePath`: Path to the ledger binary (default: "ledger")
- `editor.formatOnSave`: Enable automatic formatting when saving ledger files (recommended)

### Ledger File Configuration

You can configure balance reports by adding a comment directive at the top of your ledger file:

```ledger
; price-db: prices
; or
; price-db: /path/to/your/price-database

2024-01-01 Example Transaction
    Assets:Bank     $100.00
    Expenses:Food  -$100.00
```

- `; price-db: path`: Specifies the price database file for balance reports (default: "prices")

## Development

### Prerequisites

- Node.js 16+ and npm (or use mise - see setup below)
- VSCode

### Setup

```bash
# Clone the repository
git clone <repository-url>
cd vscode-ledger-mode

# Install Node.js (using mise - recommended)
mise install

# Install dependencies
npm install

# Compile TypeScript
npm run compile
```

> **Note**: This project uses [mise](https://mise.jdx.dev/) to pin the Node.js version. The `mise.toml` file specifies the exact Node version to use for consistent development environments.

### Development Workflow

```bash
# Watch mode for automatic compilation
npm run watch

# Run tests
npm run test

# Lint code
npm run lint

# Compile tests
npm run compile-tests
```

### Testing

The extension includes comprehensive tests using `@vscode/test-cli`:

- **Unit tests**: Core functionality, transaction parsing, formatting logic
- **Data-driven tests**: File-based organize/format test cases with YAML configurations
- **VSCode integration tests**: Extension activation, language registration, formatter integration
- **CLI tests**: Ledger binary integration (skipped if not available)
- **TextMate grammar tests**: Syntax highlighting validation
- **Error-tolerant parsing tests**: Validates functionality with malformed files
- **Comprehensive test coverage** of all major functionality with **100% code coverage**

```bash
# Run all tests
npm run test

# Or use VSCode's built-in test runner
# Press F5 and select "Extension Tests"
```

### Building for Distribution

```bash
# Package the extension
npm run package

# This creates a .vsix file you can install or distribute
```

### Project Structure

```
vscode-ledger-mode/
├── src/                           # TypeScript source code
│   ├── extension.ts               # Main extension entry point
│   ├── ledgerCli.ts              # Ledger CLI integration
│   ├── transactionCompletion.ts  # C-c TAB completion logic
│   ├── completionProvider.ts     # Autocompletion provider
│   ├── diagnosticProvider.ts     # Error diagnostics provider
│   ├── balanceReportView.ts      # Balance report webview
│   ├── commands.ts               # VSCode commands
│   ├── documentFormatter.ts      # Document formatting
│   ├── ledgerOrganizer.ts        # File organization logic
│   ├── reconciliationToggler.ts  # C-c C-c reconciliation logic
│   ├── nowMarker.ts              # Current date navigation
│   └── errorFormattingCss.ts     # Error styling constants
├── syntaxes/                     # TextMate grammar
│   └── ledger.tmLanguage.json    # Syntax highlighting rules
├── test/                         # Test suites
│   ├── suite/                    # Unit test cases
│   ├── data/                     # Data-driven test fixtures
│   ├── testUtils.ts              # Shared test utilities
│   └── generators/               # HTML preview generators
├── package.json                  # Extension manifest
├── CLAUDE.md                     # Development guide for Claude Code
└── README.md                     # This file
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Ensure all tests pass: `npm run test`
5. Ensure linting passes: `npm run lint`
6. Submit a pull request

## License

This project is licensed under the GNU General Public License v3.0. See the [LICENSE](LICENSE) file for details.

This extension is inspired by and builds upon concepts from [Emacs ledger-mode](https://github.com/ledger/ledger-mode), which is also licensed under the GPL.

## Acknowledgments

- Inspired by [Emacs ledger-mode](https://github.com/ledger/ledger-mode)
- Built for the [Ledger](https://ledger-cli.org/) accounting system

## Troubleshooting

### Ledger CLI Not Found

If you see errors about the ledger command not being found:

1. Install Ledger CLI from https://ledger-cli.org/
2. Ensure it's in your PATH
3. Or configure `ledger.executablePath` in VSCode settings

### Syntax Highlighting Not Working

1. Ensure the file has a `.ledger` or `.rec` extension
2. Try manually setting the language: Command Palette → "Change Language Mode" → "Ledger"

### Autocompletion Not Working

1. Ensure the Ledger CLI is installed and working
2. Check that your Ledger file is valid (no syntax errors)
3. Save the file first - completion data is extracted from saved content

### Tests Failing

Some tests require the Ledger CLI to be installed. Tests will skip gracefully if it's not available, but for full testing coverage, install the Ledger binary.

## Development Notes

The bulk of this extension was written by [Claude Code](https://claude.ai/code) guided by David Glasser, partially as an educational experience in learning what Claude Code can do.
