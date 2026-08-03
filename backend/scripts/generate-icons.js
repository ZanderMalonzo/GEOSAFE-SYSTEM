const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', '..', 'frontend', 'icons');
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'icon-192.png'), png);
fs.writeFileSync(path.join(dir, 'icon-512.png'), png);
console.log('Icons written to frontend/icons/');
