/**
 * SnapHTML - Lightweight Pure-JS ZIP Writer (Zero Dependency)
 * Çok sayfalı web sitesi klonlarını standart .zip formatında paketler.
 * Windows Explorer, macOS Finder ve 7-Zip ile %100 uyumludur.
 */

// CRC-32 Hesaplama Tablosu
const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  CRC_TABLE[i] = c;
}

function calculateCRC32(uint8Array) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < uint8Array.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ uint8Array[i]) & 0xFF];
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// MS-DOS Tarih/Saat Dönüştürücü
function getDosDateTime(date = new Date()) {
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
  const dosDate = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { dosTime, dosDate };
}

export class SimpleZip {
  constructor() {
    this.files = [];
  }

  /**
   * Arşive dosya ekler
   * @param {string} filename - Dosya adı / yolu (örn: 'index.html', 'pages/about.html')
   * @param {string|Uint8Array} content - Metin veya Uint8Array içerik
   */
  addFile(filename, content) {
    let data;
    if (typeof content === 'string') {
      data = new TextEncoder().encode(content);
    } else if (content instanceof Uint8Array) {
      data = content;
    } else {
      throw new Error('Desteklenmeyen dosya içeriği türü.');
    }

    const cleanName = filename.replace(/\\/g, '/');
    const nameBytes = new TextEncoder().encode(cleanName);
    const crc = calculateCRC32(data);
    const { dosTime, dosDate } = getDosDateTime();

    this.files.push({
      name: cleanName,
      nameBytes,
      data,
      size: data.length,
      crc,
      dosTime,
      dosDate
    });
  }

  /**
   * ZIP arşivini Uint8Array olarak oluşturur
   * @returns {Uint8Array}
   */
  generate() {
    const localHeaders = [];
    const centralHeaders = [];
    let offset = 0;

    for (const file of this.files) {
      // 1. Local File Header (30 byte + dosya adı + veri)
      const localHeader = new Uint8Array(30 + file.nameBytes.length);
      const lv = new DataView(localHeader.buffer);

      lv.setUint32(0, 0x04034b50, true);  // Local file header imzası
      lv.setUint16(4, 20, true);          // Gerekli sürüm (2.0)
      lv.setUint16(6, 0x0800, true);      // Bayraklar: UTF-8 dosya adı (Bit 11)
      lv.setUint16(8, 0, true);           // Sıkıştırma yöntemi: 0 (Store / uncompressed)
      lv.setUint16(10, file.dosTime, true);
      lv.setUint16(12, file.dosDate, true);
      lv.setUint32(14, file.crc, true);   // CRC-32
      lv.setUint32(18, file.size, true);  // Sıkıştırılmış boyut
      lv.setUint32(22, file.size, true);  // Orijinal boyut
      lv.setUint16(26, file.nameBytes.length, true); // Dosya adı uzunluğu
      lv.setUint16(28, 0, true);          // Ekstra alan uzunluğu

      localHeader.set(file.nameBytes, 30);
      localHeaders.push(localHeader);
      localHeaders.push(file.data);

      // 2. Central Directory Header (46 byte + dosya adı)
      const centralHeader = new Uint8Array(46 + file.nameBytes.length);
      const cv = new DataView(centralHeader.buffer);

      cv.setUint32(0, 0x02014b50, true);  // Central directory header imzası
      cv.setUint16(4, 20, true);          // Sürüm
      cv.setUint16(6, 20, true);          // Gerekli sürüm
      cv.setUint16(8, 0x0800, true);      // UTF-8
      cv.setUint16(10, 0, true);          // Sıkıştırma: Store
      cv.setUint16(12, file.dosTime, true);
      cv.setUint16(14, file.dosDate, true);
      cv.setUint32(16, file.crc, true);
      cv.setUint32(20, file.size, true);
      cv.setUint32(24, file.size, true);
      cv.setUint16(28, file.nameBytes.length, true);
      cv.setUint16(30, 0, true);          // Ekstra alan uzunluğu
      cv.setUint16(32, 0, true);          // Dosya yorum uzunluğu
      cv.setUint16(34, 0, true);          // Disk numarası
      cv.setUint16(36, 0, true);          // Dahili dosya öznitelikleri
      cv.setUint32(38, 0, true);          // Harici dosya öznitelikleri
      cv.setUint32(42, offset, true);     // Local header ofseti

      centralHeader.set(file.nameBytes, 46);
      centralHeaders.push(centralHeader);

      offset += localHeader.length + file.data.length;
    }

    const centralDirOffset = offset;
    let centralDirSize = 0;
    for (const ch of centralHeaders) {
      centralDirSize += ch.length;
    }

    // 3. End of Central Directory Record (22 byte)
    const eocd = new Uint8Array(22);
    const ev = new DataView(eocd.buffer);

    ev.setUint32(0, 0x06054b50, true);      // EOCD imzası
    ev.setUint16(4, 0, true);              // Disk numarası
    ev.setUint16(6, 0, true);              // Central directory'nin başladığı disk
    ev.setUint16(8, this.files.length, true);  // Bu diskteki kayıt sayısı
    ev.setUint16(10, this.files.length, true); // Toplam kayıt sayısı
    ev.setUint32(12, centralDirSize, true); // Central directory boyutu
    ev.setUint32(16, centralDirOffset, true); // Central directory ofseti
    ev.setUint16(20, 0, true);             // ZIP yorum uzunluğu

    // Tüm parçaları tek bir Uint8Array'de birleştir
    const totalLength = centralDirOffset + centralDirSize + 22;
    const zipBytes = new Uint8Array(totalLength);

    let pos = 0;
    for (const chunk of [...localHeaders, ...centralHeaders, eocd]) {
      zipBytes.set(chunk, pos);
      pos += chunk.length;
    }

    return zipBytes;
  }
}
