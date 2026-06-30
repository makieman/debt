const fs = require('fs');
const zlib = require('zlib');

const buf = fs.readFileSync('d:\\debt\\eas-build-log-decompressed.txt');

console.log('Buffer length:', buf.length);
console.log('Hex headers:', buf.slice(0, 20).toString('hex'));

const methods = [
  { name: 'gunzip', fn: zlib.gunzip },
  { name: 'inflate', fn: zlib.inflate },
  { name: 'inflateRaw', fn: zlib.inflateRaw },
  { name: 'brotliDecompress', fn: zlib.brotliDecompress }
];

methods.forEach((method) => {
  method.fn(buf, (err, result) => {
    if (err) {
      console.log(`${method.name} failed:`, err.message);
    } else {
      console.log(`\n🎉 ${method.name} succeeded! Result length:`, result.length);
      console.log(result.slice(0, 1000).toString('utf8'));
      fs.writeFileSync('d:\\debt\\eas-build-log-successful.txt', result);
    }
  });
});
