import { mkdirSync, copyFileSync } from 'fs';
import { dirname } from 'path';

try {
  const src = require.resolve('htmx.org/dist/htmx.min.js');
  mkdirSync('./public/js', { recursive: true });
  copyFileSync(src, './public/js/htmx.min.js');
  console.log('Copied htmx to public/js/htmx.min.js');
} catch (e) {
  // Ignore if not installed
}
