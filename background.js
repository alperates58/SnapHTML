/**
 * SnapHTML - Background Service Worker (Manifest V3)
 * Universal asset fetcher, çok seviyeli recursive tarayıcı (Crawl Depth Engine),
 * link rewriter ve ZIP paketleme yöneticisi.
 */

import { saveSnapshot, cleanupOldSnapshots } from './lib/storage.js';
import { SimpleZip } from './lib/zip.js';

cleanupOldSnapshots();

/**
 * ArrayBuffer'ı güvenli şekilde Base64'e dönüştürür (Chunked)
 */
function bufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  const chunkSize = 8192;
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, chunk);
  }
  return btoa(binary);
}

/**
 * URL'yi normalize eder (Hash'leri temizler, trailing slash'i standartlaştırır)
 */
function normalizeUrl(url) {
  try {
    const u = new URL(url);
    let path = u.pathname;
    if (path.length > 1 && path.endsWith('/')) {
      path = path.slice(0, -1);
    }
    return `${u.origin}${path}${u.search}`;
  } catch {
    return url;
  }
}

/**
 * URL'den yerel HTML dosya adı üretir
 */
function generateSafeFilename(url, title, index) {
  if (index === 0) return 'index.html';
  try {
    const u = new URL(url);
    if (u.pathname === '/' || !u.pathname) {
      return `page_${index}.html`;
    }
    let slug = u.pathname.replace(/^\/|\/$/g, '').replace(/[^a-zA-Z0-9_-]/g, '_');
    if (!slug) slug = `page_${index}`;
    return `${slug}.html`;
  } catch {
    return `page_${index}.html`;
  }
}

/**
 * Arka plan sekmesinin yüklenmesini bekler
 */
function waitForTabReady(tabId, timeout = 12000) {
  return new Promise((resolve) => {
    let timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }, timeout);

    function listener(updatedId, info) {
      if (updatedId === tabId && info.status === 'complete') {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}

/**
 * AI Asistanları için çok sayfalı proje analiz raporu (project_ai.md) üretir
 */
function generateMasterAiReport(startUrl, visitedMap, pagesSummary, targetDepth) {
  const timestamp = new Date().toISOString();
  let tableRows = pagesSummary.map(p => 
    `| [${p.title}](${p.filename}) | \`${p.filename}\` | Seviye ${p.depth} | ${p.nodes} DOM | ${p.buttons} Buton | ${p.forms} Form |`
  ).join('\n');

  return `# 🌐 SnapHTML — Çok Sayfalı Proje Röntgeni (Project AI Mirror)

- **Başlangıç URL:** ${startUrl}
- **Taranan Toplam Sayfa:** ${visitedMap.size} adet
- **Klonlama Derinliği:** Seviye ${targetDepth}
- **Tarih:** ${timestamp}

---

## 🗺️ Sayfa Ağacı ve Hiyerarşi

Aşağıda taranan ve yerel olarak birbirine bağlanan tüm sayfaların listesi yer almaktadır. Bu dosyaların tamamı bu arşivin kök dizininde mevcuttur:

| Sayfa Başlığı | Yerel Dosya | Derinlik | DOM Elemanı | Buton Sayısı | Form Sayısı |
| :--- | :--- | :--- | :--- | :--- | :--- |
${tableRows}

---

## 💡 AI İçin Kullanım Talimatı
Bu paket, projenin tüm sekmelerini ve alt sayfalarını içeren tam bir çevrimdışı web sitesi kopyasıdır.
Sayfalardaki tüm iç linkler (\`<a href="...">\`) yerel dosyalara (\`./kisilik_dna.html\`) bağlanmıştır.

**Örnek AI Görevleri:**
1. *"Tüm sekmeler arasındaki menü tutarlılığını ve tasarım uyumunu incele."*
2. *"Sayfalardaki buton ve form durumlarını karşılaştırarak eksik validasyonları bul."*
3. *"Bu projeyi tek bir React + Tailwind / Next.js projesine dönüştür."*
`;
}

/**
 * DERİNLİK MOTORU: Çok seviyeli tarama yapar, linkleri yerelleştirir ve ZIP üretir
 */
async function crawlAndPackageSite({ startUrl, startTabId, targetDepth, maxPages = 30, options = {}, selectedUrls = null }) {
  const visited = new Map();
  const queue = [];
  const startNormalized = normalizeUrl(startUrl);

  const urlToFilename = new Map();
  urlToFilename.set(startNormalized, 'index.html');

  // Başlangıç sayfasını ekle
  queue.push({
    url: startNormalized,
    depth: 0,
    title: 'Ana Sayfa',
    isInitialTab: true
  });

  // Eğer kullanıcı popup'tan belirli sekmeleri/linkleri seçtiyse (Seviye 1)
  if (selectedUrls && selectedUrls.length > 0) {
    selectedUrls.forEach(u => {
      const norm = normalizeUrl(u.url);
      if (norm !== startNormalized) {
        queue.push({
          url: norm,
          depth: 1,
          title: u.title || 'Alt Sayfa',
          isInitialTab: false
        });
      }
    });
  }

  let processedCount = 0;

  function sendProgress(msg) {
    try {
      chrome.runtime.sendMessage({
        action: 'crawlProgress',
        message: msg,
        current: visited.size,
        total: Math.min(queue.length + visited.size, maxPages)
      });
    } catch {}
  }

  while (queue.length > 0 && visited.size < maxPages) {
    const item = queue.shift();
    const normUrl = item.url;
    if (visited.has(normUrl)) continue;

    processedCount++;
    sendProgress(`[${visited.size + 1}] Klonlanıyor: ${item.title || normUrl}...`);

    let cloneResult = null;

    if (item.isInitialTab) {
      // Aktif sekmeden al
      cloneResult = await chrome.tabs.sendMessage(startTabId, {
        action: 'cloneCurrentPage',
        options
      });
    } else {
      // Arka plan sekmesinde aç, bekle ve klonla
      try {
        const bgTab = await chrome.tabs.create({ url: normUrl, active: false });
        await waitForTabReady(bgTab.id);
        
        // SPA hydration için bekleme
        await new Promise(r => setTimeout(r, 900));

        await chrome.scripting.executeScript({
          target: { tabId: bgTab.id },
          files: ['content-script.js']
        });

        cloneResult = await chrome.tabs.sendMessage(bgTab.id, {
          action: 'cloneCurrentPage',
          options
        });

        await chrome.tabs.remove(bgTab.id);
      } catch (err) {
        console.warn('[SnapHTML Crawler] Alt sayfa atlandı:', normUrl, err);
        continue;
      }
    }

    if (!cloneResult || !cloneResult.success) continue;

    let filename = urlToFilename.get(normUrl);
    if (!filename) {
      filename = generateSafeFilename(normUrl, cloneResult.title, visited.size);
      urlToFilename.set(normUrl, filename);
    }

    visited.set(normUrl, {
      url: normUrl,
      html: cloneResult.html,
      title: cloneResult.title,
      metadata: cloneResult.metadata,
      filename,
      depth: item.depth
    });

    // Eğer manuel seçim yoksa ve derinlik devam ediyorsa yeni linkleri keşfet
    if (!selectedUrls && item.depth < targetDepth && visited.size < maxPages) {
      const discovered = cloneResult.discoveredLinks || [];
      for (const link of discovered) {
        const linkNorm = normalizeUrl(link.url);
        if (!visited.has(linkNorm) && !queue.some(q => q.url === linkNorm) && (visited.size + queue.length < maxPages)) {
          if (!urlToFilename.has(linkNorm)) {
            urlToFilename.set(linkNorm, generateSafeFilename(linkNorm, link.title, urlToFilename.size));
          }
          queue.push({
            url: linkNorm,
            depth: item.depth + 1,
            title: link.title,
            isInitialTab: false
          });
        }
      }
    }
  }

  // Yerel Link Dönüştürme
  sendProgress('Sayfa bağlantıları yerelleştiriliyor...');
  const zip = new SimpleZip();
  const pagesSummary = [];

  for (const [pageUrl, pageData] of visited.entries()) {
    let rewrittenHtml = pageData.html;

    for (const [targetUrl, targetFilename] of urlToFilename.entries()) {
      rewrittenHtml = rewrittenHtml.split(`href="${targetUrl}"`).join(`href="./${targetFilename}"`);
      try {
        const parsed = new URL(targetUrl);
        rewrittenHtml = rewrittenHtml.split(`href="${parsed.pathname}"`).join(`href="./${targetFilename}"`);
        rewrittenHtml = rewrittenHtml.split(`href="${parsed.pathname}/"`).join(`href="./${targetFilename}"`);
      } catch {}
    }

    zip.addFile(pageData.filename, rewrittenHtml);
    pagesSummary.push({
      title: pageData.title,
      filename: pageData.filename,
      url: pageData.url,
      depth: pageData.depth,
      nodes: pageData.metadata?.domStats?.totalNodes || 0,
      buttons: pageData.metadata?.domStats?.buttons || 0,
      forms: pageData.metadata?.domStats?.forms || 0
    });
  }

  // AI Raporu ve Metadata Ekle
  const masterAiMarkdown = generateMasterAiReport(startUrl, visited, pagesSummary, targetDepth);
  zip.addFile('project_ai.md', masterAiMarkdown);
  zip.addFile('sitemap.json', JSON.stringify({
    projectUrl: startUrl,
    totalPages: visited.size,
    depth: targetDepth,
    capturedAt: new Date().toISOString(),
    pages: pagesSummary
  }, null, 2));

  // ZIP İndirme
  sendProgress('ZIP arşivi oluşturuluyor...');
  const zipBytes = zip.generate();
  const base64Zip = bufferToBase64(zipBytes);
  const dataUrl = `data:application/zip;base64,${base64Zip}`;

  const domain = new URL(startUrl).hostname.replace(/[^a-zA-Z0-9.-]/g, '_');
  const zipFilename = `${domain}_Level${targetDepth}_Site_${Date.now()}.zip`;

  chrome.downloads.download({
    url: dataUrl,
    filename: zipFilename,
    saveAs: true
  });

  sendProgress(`✓ ${visited.size} Sayfa Başarıyla İndirildi!`);
  return { success: true, count: visited.size, zipFilename };
}

// Mesaj dinleyici
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 1. Cross-Origin CSS Getirme
  if (message.action === 'fetchStylesheet') {
    (async () => {
      try {
        const response = await fetch(message.url, { cache: 'force-cache', credentials: 'omit' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const cssText = await response.text();
        sendResponse({ success: true, cssText });
      } catch (err) {
        try {
          const resp = await fetch(message.url);
          const cssText = await resp.text();
          sendResponse({ success: true, cssText });
        } catch (innerErr) {
          sendResponse({ success: false, error: innerErr.message });
        }
      }
    })();
    return true;
  }

  // 2. Cross-Origin Asset (Görsel, Font vb.) Base64 Çevirici
  if (message.action === 'fetchAssetAsBase64') {
    (async () => {
      try {
        const response = await fetch(message.url, { cache: 'force-cache', credentials: 'omit' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const buffer = await response.arrayBuffer();
        
        let mimeType = response.headers.get('content-type') || '';
        mimeType = mimeType.split(';')[0].trim();

        if (!mimeType || mimeType === 'application/octet-stream') {
          const lowerUrl = message.url.toLowerCase();
          if (lowerUrl.endsWith('.woff2')) mimeType = 'font/woff2';
          else if (lowerUrl.endsWith('.woff')) mimeType = 'font/woff';
          else if (lowerUrl.endsWith('.ttf')) mimeType = 'font/ttf';
          else if (lowerUrl.endsWith('.png')) mimeType = 'image/png';
          else if (lowerUrl.endsWith('.jpg') || lowerUrl.endsWith('.jpeg')) mimeType = 'image/jpeg';
          else if (lowerUrl.endsWith('.webp')) mimeType = 'image/webp';
          else if (lowerUrl.endsWith('.svg')) mimeType = 'image/svg+xml';
          else if (lowerUrl.endsWith('.gif')) mimeType = 'image/gif';
          else mimeType = 'image/png';
        }

        const base64 = bufferToBase64(buffer);
        sendResponse({ success: true, dataUrl: `data:${mimeType};base64,${base64}` });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  // 3. Snapshot'ı IndexedDB'ye Kaydet ve Önizleme Sekmesini Aç
  if (message.action === 'openPreview') {
    (async () => {
      try {
        const id = 'snap_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
        await saveSnapshot(id, {
          html: message.html,
          metadata: message.metadata,
          title: message.title,
          url: message.url,
          timestamp: new Date().toISOString()
        });

        const previewUrl = chrome.runtime.getURL(`preview/preview.html?id=${id}`);
        await chrome.tabs.create({ url: previewUrl });
        sendResponse({ success: true, id });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  // 4. Tek Sayfa HTML İndir
  if (message.action === 'downloadHTML') {
    (async () => {
      try {
        const utf8Bytes = new TextEncoder().encode(message.html);
        const base64 = bufferToBase64(utf8Bytes);
        const dataUrl = `data:text/html;charset=utf-8;base64,${base64}`;

        let safeFilename = (message.filename || 'snapshot.html').replace(/[\\/:*?"<>|]/g, '_').trim();
        if (!safeFilename.endsWith('.html')) safeFilename += '.html';

        chrome.downloads.download({
          url: dataUrl,
          filename: safeFilename,
          saveAs: true
        }, (downloadId) => {
          if (chrome.runtime.lastError) {
            sendResponse({ success: false, error: chrome.runtime.lastError.message });
          } else {
            sendResponse({ success: true, downloadId });
          }
        });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  // 5. DERİNLİKLİ TARAMA (Seviye 1, Seviye 2... ZIP Paketi)
  if (message.action === 'startCrawl') {
    (async () => {
      try {
        const result = await crawlAndPackageSite(message);
        sendResponse(result);
      } catch (err) {
        console.error('[SnapHTML Crawler Hata]', err);
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }
});
