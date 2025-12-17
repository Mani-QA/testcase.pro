import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const cssPath = path.join(__dirname, '../src/static/styles.css');
const outputPath = path.join(__dirname, '../src/static/styles.ts');

const css = fs.readFileSync(cssPath, 'utf8');
const escapedCss = css
  .replace(/\\/g, '\\\\')
  .replace(/`/g, '\\`')
  .replace(/\$/g, '\\$');

const content = `// Auto-generated - do not edit manually
export const cssContent = \`${escapedCss}\`;
`;

fs.writeFileSync(outputPath, content);
console.log('Generated src/static/styles.ts');

