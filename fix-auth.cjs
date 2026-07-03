const fs = require('fs');
const path = require('path');
const glob = require('glob');

const files = glob.sync('src/app/(auth)/*/page.tsx');
for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  // First, revert the opening tag: <main className="min-h-screen to <div className="min-h-screen if it was modified
  content = content.replace(/<main className="min-h-screen/g, '<div className="min-h-screen');
  
  // Then let's do a proper wrapper replacement. We know it's `return (\n    <div className="min-h-screen ...`
  // We can just replace the first `return (\n    <div` to `<main`, and the last `</div>` to `</main>`.
  
  const match = content.match(/return \(\s*<div/);
  if (match) {
    content = content.replace(match[0], match[0].replace('<div', '<main'));
    const lastIndex = content.lastIndexOf('</div>');
    if (lastIndex !== -1) {
      content = content.substring(0, lastIndex) + '</main>' + content.substring(lastIndex + 6);
    }
  }
  
  fs.writeFileSync(file, content);
}
