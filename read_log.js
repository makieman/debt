const https = require('https');
const zlib = require('zlib');
const fs = require('fs');

const url = process.argv[2];
if (!url) {
  console.error("Please provide URL as first argument");
  process.exit(1);
}

https.get(url, (res) => {
  const chunks = [];
  res.on('data', (chunk) => chunks.push(chunk));
  res.on('end', () => {
    const buffer = Buffer.concat(chunks);
    console.log(`Downloaded ${buffer.length} bytes`);
    
    // Always attempt Brotli decompress since we know it's served as Brotli
    zlib.brotliDecompress(buffer, (err, decompressed) => {
      if (err) {
        console.warn('Brotli decompress failed, writing raw:', err.message);
        fs.writeFileSync('d:\\debt\\eas-build-log-decompressed.txt', buffer);
      } else {
        fs.writeFileSync('d:\\debt\\eas-build-log-decompressed.txt', decompressed);
        console.log('Saved decompressed logs via Brotli.');
      }
    });
  });
}).on('error', (err) => {
  console.error('HTTP error:', err);
});
