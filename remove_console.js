const fs = require('fs');
const path = require('path');

const dirs = [
  'D:\\recap4ndc_new\\RECAP4NDC_WebApp\\Web',
  'D:\\recap4ndc_new\\RECAP4NDC_WebApp\\api'
];
const exts = ['.js', '.jsx', '.ts', '.tsx'];
const skipDirs = new Set(['node_modules', 'dist', '.git', 'logs', 'public', 'uploads', 'middleware', 'middlewares']);

let totalRemoved = 0;
let filesChanged = 0;

function walk(dir) {
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) {
      if (skipDirs.has(item.name)) continue;
      walk(full);
    } else if (exts.includes(path.extname(item.name))) {
      cleanFile(full);
    }
  }
}

function cleanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  let changed = false;
  const newLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Match console.log, console.debug, console.info (NOT error/warn)
    if (/^\s*console\.(log|debug|info)\s*\(/.test(trimmed)) {
      // Count parentheses to handle multi-line console statements
      let parenCount = 0;
      let started = false;
      for (let j = 0; j < line.length; j++) {
        if (line[j] === '(') { parenCount++; started = true; }
        else if (line[j] === ')') { parenCount--; }
      }

      if (parenCount === 0 && started) {
        // Single-line statement - skip it
        totalRemoved++;
        changed = true;
        continue;
      } else {
        // Multi-line statement - skip subsequent lines until balanced
        totalRemoved++;
        changed = true;
        for (let k = i + 1; k < lines.length; k++) {
          for (let j = 0; j < lines[k].length; j++) {
            if (lines[k][j] === '(') parenCount++;
            else if (lines[k][j] === ')') parenCount--;
          }
          if (parenCount <= 0) {
            i = k;
            break;
          }
        }
        continue;
      }
    }

    newLines.push(line);
  }

  if (changed) {
    fs.writeFileSync(filePath, newLines.join('\n'));
    filesChanged++;
    console.log('Cleaned: ' + filePath);
  }
}

dirs.forEach(walk);
console.log('\nTotal files changed: ' + filesChanged);
console.log('Total console statements removed: ' + totalRemoved);
