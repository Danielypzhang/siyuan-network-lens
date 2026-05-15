const fs = require('fs');
const content = fs.readFileSync('dist/index.js', 'utf-8');

// Extract Zh object literal
const zhStart = content.indexOf('Zh={') + 3;
let depth = 0, zhEnd = zhStart;
let inString = false, stringChar = '';
for (let i = zhEnd; i < content.length; i++) {
  const ch = content[i];
  if (inString) {
    if (ch === '\\') { i++; continue; }
    if (ch === stringChar) inString = false;
    continue;
  }
  if (ch === '"' || ch === "'" || ch === '`') { inString = true; stringChar = ch; continue; }
  if (ch === '{') depth++;
  if (ch === '}') {
    if (depth === 0) { zhEnd = i + 1; break; }
    depth--;
  }
}

const zhLiteral = content.substring(zhStart, zhEnd);
const Zh = eval('(' + zhLiteral + ')');

// Test the lookup
function testKey(path) {
  const segments = path.split('.');
  let current = Zh;
  for (const seg of segments) {
    if (!current || typeof current !== 'object' || !(seg in current)) {
      console.log('FAILED at segment "' + seg + '" for path: ' + path);
      return;
    }
    current = current[seg];
  }
  if (!current || typeof current !== 'object' || !('en_US' in current) || !('zh_CN' in current)) {
    console.log('FAILED - invalid leaf for path: ' + path);
    return;
  }
  console.log('OK: ' + path + ' => zh_CN: ' + current.zh_CN);
}

testKey('settings.wiki.generationMode');
testKey('settings.wiki.generationModeCompressed');
testKey('settings.wiki.generationModeFull');
testKey('settings.wiki.maintenancePrompt');
testKey('settings.wiki.hallucinationMarking');
testKey('settings.wiki.sourceCitationMode');
testKey('settings.wiki.restoreDefaultPrompt');

// Also test some existing keys
testKey('settings.analysisScope.title');
testKey('wikiMaintain.title');