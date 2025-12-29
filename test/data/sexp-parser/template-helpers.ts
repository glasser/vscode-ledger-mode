// Template helpers for sexp-parser test preview generation
// Provides formatting functions for input/output display

import * as Handlebars from "handlebars";

export function isErrorCase(testCase: any): boolean {
  if (!testCase || !testCase.output) {
    return false;
  }
  return testCase.output.error === true;
}

export function formatOutput(output: any): Handlebars.SafeString {
  if (!output) {
    return new Handlebars.SafeString("(no output)");
  }
  if (output.error === true) {
    return new Handlebars.SafeString(
      `Error: ${output.message || "Parse error"}`,
    );
  }
  return new Handlebars.SafeString(JSON.stringify(output, null, 2));
}
