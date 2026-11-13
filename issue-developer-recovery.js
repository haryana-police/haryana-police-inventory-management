'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { randomBytes, createHash } = require('node:crypto');
const file = path.join(__dirname, 'local-data', 'developer-recovery.json');
const code = randomBytes(24).toString('base64url');
const digest = createHash('sha256').update(code).digest('hex');
const temporary = file + '.' + process.pid + '.tmp';
fs.writeFileSync(temporary, JSON.stringify({ digest, expiresAt: Date.now() + 15 * 60 * 1000 }), {
  mode: 0o600, flag: 'wx',
});
fs.renameSync(temporary, file);
console.log('Developer recovery code (valid for 15 minutes): ' + code);
