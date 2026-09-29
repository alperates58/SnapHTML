/**
 * SnapHTML - IndexedDB Depolama Motoru
 * Büyük boyutlu HTML snapshot'larını (Base64 gömülü stiller ve görseller)
 * kota sınırlarına takılmadan tarayıcı içinde güvenle saklar ve taşır.
 */

const DB_NAME = 'SnapHTML_DB';
const DB_VERSION = 1;
const STORE_NAME = 'snapshots';

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onerror = (event) => {
      reject(new Error(`IndexedDB açma hatası: ${event.target.error?.message}`));
    };
  });
}

/**
 * Snapshot verisini IndexedDB'ye kaydeder.
 * @param {string} id - Benzersiz oturum kimliği
 * @param {Object} data - Snapshot paketi (html, metadata, timestamp, url)
 */
export async function saveSnapshot(id, data) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    const record = {
      id,
      ...data,
      savedAt: Date.now()
    };

    const request = store.put(record);

    request.onsuccess = () => resolve(true);
    request.onerror = (e) => reject(new Error(`Kayıt hatası: ${e.target.error?.message}`));

    tx.oncomplete = () => db.close();
  });
}

/**
 * Belirtilen ID'ye ait snapshot kaydını okur.
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
export async function getSnapshot(id) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = (e) => resolve(e.target.result || null);
    request.onerror = (e) => reject(new Error(`Okuma hatası: ${e.target.error?.message}`));

    tx.oncomplete = () => db.close();
  });
}

/**
 * 24 saatten eski geçici kayıtları temizler.
 */
export async function cleanupOldSnapshots() {
  try {
    const db = await openDatabase();
    const tx = db.transaction([STORE_NAME], 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.openCursor();
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);

    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        if (cursor.value.savedAt && cursor.value.savedAt < oneDayAgo) {
          cursor.delete();
        }
        cursor.continue();
      }
    };
  } catch (err) {
    console.warn('[SnapHTML] Eski kayıt temizleme atlandı:', err);
  }
}
