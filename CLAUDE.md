# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Install dependencies and setup
npm install

# Development workflow
npm run compile       # Compile TypeScript
npm run watch        # Watch mode for automatic compilation
npm test             # Run all tests (includes syntax tests, linting, formatting)
npm run test:coverage # Run tests with coverage report
npm run lint         # ESLint checking
npm run format       # Format code with Prettier

# Testing specific parts
npm run test:syntax  # Run TextMate grammar tests only
npm run compile-tests # Compile test files only

# Distribution
npm run package      # Create .vsix file for distribution
```

**Requirements**: Ledger CLI should be installed for full testing and development. Tests fail if ledger isn't available (by design - this ensures the assumption that ledger is installed is validated).

## Architecture Overview

This is a comprehensive VSCode extension for [Ledger](https://ledger-cli.org/) accounting files. The architecture follows VSCode extension patterns with clear separation of concerns:

### Core Components

**Main Entry (`src/extension.ts`)**: Orchestrates registration of all providers and commands. Extension activates for `.ledger` and `.rec` files.

**Ledger CLI Integration (`src/ledgerCli.ts`)**: Central interface to the external `ledger` binary. Handles subprocess execution, error parsing, and data extraction (accounts, payees, validation, balance reports).

**Multiple Transaction Parsers**: The codebase intentionally contains different parsers optimized for different purposes:

- `LedgerOrganizer`: For formatting/organizing - intentionally skips blank lines within transactions to clean up malformed files
- `TransactionCompleter`: For transaction completion - correctly treats blank lines as transaction terminators per ledger syntax
- `ReconciliationToggler`: For toggling transaction states - also respects blank line termination

### Key Features

**Syntax Highlighting**: TextMate grammar in `syntaxes/ledger.tmLanguage.json` with Emacs-inspired state-based coloring. Cleared transactions are dimmed, uncleared are bold, pending are highlighted.

**Transaction Completion (`src/transactionCompletion.ts`)**: `Ctrl+C Tab` analyzes existing transactions for the same payee and suggests common posting patterns via QuickPick.

**File Organization (`src/ledgerOrganizer.ts`)**: Sorts transactions chronologically, aligns amounts to consistent columns, preserves comments and associates them with transactions. Includes robust validation to prevent data loss.

**Autocompletion (`src/completionProvider.ts`)**: Context-aware completion for payees (on transaction lines) and accounts (on posting lines). Uses caching with configurable expiration.

**Real-time Diagnostics (`src/diagnosticProvider.ts`)**: Integrates with ledger CLI for validation, shows errors/warnings in VSCode Problems panel with debounced checking.

**Balance Reports (`src/balanceReportView.ts`)**: Webview-based reports that auto-update on file changes. Supports custom price databases via `; price-db: path` comment directive.

**Reconciliation (`src/reconciliationToggler.ts`)**: `Ctrl+C Ctrl+C` toggles transaction/posting reconciliation states with marker normalization.

### Testing Strategy

- **Data-driven tests**: Test cases in `test/format-data/` and `test/organize-data/` with input/expected pairs
- **TextMate grammar tests**: `test/syntax-tests/` using `vscode-tmgrammar-test` library
- **VSCode integration tests**: Extension activation, language registration, formatter integration
- **CLI integration tests**: Gracefully skip if ledger binary not available
- **100% code coverage requirement**: Use `npm run test:coverage` to verify

### File Organization Patterns

Tests are organized by feature area with descriptive names. Format/organize tests use directory-based test data with `input.ledger` and `expected.ledger` files. The extension follows VSCode extension conventions with `package.json` contributions for languages, grammars, commands, and keybindings.

### Development Notes

- Uses `mise.toml` for Node.js version pinning
- ESLint + Prettier for code quality
- TypeScript strict mode enabled
- Extension works without ledger CLI for basic features, requires it for advanced functionality
- All transaction parsing respects that different parsers have different requirements for blank line handling

### Development Workflow and Patterns

**Task Management**: Development tasks are tracked in `IDEAS.md` with a checkbox format. Work top-down through unchecked items using TDD. "CAMO" means "Commit and move on" - commit changes and move to the next unchecked item.

**Committing**: Don't commit without asking first. David reviews diffs in VSCode before approving commits.

**Test-Driven Development**: Always write tests first, ensure 100% coverage is maintained. Use `npm run test:coverage` and check the bottom output for coverage verification.

**Code Comments**: When encountering seemingly incorrect behavior (like blank line handling), investigate thoroughly. Sometimes apparent bugs are actually intentional design decisions for specific use cases. Add clear explanatory comments rather than "fixing" working code.

**Multiple Parser Pattern**: This codebase intentionally uses different transaction parsers for different purposes. When working on parsing logic, understand which parser you're modifying and why it might handle edge cases differently from others.

**TextMate Grammar Testing**: Use the `vscode-tmgrammar-test` library for syntax highlighting tests. Test files use ledger comment syntax (`;`) and caret positioning to verify specific token scopes.

**Data-Driven Testing**: Prefer test case definitions defined by files in directories on disk over hardcoded test logic. Create reusable test data files when testing complex scenarios with multiple input/output pairs. This is especially important and useful when creating tests for functions that process text: so easy to represent in files!

**Integration Testing**: Test actual VSCode integration, not just unit logic. Use real ledger CLI validation when possible rather than mocking.

**Flaky Tests**: The vscode-test suite opens a real VSCode window on David's laptop. Tests can appear flaky if human activity interferes with the window. If a test just passed, trust that result.
