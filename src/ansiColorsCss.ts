// CSS constants for ANSI colors - shared between implementation and preview
import * as fs from 'fs';
import * as path from 'path';

const cssPath = path.join(__dirname, '..', '..', 'assets', 'ansi-colors.css');
export const ANSI_COLORS_CSS = fs.readFileSync(cssPath, 'utf8');
