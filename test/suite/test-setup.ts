// Test setup to suppress noisy output during testing

const originalConsoleLog = console.log;
const originalConsoleError = console.error;

function isImportantMessage(message: string): boolean {
  return (
    message.includes("failing") ||
    message.includes("passing") ||
    message.includes("✔") ||
    message.includes("✗") ||
    message.includes("pending") ||
    (message.includes("Error:") && !message.includes("Ledger command failed"))
  );
}

// Override console methods during tests
console.log = (...args: any[]) => {
  const message = args.join(" ");
  if (isImportantMessage(message)) {
    originalConsoleLog(...args);
  }
};

console.error = (...args: any[]) => {
  const message = args.join(" ");
  if (isImportantMessage(message)) {
    originalConsoleError(...args);
  }
};

// Restore console after tests
export function restoreConsole() {
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
}
