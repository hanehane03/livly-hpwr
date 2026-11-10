'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const output = path.resolve(root, 'dist');

// Only these reviewed runtime assets are uploaded to Pages. Never publish
// the whole working directory (which may contain local settings or secrets).
const publicFiles = [
  'index.html', 'styles.css', 'calculator.js', 'app.js', 'sw.js',
  'manifest.webmanifest', 'icon.svg', 'icons/icon-192.png',
  'icons/icon-512.png', 'icons/apple-touch-icon.png',
];

function build() {
  // Check the exact absolute cleanup target and refuse directory symlinks.
  if (path.dirname(output) !== root || path.basename(output) !== 'dist') throw new Error('Unexpected output directory');
  const outputInfo = fs.lstatSync(output, { throwIfNoEntry: false });
  if (outputInfo?.isSymbolicLink()) throw new Error('dist must not be a symbolic link');
  for (const file of publicFiles) {
    if (!fs.lstatSync(path.join(root, file)).isFile()) throw new Error(`Invalid public file: ${file}`);
  }
  fs.rmSync(output, { recursive: true, force: true });
  fs.mkdirSync(output, { recursive: true });
  for (const file of publicFiles) {
    const destination = path.join(output, file);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(path.join(root, file), destination);
  }
  // Also supports branch-based Pages publishing without Jekyll processing.
  fs.writeFileSync(path.join(output, '.nojekyll'), '');
  return output;
}

if (require.main === module) console.log(`Built public assets: ${build()}`);
module.exports = { build };
