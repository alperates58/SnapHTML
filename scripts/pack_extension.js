const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT_DIR = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'manifest.json'), 'utf8'));
const version = manifest.version || '2.0.0';
const OUTPUT_ZIP = path.join(ROOT_DIR, `SnapHTML_v${version}_ChromeWebStore.zip`);

// Pakete dahil edilecek dosyalar ve klasörler
const INCLUDED_FILES = [
  'manifest.json',
  'background.js',
  'content-script.js',
  'icons/icon16.png',
  'icons/icon32.png',
  'icons/icon48.png',
  'icons/icon128.png',
  'lib/storage.js',
  'lib/zip.js',
  'lib/viewport.js',
  'lib/spa-crawler.js',
  'lib/zip-export.js',
  'popup/popup.html',
  'popup/popup.js',
  'popup/popup.css',
  'preview/preview.html',
  'preview/preview.js',
  'preview/preview.css'
];

// Basit ZIP yazıcı
function calculateCRC32(buf) {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[i] = c;
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function getDosDateTime(d = new Date()) {
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { time, date };
}

const localHeaders = [];
const centralHeaders = [];
let offset = 0;
const { time, date } = getDosDateTime();

for (const relativePath of INCLUDED_FILES) {
  const fullPath = path.join(ROOT_DIR, relativePath);
  if (!fs.existsSync(fullPath)) {
    console.error(`[UYARI] Dosya bulunamadı: ${relativePath}`);
    continue;
  }

  const fileData = fs.readFileSync(fullPath);
  // Zip standardı için deflate
  const compressed = zlib.deflateRawSync(fileData);
  const nameBytes = Buffer.from(relativePath.replace(/\\/g, '/'), 'utf8');
  const crc = calculateCRC32(fileData);

  // Local File Header (30 byte)
  const lh = Buffer.alloc(30 + nameBytes.length);
  lh.writeUInt32LE(0x04034b50, 0);
  lh.writeUInt16LE(20, 4);
  lh.writeUInt16LE(0x0800, 6); // UTF-8
  lh.writeUInt16LE(8, 8);      // Deflate
  lh.writeUInt16LE(time, 10);
  lh.writeUInt16LE(date, 12);
  lh.writeUInt32LE(crc, 14);
  lh.writeUInt32LE(compressed.length, 18);
  lh.writeUInt32LE(fileData.length, 22);
  lh.writeUInt16LE(nameBytes.length, 26);
  lh.writeUInt16LE(0, 28);
  nameBytes.copy(lh, 30);

  localHeaders.push(lh);
  localHeaders.push(compressed);

  // Central Directory Header (46 byte)
  const ch = Buffer.alloc(46 + nameBytes.length);
  ch.writeUInt32LE(0x02014b50, 0);
  ch.writeUInt16LE(20, 4);
  ch.writeUInt16LE(20, 6);
  ch.writeUInt16LE(0x0800, 8);
  ch.writeUInt16LE(8, 10);
  ch.writeUInt16LE(time, 12);
  ch.writeUInt16LE(date, 14);
  ch.writeUInt32LE(crc, 16);
  ch.writeUInt32LE(compressed.length, 20);
  ch.writeUInt32LE(fileData.length, 24);
  ch.writeUInt16LE(nameBytes.length, 28);
  ch.writeUInt16LE(0, 30);
  ch.writeUInt16LE(0, 32);
  ch.writeUInt16LE(0, 34);
  ch.writeUInt16LE(0, 36);
  ch.writeUInt32LE(0, 38);
  ch.writeUInt32LE(offset, 42);
  nameBytes.copy(ch, 46);

  centralHeaders.push(ch);
  offset += lh.length + compressed.length;
}

const centralDirOffset = offset;
let centralDirSize = 0;
for (const ch of centralHeaders) centralDirSize += ch.length;

// End of Central Directory (22 byte)
const eocd = Buffer.alloc(22);
eocd.writeUInt32LE(0x06054b50, 0);
eocd.writeUInt16LE(0, 4);
eocd.writeUInt16LE(0, 6);
eocd.writeUInt16LE(INCLUDED_FILES.length, 8);
eocd.writeUInt16LE(INCLUDED_FILES.length, 10);
eocd.writeUInt32LE(centralDirSize, 12);
eocd.writeUInt32LE(centralDirOffset, 16);
eocd.writeUInt16LE(0, 20);

const finalZip = Buffer.concat([...localHeaders, ...centralHeaders, eocd]);
fs.writeFileSync(OUTPUT_ZIP, finalZip);

console.log(`[BAŞARILI] Chrome Web Store Yükleme Paketi Oluşturuldu:`);
console.log(`📁 Dosya: ${OUTPUT_ZIP}`);
console.log(`📊 Boyut: ${(finalZip.length / 1024).toFixed(1)} KB`);
console.log(`📄 Paketlenen Dosyalar (${INCLUDED_FILES.length} adet):`);
INCLUDED_FILES.forEach(f => console.log(`   - ${f}`));
