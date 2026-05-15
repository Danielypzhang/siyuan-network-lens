const fs = require('fs');

const content = fs.readFileSync('dist/index.js', 'utf-8');

// Find Zh object start
const zhStart = content.indexOf('Zh={') + 3;

// Find the end by looking for the pattern: }}}};
// This is the end of the Zh object literal (4 closing braces for nested objects + Zh itself)
// Actually, let's find the first semicolon after 'applied' that's preceded by multiple }
const appliedIdx = content.indexOf('applied:{en_US:"Changes applied"', zhStart);
console.log('applied at:', appliedIdx);

// Find }}}}; after applied
const searchStart = appliedIdx;
const endPattern = content.indexOf('}}};', searchStart);
console.log('}}}}; at:', endPattern);

if (endPattern > 0) {
  // Include the closing braces but not the semicolon
  const zhEnd = endPattern + 4; // include }}}}
  const zhLiteral = content.substring(zhStart, zhEnd);
  console.log('Zh literal length:', zhLiteral.length);
  console.log('Last 30 chars:', zhLiteral.substring(zhLiteral.length - 30));

  // Try parsing with Function constructor
  try {
    const Zh = new Function('return ' + zhLiteral)();
    console.log('\n=== Top-level keys ===');
    console.log(Object.keys(Zh).join(', '));
    
    console.log('\n=== Keys of Zh.settings ===');
    const settingKeys = Object.keys(Zh.settings);
    console.log(settingKeys.join(', '));
    console.log('Has "wiki":', settingKeys.includes('wiki'));
    
    if (Zh.settings.wiki) {
      console.log('\n=== Keys of Zh.settings.wiki ===');
      console.log(Object.keys(Zh.settings.wiki).join(', '));
      console.log('generationMode:', Zh.settings.wiki.generationMode?.zh_CN);
    }
  } catch (e) {
    console.log('Parse error:', e.message);
  }
}