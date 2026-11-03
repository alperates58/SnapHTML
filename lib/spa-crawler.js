/**
 * SnapHTML - Intelligent SPA State Discovery & Dual-Viewport Crawler Engine V2.1
 * React, Vue, Angular ve modern SPA uygulamalarındaki menüleri, sekmeleri,
 * sidebar ve bottom-nav bileşenlerini URL değişmese bile DOM fingerprinting ile keşfeder.
 * Safe Modal Detection & Recovery, Kanonik Ekran Eşleştirme ve Capture Health raporlaması içerir.
 */

import { VIEWPORT_PRESETS, resolveViewport, applyViewportEmulation, clearViewportEmulation, captureTabScreenshot } from './viewport.js';
import { SimpleZip } from './zip.js';
import { generateInteractiveViewerHtml, generateAiProjectReport, generateCaptureHealthData } from './zip-export.js';

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
 * Dosya adını güvenli ve standart hale getirir (Örn: 01-chat.html)
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
function waitForTabReady(tabId, timeout = 14000) {
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

// Aktif tarama oturumu referansı (İptal desteği için)
let activeCrawlSession = null;

export function cancelActiveCrawl() {
  if (activeCrawlSession) {
    activeCrawlSession.isCancelled = true;
    return true;
  }
  return false;
}

/**
 * Master SPA Crawler Akışı V2.1
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

    // Orijinal sekmeyi korumak için geçici arka plan sekmesi aç
    try {
      tempTab = await chrome.tabs.create({ url: startUrl, active: false });
      await waitForTabReady(tempTab.id, 14000);
      targetTabId = tempTab.id;
      // SPA hydration & render toleransı
      await new Promise(r => setTimeout(r, 1500));
    } catch (tabErr) {
      console.warn('[SnapHTML Crawler] Geçici sekme açılamadı, aktif sekme kullanılıyor:', tabErr);
      targetTabId = startTabId;
    }

    // Content script enjeksiyonu
    try {
      await chrome.scripting.executeScript({
        target: { tabId: targetTabId },
        files: ['content-script.js']
      });
    } catch {}

    const screensMap = new Map(); // canonicalId -> screenObject
    const skippedElements = [];
    const visitedHashes = new Set();

    const doDesktop = mode === 'desktop' || mode === 'both';
    const doMobile = mode === 'mobile' || mode === 'both';

    // =========================================================================
    // AŞAMA 1: MASAÜSTÜ TARAMA, MODAL RECOVERY & EKRAN KEŞFİ
    // =========================================================================
    if (doDesktop && !session.isCancelled) {
      notify('Masaüstü görünümü (1440×900) uygulanıyor...', 5, 100);
      await applyViewportEmulation(targetTabId, VIEWPORT_PRESETS.desktop);

      // 1.1: Açık Modal Tespiti (Örn: "Çalışma Alanı Projesi Oluştur veya İçe Aktar")
      notify('Açık modal ve overlay kontrolleri yapılıyor...', 8, 100);
      const modalCheck = await chrome.tabs.sendMessage(targetTabId, { action: 'detectActiveModal' });

      if (modalCheck && modalCheck.hasModal && modalCheck.modal) {
        const mInfo = modalCheck.modal;
        notify(`Modal tespit edildi: "${mInfo.title}". Ayrı ekran olarak kaydediliyor...`, 10, 100);

        // Modalın o anki durumunu ayrı bir snapshot olarak mühürle
        const modalClone = await chrome.tabs.sendMessage(targetTabId, {
          action: 'cloneCurrentPage',
          options: { ...options, viewport: VIEWPORT_PRESETS.desktop, isCrawlPage: true }
        });
        const modalSS = await captureTabScreenshot(targetTabId);

        const modalLogicalId = mInfo.isDevHubProjectModal ? 'screen_modal_create_project' : 'screen_modal_initial';
        screensMap.set(modalLogicalId, {
          logicalId: modalLogicalId,
          title: `Modal: ${mInfo.title}`,
          sourceElement: 'Detected Initial Modal Overlay',
          desktop: {
            html: modalClone.html,
            screenshot: modalSS.bytes,
            viewport: VIEWPORT_PRESETS.desktop,
            fingerprint: modalClone.fingerprint,
            domStats: modalClone.metadata?.domStats
          },
          status: 'PASS',
          modalEvents: ['Başlangıçta açık olan modal bağımsız ekran olarak yakalandı.'],
          warnings: []
        });

        // Modalı Güvenle Kapat (X -> Escape -> Backdrop -> DOM Doğrulaması)
        notify('Modal güvenle kapatılıyor (DOM doğrulaması)...', 12, 100);
        const dismissRes = await chrome.tabs.sendMessage(targetTabId, { action: 'dismissActiveModal' });
        if (dismissRes && dismissRes.success) {
          notify('✓ Modal başarıyla kapatıldı. Temiz navigasyon ekranlarına geçiliyor...', 14, 100);
        } else {
          console.warn('[SnapHTML] Modal kapatılamadı:', dismissRes?.reason);
        }
      }

      // 1.2: Temiz Ana Ekran Snapshot'ı
      notify('Temiz ana ekran analiz ediliyor...', 15, 100);
      await chrome.tabs.sendMessage(targetTabId, { action: 'ensureCleanState' });

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
        sourceElement: 'Initial Clean Workspace',
        desktop: {
          html: initialClone.html,
          screenshot: initialScreenshot.bytes,
          viewport: VIEWPORT_PRESETS.desktop,
          fingerprint: initialFp,
          domStats: initialClone.metadata?.domStats
        },
        status: 'PASS',
        warnings: []
      });

      // 1.3: Sayfadaki Tüm Güvenli Menü ve Sekmeleri Keşfet
      notify('SPA menüleri ve sekmeler taranıyor...', 18, 100);
      const discRes = await chrome.tabs.sendMessage(targetTabId, { action: 'discoverSpaElements' });

      if (discRes && discRes.skippedElements) {
        skippedElements.push(...discRes.skippedElements);
      }

      const candidates = (discRes && discRes.candidates) || [];
      notify(`${candidates.length} güvenli ekran adayı keşfedildi. Masaüstü taraması başlıyor...`, 20, 100);

      let processed = 0;
      for (const item of candidates) {
        if (session.isCancelled || screensMap.size >= maxScreens) break;
        processed++;

        const stepPct = 20 + Math.round((processed / Math.max(candidates.length, 1)) * 40);
        notify(`[Masaüstü ${processed}/${candidates.length}] ${item.canonicalTitle || item.label}...`, stepPct, 100);

        try {
          // Her tıklama öncesi açık modal veya overlay varsa temizle
          await chrome.tabs.sendMessage(targetTabId, { action: 'ensureCleanState' });

          const clickRes = await chrome.tabs.sendMessage(targetTabId, {
            action: 'performSafeClick',
            navId: item.navId,
            canonicalId: item.logicalId
          });

          if (!clickRes || !clickRes.success) {
            console.warn('[SnapHTML Crawler] Tıklama başarısız:', item.label);
            continue;
          }

          const fp = clickRes.fingerprint || {};
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

          const logicalId = item.logicalId;
          const isBlocked = clickRes.isBlocked;

          screensMap.set(logicalId, {
            logicalId,
            title: item.canonicalTitle || item.label || cloneRes.title || 'Ekran',
            sourceElement: `${item.tagName}${item.role ? `[role="${item.role}"]` : ''}: ${item.label}`,
            desktop: {
              html: cloneRes.html,
              screenshot: ssRes.bytes,
              viewport: VIEWPORT_PRESETS.desktop,
              fingerprint: fp,
              domStats: cloneRes.metadata?.domStats
            },
            status: isBlocked ? 'BLOCKED_BY_MODAL' : 'PASS',
            warnings: isBlocked ? [`Ekran üzerinde açık kalan modal tespit edildi: ${clickRes.activeModalTitle}`] : []
          });

        } catch (itemErr) {
          console.warn('[SnapHTML Crawler] Ekran klonlama hatası:', item.label, itemErr);
        }
      }
    }

    // =========================================================================
    // AŞAMA 2: MOBİL (390×844) BAĞIMSIZ TARAMA & KANONİK EŞLEŞTİRME
    // =========================================================================
    if (doMobile && !session.isCancelled) {
      notify('Mobil görünüm (390×844 iPhone) uygulanıyor...', 65, 100);
      await applyViewportEmulation(targetTabId, VIEWPORT_PRESETS.mobile);

      // Reflow ve mobil CSS oturması için bekleme
      await new Promise(r => setTimeout(r, 650));

      // 2.1: Mobilde Açık Kalan Modal Varsa Yönet
      const mobileModalCheck = await chrome.tabs.sendMessage(targetTabId, { action: 'detectActiveModal' });
      if (mobileModalCheck && mobileModalCheck.hasModal && mobileModalCheck.modal) {
        const mInfo = mobileModalCheck.modal;
        const modalLogicalId = mInfo.isDevHubProjectModal ? 'screen_modal_create_project' : 'screen_modal_initial';

        const modalCloneMob = await chrome.tabs.sendMessage(targetTabId, {
          action: 'cloneCurrentPage',
          options: { ...options, viewport: VIEWPORT_PRESETS.mobile, isMobile: true, isCrawlPage: true }
        });
        const modalSSMob = await captureTabScreenshot(targetTabId);

        const existingModal = screensMap.get(modalLogicalId);
        if (existingModal) {
          existingModal.mobile = {
            html: modalCloneMob.html,
            screenshot: modalSSMob.bytes,
            viewport: VIEWPORT_PRESETS.mobile,
            fingerprint: modalCloneMob.fingerprint,
            domStats: modalCloneMob.metadata?.domStats
          };
        }

        await chrome.tabs.sendMessage(targetTabId, { action: 'dismissActiveModal' });
      }

      await chrome.tabs.sendMessage(targetTabId, { action: 'ensureCleanState' });

      // 2.2: Mobil Ana Ekran Snapshot'ı
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
      }

      // 2.3: Mobil Navigasyon Öğelerini Keşfet (Bottom-nav veya Hamburger Menü)
      notify('Mobil navigasyon yapısı taranıyor...', 70, 100);
      const mobileDisc = await chrome.tabs.sendMessage(targetTabId, { action: 'discoverSpaElements' });
      if (mobileDisc && mobileDisc.skippedElements) {
        skippedElements.push(...mobileDisc.skippedElements);
      }

      const mobileCandidates = (mobileDisc && mobileDisc.candidates) || [];

      // 2.4: Masaüstünde Bulunan Her Kanonik Ekranı Mobilde Doğrula & Yakala
      // (Önemli: Yanlış eşleştirmeyi önlemek için kanonik ID üzerinden birebir eşleştir)
      const desktopScreensToMatch = Array.from(screensMap.values()).filter(s => s.logicalId !== 'screen_modal_create_project' && s.logicalId !== 'screen_home');

      let mobIdx = 0;
      for (const targetScreen of desktopScreensToMatch) {
        if (session.isCancelled) break;
        mobIdx++;

        const stepPct = 72 + Math.round((mobIdx / Math.max(desktopScreensToMatch.length, 1)) * 18);
        notify(`[Mobil Doğrulama ${mobIdx}/${desktopScreensToMatch.length}] ${targetScreen.title}...`, stepPct, 100);

        // Bu kanonik ekrana karşılık gelen mobil adayı bul
        const matchingMobileItem = mobileCandidates.find(mc => mc.logicalId === targetScreen.logicalId);

        if (matchingMobileItem) {
          try {
            await chrome.tabs.sendMessage(targetTabId, { action: 'ensureCleanState' });

            const clickRes = await chrome.tabs.sendMessage(targetTabId, {
              action: 'performSafeClick',
              navId: matchingMobileItem.navId,
              canonicalId: targetScreen.logicalId
            });

            if (clickRes && clickRes.success) {
              const cloneRes = await chrome.tabs.sendMessage(targetTabId, {
                action: 'cloneCurrentPage',
                options: { ...options, viewport: VIEWPORT_PRESETS.mobile, isMobile: true, isCrawlPage: true }
              });
              const ssRes = await captureTabScreenshot(targetTabId);

              targetScreen.mobile = {
                html: cloneRes.html,
                screenshot: ssRes.bytes,
                viewport: VIEWPORT_PRESETS.mobile,
                fingerprint: clickRes.fingerprint,
                domStats: cloneRes.metadata?.domStats
              };
              targetScreen.status = 'PASS';
            } else {
              targetScreen.warnings.push('Mobilde bu ekrana tıklandı ancak sayfa yanıt vermedi.');
            }
          } catch (mErr) {
            console.warn('[SnapHTML Crawler] Mobil eşleştirme hatası:', targetScreen.logicalId, mErr);
            targetScreen.warnings.push(`Mobil klonlama hatası: ${mErr.message}`);
          }
        } else {
          // Mobilde bulunamadıysa yanlış eşleştirme YAPMA, UNMATCHED olarak kaydet
          targetScreen.mobile = null;
          targetScreen.status = targetScreen.status === 'BLOCKED_BY_MODAL' ? 'BLOCKED_BY_MODAL' : 'PARTIAL';
          targetScreen.warnings.push('Bu ekran mobil navigasyon yapısında (alt menü / hamburger) bulunamadı.');
        }
      }

      // 2.5: Mobilde Olup Masaüstünde Keşfedilmemiş Özel Ekran Varsa Ekle
      for (const mItem of mobileCandidates) {
        if (!screensMap.has(mItem.logicalId)) {
          try {
            await chrome.tabs.sendMessage(targetTabId, { action: 'ensureCleanState' });

            const clickRes = await chrome.tabs.sendMessage(targetTabId, {
              action: 'performSafeClick',
              navId: mItem.navId,
              canonicalId: mItem.logicalId
            });

            if (clickRes && clickRes.success) {
              const cloneRes = await chrome.tabs.sendMessage(targetTabId, {
                action: 'cloneCurrentPage',
                options: { ...options, viewport: VIEWPORT_PRESETS.mobile, isMobile: true, isCrawlPage: true }
              });
              const ssRes = await captureTabScreenshot(targetTabId);

              screensMap.set(mItem.logicalId, {
                logicalId: mItem.logicalId,
                title: mItem.canonicalTitle || mItem.label,
                sourceElement: `Mobile Unique: ${mItem.label}`,
                mobile: {
                  html: cloneRes.html,
                  screenshot: ssRes.bytes,
                  viewport: VIEWPORT_PRESETS.mobile,
                  fingerprint: clickRes.fingerprint,
                  domStats: cloneRes.metadata?.domStats
                },
                desktop: null,
                status: 'PARTIAL',
                warnings: ['Yalnızca mobil görünümde mevcut ekran.']
              });
            }
          } catch {}
        }
      }
    }

    if (session.isCancelled) {
      notify('Tarama kullanıcı tarafından durduruldu. Paketleme yapılıyor...', 90, 100);
    }

    // =========================================================================
    // AŞAMA 3: SAĞLIK RAPORU (capture-health.json) & ZIP PAKETLEME
    // =========================================================================
    notify('ZIP arşivi ve Capture Health raporu oluşturuluyor...', 92, 100);

    const zip = new SimpleZip();
    const screensArray = Array.from(screensMap.values());

    screensArray.forEach((screen, idx) => {
      const baseFilename = formatScreenFilename(idx, screen.logicalId);
      screen.filename = `${baseFilename}.html`;

      if (screen.desktop && screen.desktop.html) {
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

      if (screen.mobile && screen.mobile.html) {
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

    // Manifest
    const manifest = {
      version: '2.1.0',
      projectName: domainName,
      projectUrl: startUrl,
      capturedAt: new Date().toISOString(),
      crawlerMode: mode,
      totalScreens: screensArray.length,
      screens: screensArray,
      skippedElements: skippedElements.slice(0, 50)
    };

    // Capture Health Report (capture-health.json - Requirement 7)
    const healthData = generateCaptureHealthData(manifest);
    zip.addFile('capture-health.json', JSON.stringify(healthData, null, 2));

    manifest.healthSummary = healthData.summary;
    zip.addFile('manifest.json', JSON.stringify(manifest, null, 2));

    // AI Markdown Raporu
    const masterAiDoc = generateAiProjectReport(manifest, healthData);
    zip.addFile('project_ai.md', masterAiDoc);

    // İnteraktif Çift-Viewport & Sağlık Gezgini (index.html)
    const viewerHtml = generateInteractiveViewerHtml(manifest, healthData);
    zip.addFile('index.html', viewerHtml);

    // ZIP Oluştur & İndir
    notify('ZIP dosyası indirmeye hazırlanıyor...', 98, 100);
    const zipBytes = zip.generate();
    const base64Data = bufferToBase64(zipBytes);
    const dataUrl = `data:application/zip;base64,${base64Data}`;
    const zipFilename = `${domainName}_DualViewport_V2.1_${Date.now()}.zip`;

    chrome.downloads.download({
      url: dataUrl,
      filename: zipFilename,
      saveAs: true
    });

    notify(`✓ ${screensArray.length} Ekran (Doğruluk: ${healthData.summary.matchedScreens}/${screensArray.length} Dual Eşleşen) Başarıyla İndirildi!`, 100, 100);
    return {
      success: true,
      count: screensArray.length,
      matchedCount: healthData.summary.matchedScreens,
      zipFilename,
      manifest,
      healthData
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
