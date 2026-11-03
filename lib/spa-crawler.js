/**
 * SnapHTML - Intelligent SPA State Discovery & Dual-Viewport Crawler Engine V2
 * React, Vue, Angular ve modern SPA uygulamalarındaki menüleri, sekmeleri,
 * sidebar ve bottom-nav bileşenlerini URL değişmese bile DOM fingerprinting ile keşfeder.
 * Yıkıcı eylemleri (Delete, Deploy, Push, Migrate vb.) kesinlikle engeller.
 * Desktop (1440x900) ve Mobile (390x844) görünümlerini eşleştirerek paketler.
 */

import { VIEWPORT_PRESETS, resolveViewport, applyViewportEmulation, clearViewportEmulation, captureTabScreenshot } from './viewport.js';
import { SimpleZip } from './zip.js';
import { generateInteractiveViewerHtml, generateAiProjectReport } from './zip-export.js';

/**
 * ArrayBuffer veya Uint8Array'i Base64 Data URL'e çevirir
 */
function bufferToBase64(buffer) {
  let binary = '';
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const len = bytes.byteLength;
  const chunkSize = 8192;
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, chunk);
  }
  return btoa(binary);
}

/**
 * Dosya adını güvenli hale getirir (Örn: 01-chat.html)
 */
function formatScreenFilename(index, logicalId) {
  const num = String(index + 1).padStart(2, '0');
  const cleanId = (logicalId || `screen_${index + 1}`)
    .replace(/^screen_/, '')
    .replace(/[^a-z0-9_-]/gi, '_')
    .toLowerCase();
  return `${num}-${cleanId}`;
}

/**
 * Sekmenin tamamen hazır olmasını bekler
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

// Aktif tarama oturumu referansı (İptal edilebilirlik için)
let activeCrawlSession = null;

export function cancelActiveCrawl() {
  if (activeCrawlSession) {
    activeCrawlSession.isCancelled = true;
    return true;
  }
  return false;
}

/**
 * Master SPA Crawler Akışı
 */
export async function runSpaCrawlAndExport({
  startUrl,
  startTabId,
  mode = 'both', // 'both' (Desktop + Mobile), 'desktop', 'mobile'
  maxScreens = 25,
  options = {},
  onProgress
}) {
  const session = {
    isCancelled: false,
    startTime: Date.now()
  };
  activeCrawlSession = session;

  const notify = (msg, current = 0, total = 100) => {
    if (onProgress) onProgress(msg, current, total);
    try {
      chrome.runtime.sendMessage({
        action: 'crawlProgress',
        message: msg,
        current,
        total
      });
    } catch {}
  };

  let tempTab = null;
  let targetTabId = startTabId;

  try {
    notify('İzole arka plan sekmesi hazırlanıyor...', 1, 100);

    // Orijinal sekmeyi ve kullanıcının ekranını korumak için geçici izole sekme aç
    try {
      tempTab = await chrome.tabs.create({ url: startUrl, active: false });
      await waitForTabReady(tempTab.id, 14000);
      targetTabId = tempTab.id;
      // SPA hydration beklemesi
      await new Promise(r => setTimeout(r, 1200));
    } catch (tabErr) {
      console.warn('[SnapHTML Crawler] Geçici sekme açılamadı, aktif sekme kullanılıyor:', tabErr);
      targetTabId = startTabId;
    }

    // Content script enjekte et
    try {
      await chrome.scripting.executeScript({
        target: { tabId: targetTabId },
        files: ['content-script.js']
      });
    } catch {}

    const screensMap = new Map(); // logicalId -> screenObject
    const skippedElements = [];
    const visitedHashes = new Set();

    const doDesktop = mode === 'desktop' || mode === 'both';
    const doMobile = mode === 'mobile' || mode === 'both';

    // =========================================================================
    // AŞAMA 1: MASAÜSTÜ TARAMA & KEŞİF
    // =========================================================================
    if (doDesktop && !session.isCancelled) {
      notify('Masaüstü görünümü (1440×900) uygulanıyor...', 5, 100);
      await applyViewportEmulation(targetTabId, VIEWPORT_PRESETS.desktop);

      // Başlangıç ekranını tara ve kaydet
      notify('Ana ekran analiz ediliyor...', 10, 100);
      const initialClone = await chrome.tabs.sendMessage(targetTabId, {
        action: 'cloneCurrentPage',
        options: { ...options, viewport: VIEWPORT_PRESETS.desktop, isCrawlPage: true }
      });

      const initialScreenshot = await captureTabScreenshot(targetTabId);

      const initialFp = initialClone.fingerprint || { hash: 'init_desk', headings: 'Ana Ekran' };
      visitedHashes.add(initialFp.hash);

      const initialLogicalId = 'screen_home';
      screensMap.set(initialLogicalId, {
        logicalId: initialLogicalId,
        title: initialClone.title || 'Ana Sayfa',
        desktop: {
          html: initialClone.html,
          screenshot: initialScreenshot.bytes,
          viewport: VIEWPORT_PRESETS.desktop,
          fingerprint: initialFp,
          domStats: initialClone.metadata?.domStats
        },
        status: 'success',
        warnings: []
      });

      // Sayfadaki tüm güvenli menü ve sekme adaylarını keşfet
      notify('SPA navigasyon ve sekmeleri taranıyor...', 15, 100);
      const discRes = await chrome.tabs.sendMessage(targetTabId, { action: 'discoverSpaElements' });

      if (discRes && discRes.skippedElements) {
        skippedElements.push(...discRes.skippedElements);
      }

      const candidates = (discRes && discRes.candidates) || [];
      notify(`${candidates.length} güvenli ekran adayı keşfedildi. Klonlama başlıyor...`, 20, 100);

      let processed = 0;
      for (const item of candidates) {
        if (session.isCancelled || screensMap.size >= maxScreens) break;
        processed++;

        const stepPct = 20 + Math.round((processed / Math.max(candidates.length, 1)) * 40);
        notify(`[${processed}/${candidates.length}] Tıklanıyor: ${item.label}...`, stepPct, 100);

        try {
          // Güvenli tıklama gerçekleştir ve DOM stabilizasyonunu bekle
          const clickRes = await chrome.tabs.sendMessage(targetTabId, {
            action: 'performSafeClick',
            navId: item.navId
          });

          if (!clickRes || !clickRes.success) {
            console.warn('[SnapHTML Crawler] Tıklama yanıt vermedi:', item.label);
            continue;
          }

          const fp = clickRes.fingerprint || {};
          // Duplicate / döngü kontrolü
          if (visitedHashes.has(fp.hash)) {
            console.log('[SnapHTML Crawler] Yinelenen ekran atlandı (Döngü koruması):', item.label);
            continue;
          }
          visitedHashes.add(fp.hash);

          // Ekran klonunu ve screenshot'ını al
          const cloneRes = await chrome.tabs.sendMessage(targetTabId, {
            action: 'cloneCurrentPage',
            options: { ...options, viewport: VIEWPORT_PRESETS.desktop, isCrawlPage: true }
          });

          const ssRes = await captureTabScreenshot(targetTabId);

          const logicalId = item.logicalId || `screen_${screensMap.size + 1}`;
          screensMap.set(logicalId, {
            logicalId,
            title: item.label || cloneRes.title || 'Ekran',
            sourceElement: `${item.tagName}${item.role ? `[role="${item.role}"]` : ''}: ${item.label}`,
            desktop: {
              html: cloneRes.html,
              screenshot: ssRes.bytes,
              viewport: VIEWPORT_PRESETS.desktop,
              fingerprint: fp,
              domStats: cloneRes.metadata?.domStats
            },
            status: 'success',
            warnings: []
          });

        } catch (itemErr) {
          console.warn('[SnapHTML Crawler] Ekran klonlama hatası:', item.label, itemErr);
        }
      }
    }

    // =========================================================================
    // AŞAMA 2: MOBİL (390×844) TARAMA & EŞLEŞTİRME
    // =========================================================================
    if (doMobile && !session.isCancelled) {
      notify('Mobil görünüm (390×844) uygulanıyor...', 65, 100);
      await applyViewportEmulation(targetTabId, VIEWPORT_PRESETS.mobile);

      // Sayfa reflow'unun ve mobil CSS'in oturmasını bekle
      await new Promise(r => setTimeout(r, 600));

      // Mobil navigasyon öğelerini keşfet (Bottom-nav veya hamburger menü)
      const mobileDisc = await chrome.tabs.sendMessage(targetTabId, { action: 'discoverSpaElements' });
      if (mobileDisc && mobileDisc.skippedElements) {
        skippedElements.push(...mobileDisc.skippedElements);
      }

      const mobileCandidates = (mobileDisc && mobileDisc.candidates) || [];

      // Mobil ana ekran snapshot'ı
      const initialMobileClone = await chrome.tabs.sendMessage(targetTabId, {
        action: 'cloneCurrentPage',
        options: { ...options, viewport: VIEWPORT_PRESETS.mobile, isMobile: true, isCrawlPage: true }
      });
      const initialMobileSS = await captureTabScreenshot(targetTabId);

      const homeScreen = screensMap.get('screen_home');
      if (homeScreen) {
        homeScreen.mobile = {
          html: initialMobileClone.html,
          screenshot: initialMobileSS.bytes,
          viewport: VIEWPORT_PRESETS.mobile,
          fingerprint: initialMobileClone.fingerprint,
          domStats: initialMobileClone.metadata?.domStats
        };
      } else {
        screensMap.set('screen_home', {
          logicalId: 'screen_home',
          title: initialMobileClone.title || 'Ana Sayfa',
          mobile: {
            html: initialMobileClone.html,
            screenshot: initialMobileSS.bytes,
            viewport: VIEWPORT_PRESETS.mobile,
            fingerprint: initialMobileClone.fingerprint,
            domStats: initialMobileClone.metadata?.domStats
          },
          status: 'success',
          warnings: []
        });
      }

      // Mobil sekmeler arasında gezin ve yakala
      let mobIdx = 0;
      for (const mItem of mobileCandidates) {
        if (session.isCancelled) break;
        mobIdx++;

        const stepPct = 70 + Math.round((mobIdx / Math.max(mobileCandidates.length, 1)) * 20);
        notify(`[Mobil ${mobIdx}/${mobileCandidates.length}] Tıklanıyor: ${mItem.label}...`, stepPct, 100);

        try {
          const clickRes = await chrome.tabs.sendMessage(targetTabId, {
            action: 'performSafeClick',
            navId: mItem.navId
          });

          if (!clickRes || !clickRes.success) continue;

          const cloneRes = await chrome.tabs.sendMessage(targetTabId, {
            action: 'cloneCurrentPage',
            options: { ...options, viewport: VIEWPORT_PRESETS.mobile, isMobile: true, isCrawlPage: true }
          });

          const ssRes = await captureTabScreenshot(targetTabId);

          const logicalId = mItem.logicalId || `screen_${screensMap.size + 1}`;
          const existing = screensMap.get(logicalId);

          if (existing) {
            existing.mobile = {
              html: cloneRes.html,
              screenshot: ssRes.bytes,
              viewport: VIEWPORT_PRESETS.mobile,
              fingerprint: clickRes.fingerprint,
              domStats: cloneRes.metadata?.domStats
            };
          } else {
            screensMap.set(logicalId, {
              logicalId,
              title: mItem.label || cloneRes.title || 'Ekran',
              sourceElement: `Mobile ${mItem.tagName}: ${mItem.label}`,
              mobile: {
                html: cloneRes.html,
                screenshot: ssRes.bytes,
                viewport: VIEWPORT_PRESETS.mobile,
                fingerprint: clickRes.fingerprint,
                domStats: cloneRes.metadata?.domStats
              },
              status: 'success',
              warnings: []
            });
          }
        } catch (mErr) {
          console.warn('[SnapHTML Crawler] Mobil ekran hatası:', mItem.label, mErr);
        }
      }
    }

    if (session.isCancelled) {
      notify('Tarama kullanıcı tarafından durduruldu. Paketleme yapılıyor...', 90, 100);
    }

    // =========================================================================
    // AŞAMA 3: ZIP PAKETLEME & MANIFEST ÜRETİMİ
    // =========================================================================
    notify('ZIP arşivi ve interaktif gezgin oluşturuluyor...', 92, 100);

    const zip = new SimpleZip();
    const screensArray = Array.from(screensMap.values());

    // Ekran dosya adlarını ve yollarını yapılandır
    screensArray.forEach((screen, idx) => {
      const baseFilename = formatScreenFilename(idx, screen.logicalId);
      screen.filename = `${baseFilename}.html`;

      if (screen.desktop) {
        const dHtmlPath = `snapshots/desktop/${baseFilename}.html`;
        const dSsPath = `screenshots/desktop/${baseFilename}.png`;
        zip.addFile(dHtmlPath, screen.desktop.html);
        if (screen.desktop.screenshot) {
          zip.addFile(dSsPath, screen.desktop.screenshot);
        }
        screen.desktop.htmlPath = dHtmlPath;
        screen.desktop.screenshotPath = dSsPath;
        delete screen.desktop.html;
        delete screen.desktop.screenshot;
      }

      if (screen.mobile) {
        const mHtmlPath = `snapshots/mobile/${baseFilename}.html`;
        const mSsPath = `screenshots/mobile/${baseFilename}.png`;
        zip.addFile(mHtmlPath, screen.mobile.html);
        if (screen.mobile.screenshot) {
          zip.addFile(mSsPath, screen.mobile.screenshot);
        }
        screen.mobile.htmlPath = mHtmlPath;
        screen.mobile.screenshotPath = mSsPath;
        delete screen.mobile.html;
        delete screen.mobile.screenshot;
      }
    });

    const domainName = new URL(startUrl).hostname.replace(/[^a-zA-Z0-9.-]/g, '_');

    // Manifest.json
    const manifest = {
      version: '2.0.0',
      projectName: domainName,
      projectUrl: startUrl,
      capturedAt: new Date().toISOString(),
      crawlerMode: mode,
      totalScreens: screensArray.length,
      screens: screensArray,
      skippedElements: skippedElements.slice(0, 50)
    };

    zip.addFile('manifest.json', JSON.stringify(manifest, null, 2));

    // AI Raporu
    const masterAiDoc = generateAiProjectReport(manifest);
    zip.addFile('project_ai.md', masterAiDoc);

    // İnteraktif Çift-Viewport Gezgini (index.html)
    const viewerHtml = generateInteractiveViewerHtml(manifest);
    zip.addFile('index.html', viewerHtml);

    // ZIP Oluştur & İndir
    notify('ZIP dosyası indirmeye hazırlanıyor...', 98, 100);
    const zipBytes = zip.generate();
    const base64Data = bufferToBase64(zipBytes);
    const dataUrl = `data:application/zip;base64,${base64Data}`;
    const zipFilename = `${domainName}_DualViewport_SPA_${Date.now()}.zip`;

    chrome.downloads.download({
      url: dataUrl,
      filename: zipFilename,
      saveAs: true
    });

    notify(`✓ ${screensArray.length} Güvenli Ekran (Desktop + Mobile) Başarıyla İndirildi!`, 100, 100);
    return {
      success: true,
      count: screensArray.length,
      zipFilename,
      manifest
    };

  } finally {
    // =========================================================================
    // KESİN TEMİZLİK (Finally Garantisi)
    // =========================================================================
    if (targetTabId) {
      try {
        await clearViewportEmulation(targetTabId);
      } catch {}
    }

    if (tempTab && tempTab.id) {
      try {
        await chrome.tabs.remove(tempTab.id);
      } catch {}
    }

    activeCrawlSession = null;
  }
}
