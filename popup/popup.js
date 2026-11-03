/**
 * SnapHTML V2 - Popup Controller
 * Dual-Viewport (Desktop + Mobile) ve Akıllı SPA State Discovery Motoru
 */

document.addEventListener('DOMContentLoaded', async () => {
  // DOM Elemanları
  const tabDomain = document.getElementById('tabDomain');
  const tabTitle = document.getElementById('tabTitle');
  const metricNodes = document.getElementById('metricNodes');
  const metricSpaLinks = document.getElementById('metricSpaLinks');

  const vpButtons = document.querySelectorAll('.vp-btn');
  const viewportDesc = document.getElementById('viewportDesc');

  const modeButtons = document.querySelectorAll('.mode-btn');
  const modeDescription = document.getElementById('modeDescription');
  const spaDetails = document.getElementById('spaDetails');
  const classicDetails = document.getElementById('classicDetails');
  const foundSpaCount = document.getElementById('foundSpaCount');
  const btnToggleSpaList = document.getElementById('btnToggleSpaList');
  const spaList = document.getElementById('spaList');
  const maxScreensSelect = document.getElementById('maxScreensSelect');
  const classicDepthSelect = document.getElementById('classicDepthSelect');

  const progressWrap = document.getElementById('progressWrap');
  const progressText = document.getElementById('progressText');
  const progressFill = document.getElementById('progressFill');
  const btnCancelCrawl = document.getElementById('btnCancelCrawl');

  const btnSpaCrawl = document.getElementById('btnSpaCrawl');
  const btnSpaCrawlText = document.getElementById('btnSpaCrawlText');
  const btnDownload = document.getElementById('btnDownload');
  const btnDownloadText = document.getElementById('btnDownloadText');
  const btnPreview = document.getElementById('btnPreview');
  const btnCopyAi = document.getElementById('btnCopyAi');

  const optionsToggle = document.getElementById('optionsToggle');
  const optionsBox = document.querySelector('.options-box');

  const optImages = document.getElementById('optImages');
  const optFonts = document.getElementById('optFonts');
  const optFreeze = document.getElementById('optFreeze');
  const optCanvas = document.getElementById('optCanvas');
  const optScroll = document.getElementById('optScroll');
  const optAi = document.getElementById('optAi');

  let currentTab = null;
  let selectedViewport = 'both'; // 'desktop', 'mobile', 'tablet', 'both'
  let selectedMode = 'spa'; // 'single', 'spa', 'classic'
  let discoveredCandidates = [];

  // 1. Ayarları storage'dan yükle
  chrome.storage.local.get(['snaphtml_options', 'snaphtml_vp', 'snaphtml_mode'], (result) => {
    if (result && result.snaphtml_options) {
      const o = result.snaphtml_options;
      if (typeof o.inlineImages === 'boolean') optImages.checked = o.inlineImages;
      if (typeof o.inlineFonts === 'boolean') optFonts.checked = o.inlineFonts;
      if (typeof o.freezeScripts === 'boolean') optFreeze.checked = o.freezeScripts;
      if (typeof o.preserveCanvas === 'boolean') optCanvas.checked = o.preserveCanvas;
      if (typeof o.triggerScroll === 'boolean') optScroll.checked = o.triggerScroll;
      if (typeof o.addAiHeader === 'boolean') optAi.checked = o.addAiHeader;
    }
    if (result && result.snaphtml_vp) {
      setViewport(result.snaphtml_vp);
    }
    if (result && result.snaphtml_mode) {
      setMode(result.snaphtml_mode);
    }
  });

  function saveCurrentOptions() {
    const options = {
      inlineImages: optImages.checked,
      inlineFonts: optFonts.checked,
      freezeScripts: optFreeze.checked,
      preserveCanvas: optCanvas.checked,
      triggerScroll: optScroll ? optScroll.checked : true,
      addAiHeader: optAi ? optAi.checked : true
    };
    chrome.storage.local.set({ snaphtml_options: options });
    return options;
  }

  [optImages, optFonts, optFreeze, optCanvas, optScroll, optAi].filter(Boolean).forEach(el => {
    el.addEventListener('change', saveCurrentOptions);
  });

  optionsToggle.addEventListener('click', () => {
    optionsBox.classList.toggle('open');
  });

  // 2. Aktif Sekmeyi Al
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tab;

  if (!tab || !tab.id || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://')) {
    tabDomain.textContent = 'Desteklenmeyen Sekme';
    tabTitle.textContent = 'Chrome dahili sayfaları klonlanamaz.';
    btnDownload.disabled = true;
    btnSpaCrawl.disabled = true;
    btnPreview.disabled = true;
    btnCopyAi.disabled = true;
    return;
  }

  try {
    const urlObj = new URL(tab.url);
    tabDomain.textContent = urlObj.hostname || 'Yerel Sayfa';
    tabTitle.textContent = tab.title || 'Başlıksız';
  } catch {
    tabDomain.textContent = 'Aktif Sayfa';
    tabTitle.textContent = tab.title || '';
  }

  // Content script kontrolü
  async function ensureContentScript() {
    try {
      const stats = await chrome.tabs.sendMessage(currentTab.id, { action: 'getPageQuickStats' });
      if (stats && stats.success) {
        metricNodes.textContent = stats.nodeCount;
        return true;
      }
    } catch {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: currentTab.id },
          files: ['content-script.js']
        });
        const statsRetry = await chrome.tabs.sendMessage(currentTab.id, { action: 'getPageQuickStats' });
        if (statsRetry && statsRetry.success) {
          metricNodes.textContent = statsRetry.nodeCount;
        }
        return true;
      } catch (err) {
        console.error('Script enjeksiyon hatası:', err);
        return false;
      }
    }
    return true;
  }

  await ensureContentScript();

  // SPA Sekmelerini & Güvenli Menü Öğelerini Keşfet
  async function loadSpaElements() {
    try {
      const res = await chrome.tabs.sendMessage(currentTab.id, { action: 'discoverSpaElements' });
      if (res && res.success && res.candidates) {
        discoveredCandidates = res.candidates;
        foundSpaCount.textContent = discoveredCandidates.length;
        metricSpaLinks.textContent = `${discoveredCandidates.length} menü`;
        renderSpaList(discoveredCandidates);
      }
    } catch (err) {
      console.warn('SPA keşif hatası:', err);
    }
  }

  function renderSpaList(candidates) {
    if (candidates.length === 0) {
      spaList.innerHTML = '<span style="color: #94a3b8; padding: 4px;">Güvenli SPA menüsü tespit edilemedi.</span>';
      return;
    }
    spaList.innerHTML = candidates.map((c, idx) => `
      <div class="link-checkbox-item">
        <span style="color: #38bdf8;">✓</span>
        <span><strong>${c.label}</strong> <small style="color: #94a3b8;">(${c.logicalId})</small></span>
      </div>
    `).join('');
  }

  btnToggleSpaList.addEventListener('click', () => {
    spaList.classList.toggle('hidden');
    btnToggleSpaList.textContent = spaList.classList.contains('hidden') ? 'Listeyi Gör' : 'Listeyi Gizle';
  });

  await loadSpaElements();

  // 3. VIEWPORT SEÇİCİ
  function setViewport(vp) {
    selectedViewport = vp;
    chrome.storage.local.set({ snaphtml_vp: vp });

    vpButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.vp === vp);
    });

    const labels = {
      desktop: 'Masaüstü (1440×900)',
      mobile: 'Mobil (390×844 iPhone)',
      tablet: 'Tablet (768×1024 iPad)',
      both: 'Desktop + Mobile (Dual View)'
    };
    viewportDesc.textContent = labels[vp] || 'Özel';
    updateActionButtons();
  }

  vpButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      setViewport(btn.dataset.vp);
    });
  });

  // 4. TARAMA MODU SEÇİCİ
  function setMode(mode) {
    selectedMode = mode;
    chrome.storage.local.set({ snaphtml_mode: mode });

    modeButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    if (mode === 'single') {
      modeDescription.textContent = 'Sadece aktif ekran';
      spaDetails.classList.add('hidden');
      classicDetails.classList.add('hidden');
      btnDownload.classList.remove('hidden');
      btnSpaCrawl.classList.add('hidden');
    } else if (mode === 'spa') {
      modeDescription.textContent = 'Akıllı SPA (Menü & Sekmeler)';
      spaDetails.classList.remove('hidden');
      classicDetails.classList.add('hidden');
      btnDownload.classList.add('hidden');
      btnSpaCrawl.classList.remove('hidden');
    } else if (mode === 'classic') {
      modeDescription.textContent = 'Klasik URL Derinliği';
      spaDetails.classList.add('hidden');
      classicDetails.classList.remove('hidden');
      btnDownload.classList.add('hidden');
      btnSpaCrawl.classList.remove('hidden');
    }

    updateActionButtons();
  }

  modeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      setMode(btn.dataset.mode);
    });
  });

  function updateActionButtons() {
    if (selectedMode === 'spa') {
      if (selectedViewport === 'both') {
        btnSpaCrawlText.textContent = 'Tüm Siteyi Tara (Desktop + Mobile) [.zip]';
      } else if (selectedViewport === 'mobile') {
        btnSpaCrawlText.textContent = 'Tüm Ekranları Tara (Mobil 390px) [.zip]';
      } else {
        btnSpaCrawlText.textContent = 'Tüm Ekranları Tara (Masaüstü) [.zip]';
      }
    } else if (selectedMode === 'single') {
      if (selectedViewport === 'mobile') {
        btnDownloadText.textContent = 'Mobil Ekranı Klonla (390px) [.html]';
      } else {
        btnDownloadText.textContent = 'Ekranı Klonla & İndir [.html]';
      }
    } else if (selectedMode === 'classic') {
      btnSpaCrawlText.textContent = 'Klasik Siteyi Paketle [.zip]';
    }
  }

  // İlerleme mesajlarını dinle
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'crawlProgress' || msg.action === 'cloneProgress') {
      if (msg.message) progressText.textContent = msg.message;
      if (msg.current && msg.total) {
        const pct = Math.min(100, Math.round((msg.current / msg.total) * 100));
        progressFill.style.animation = 'none';
        progressFill.style.width = pct + '%';
      }
    }
  });

  function setBusy(busy, text = '') {
    btnDownload.disabled = busy;
    btnSpaCrawl.disabled = busy;
    btnPreview.disabled = busy;
    btnCopyAi.disabled = busy;
    vpButtons.forEach(b => b.disabled = busy);
    modeButtons.forEach(b => b.disabled = busy);

    if (busy) {
      progressWrap.classList.remove('hidden');
      progressText.textContent = text || 'İşlem yürütülüyor...';
      progressFill.style.animation = 'indeterminate 1.5s infinite linear';
    } else {
      progressWrap.classList.add('hidden');
    }
  }

  // İptal Butonu
  btnCancelCrawl.addEventListener('click', async () => {
    progressText.textContent = 'Durduruluyor...';
    try {
      await chrome.runtime.sendMessage({ action: 'cancelCrawl' });
    } catch {}
  });

  // 5. AKSİYON: SPA MODU V2 VEYA KLASİK TARAMA
  btnSpaCrawl.addEventListener('click', async () => {
    const ready = await ensureContentScript();
    if (!ready) return;

    const opts = saveCurrentOptions();

    if (selectedMode === 'spa') {
      const maxScreens = parseInt(maxScreensSelect.value, 10) || 25;
      setBusy(true, 'Akıllı SPA taraması başlatılıyor...');

      try {
        const result = await chrome.runtime.sendMessage({
          action: 'startSpaCrawl',
          startUrl: currentTab.url,
          startTabId: currentTab.id,
          mode: selectedViewport,
          maxScreens: maxScreens,
          options: opts
        });

        if (result && result.success) {
          progressText.textContent = `✓ ${result.count} Ekran Başarıyla İndirildi!`;
          setTimeout(() => window.close(), 1800);
        } else {
          throw new Error(result?.error || 'Tarama tamamlanamadı.');
        }
      } catch (err) {
        alert('Hata: ' + err.message);
        setBusy(false);
      }
    } else {
      // Klasik Seviye 1/2
      const targetDepth = parseInt(classicDepthSelect.value, 10) || 2;
      setBusy(true, `Seviye ${targetDepth} klasik taraması başlatılıyor...`);

      try {
        const result = await chrome.runtime.sendMessage({
          action: 'startCrawl',
          startUrl: currentTab.url,
          startTabId: currentTab.id,
          targetDepth: targetDepth,
          maxPages: 30,
          options: opts
        });

        if (result && result.success) {
          progressText.textContent = `✓ ${result.count} Sayfa Paketlendi ve İndirildi!`;
          setTimeout(() => window.close(), 1800);
        } else {
          throw new Error(result?.error || 'Tarama tamamlanamadı.');
        }
      } catch (err) {
        alert('Hata: ' + err.message);
        setBusy(false);
      }
    }
  });

  // 6. AKSİYON: TEK SAYFA HTML İNDİR (Viewport Duyarlı)
  btnDownload.addEventListener('click', async () => {
    const ready = await ensureContentScript();
    if (!ready) return;

    setBusy(true, 'Sayfa klonlanıyor...');
    const opts = saveCurrentOptions();

    try {
      let response = null;

      if (selectedViewport === 'mobile' || selectedViewport === 'tablet') {
        progressText.textContent = `${selectedViewport} görünümü emüle ediliyor...`;
        response = await chrome.runtime.sendMessage({
          action: 'captureViewportSnapshot',
          tabId: currentTab.id,
          viewport: selectedViewport,
          options: opts
        });
      } else {
        response = await chrome.tabs.sendMessage(currentTab.id, {
          action: 'cloneCurrentPage',
          options: {
            ...opts,
            viewport: { width: 1440, height: 900, dpr: 1, mode: 'desktop' }
          }
        });
      }

      if (!response || !response.success) throw new Error(response?.error || 'Klonlama başarısız.');

      progressText.textContent = 'HTML dosyası indiriliyor...';
      const cleanHost = tabDomain.textContent.replace(/[^a-zA-Z0-9.-]/g, '_');
      const suffix = selectedViewport === 'mobile' ? '_mobile' : '';
      const filename = `${cleanHost}${suffix}_${Date.now()}.html`;

      const dlRes = await chrome.runtime.sendMessage({
        action: 'downloadHTML',
        html: response.html,
        filename: filename
      });

      if (dlRes && dlRes.success) {
        progressText.textContent = '✓ Başarıyla İndirildi!';
        setTimeout(() => window.close(), 1200);
      } else {
        throw new Error(dlRes?.error || 'İndirme başlatılamadı.');
      }
    } catch (err) {
      alert('Hata: ' + err.message);
      setBusy(false);
    }
  });

  // 7. AKSİYON: ÖNİZLEME SEKMESİ
  btnPreview.addEventListener('click', async () => {
    const ready = await ensureContentScript();
    if (!ready) return;

    setBusy(true, 'Önizleme hazırlanıyor...');
    const opts = saveCurrentOptions();

    try {
      const response = await chrome.tabs.sendMessage(currentTab.id, {
        action: 'cloneCurrentPage',
        options: {
          ...opts,
          isMobile: selectedViewport === 'mobile',
          viewport: selectedViewport === 'mobile'
            ? { width: 390, height: 844, dpr: 3, mode: 'mobile' }
            : { width: 1440, height: 900, dpr: 1, mode: 'desktop' }
        }
      });

      if (!response || !response.success) throw new Error(response?.error);

      await chrome.runtime.sendMessage({
        action: 'openPreview',
        html: response.html,
        metadata: response.metadata,
        title: response.title,
        url: response.url
      });

      window.close();
    } catch (err) {
      alert('Hata: ' + err.message);
      setBusy(false);
    }
  });

  // 8. AKSİYON: AI PROMPT KOPYALA
  btnCopyAi.addEventListener('click', async () => {
    const ready = await ensureContentScript();
    if (!ready) return;

    setBusy(true, 'AI Röntgeni çıkartılıyor...');
    const opts = saveCurrentOptions();

    try {
      const response = await chrome.tabs.sendMessage(currentTab.id, {
        action: 'cloneCurrentPage',
        options: opts
      });

      if (!response || !response.success) throw new Error(response?.error);

      const meta = response.metadata || {};
      const aiPromptText = `# ${meta.title || 'Web Sayfası'}
URL: ${response.url}
Zaman: ${meta.timestamp || new Date().toISOString()}
Ekran / Viewport: ${meta.viewport || 'N/A'}

## 🎯 Sayfa Mimarisi:
- Navigasyon / Menüler: ${meta.domStats?.navbars || 0} adet
- Ana Alanlar (Main): ${meta.domStats?.mainContainers || 0} adet
- Formlar: ${meta.domStats?.forms || 0} adet (${meta.domStats?.inputs || 0} aktif girdi)
- Butonlar: ${meta.domStats?.buttons || 0} adet
- Keşfedilen SPA Menüleri: ${discoveredCandidates.length} adet

## 💻 Canlı HTML Klonu:
\`\`\`html
${response.aiHtml || response.html}
\`\`\`
`;

      await navigator.clipboard.writeText(aiPromptText);
      progressText.textContent = '✓ AI Promptu Panoya Kopyalandı!';
      setTimeout(() => window.close(), 1200);
    } catch (err) {
      alert('Hata: ' + err.message);
      setBusy(false);
    }
  });
});
