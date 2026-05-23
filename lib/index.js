const path = require('path');
const rootDir = path.resolve(__dirname, '..');

require('dotenv').config({ path: path.join(rootDir, '.env') });

// Only use babel/register in dev mode (when running from lib/)
try {
  require('@babel/register')({
    root: rootDir,
    only: [rootDir]
  });
} catch (e) {
  // Compiled version doesn't need babel
}
require('./start');
