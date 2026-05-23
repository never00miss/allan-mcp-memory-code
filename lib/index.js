const path = require('path');
const rootDir = path.resolve(__dirname, '..');

require('dotenv').config({ path: path.join(rootDir, '.env') });

require('./start');
