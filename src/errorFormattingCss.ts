// CSS constants for error formatting - shared between implementation and preview
import * as fs from "fs";
import * as path from "path";

const cssPath = path.join(
  __dirname,
  "..",
  "..",
  "assets",
  "error-formatting.css",
);
export const ERROR_FORMATTING_CSS = fs.readFileSync(cssPath, "utf8");
