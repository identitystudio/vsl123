const fs = require('fs');
const b64 = fs.readFileSync('backup-serverx..txt').toString('base64');
fs.writeFileSync('b64.txt', b64);
console.log('Done');
