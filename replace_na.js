const fs = require('fs');
const path = require('path');

const webDir = 'D:\\recap4ndc_new\\RECAP4NDC_WebApp\\Web';
const exts = ['.js', '.jsx', '.ts', '.tsx'];
const skipDirs = new Set(['node_modules', 'dist', '.git']);

let totalReplaced = 0;
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
  let content = fs.readFileSync(filePath, 'utf8');
  let count = 0;

  // Replace "N/A" with "-"
  content = content.replace(/"N\/A"/g, () => { count++; return '"-"'; });
  // Replace 'N/A' with '-'
  content = content.replace(/'N\/A'/g, () => { count++; return "'-'"; });

  if (count > 0) {
    fs.writeFileSync(filePath, content);
    filesChanged++;
    totalReplaced += count;
    console.log(`Cleaned ${count} occurrences in: ${filePath}`);
  }
}

walk(webDir);
console.log(`\nTotal files changed: ${filesChanged}`);
console.log(`Total N/A replaced with -: ${totalReplaced}`);
