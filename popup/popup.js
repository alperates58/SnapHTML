/**
 * SnapHTML - Popup Controller (Multi-Level Depth Edition)
 * Seviye 0 (Tek Sayfa), Seviye 1 (Sekmeler/Menüler) ve Seviye 2 (Tüm Site)
 * klonlama süreçlerini yönetir.
 */

document.addEventListener('DOMContentLoaded', async () => {
  // DOM Elemanları
  const tabDomain = document.getElementById('tabDomain');
  const tabTitle = document.getElementById('tabTitle');
  const metricNodes = document.getElementById('metricNodes');
  const metricLinks = document.getElementById('metricLinks');

  const depthButtons = document.querySelectorAll('.depth-btn');
  const depthDescription = document.getElementById('depthDescription');
  const depthDetails = document.getElementById('depthDetails');
  const foundLinksCount = document.getElementById('foundLinksCount');
  const btnToggleLinksList = document.getElementById('btnToggleLinksList');
  const linksList = document.getElementById('linksList');
  const maxPagesSelect = document.getElementById('maxPagesSelect');

  const progressWrap = document.getElementById('progressWrap');
  const progressText = document.getElementById('progressText');
  const progressFill = document.getElementById('progressFill');

  const btnDownload = document.getElementById('btnDownload');
  const btnCrawlDownload = document.getElementById('btnCrawlDownload');
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
  let currentDepth = 0; // 0, 1, 2
  let discoveredLinks = [];

  // 1. Ayarları storage'dan yükle
  chrome.storage.local.get(['snaphtml_options', 'snaphtml_depth'], (result) => {
    if (result && result.snaphtml_options) {
      const o = result.snaphtml_options;
      if (typeof o.inlineImages === 'boolean') optImages.checked = o.inlineImages;
      if (typeof o.inlineFonts === 'boolean') optFonts.checked = o.inlineFonts;
      if (typeof o.freezeScripts === 'boolean') optFreeze.checked = o.freezeScripts;
      if (typeof o.preserveCanvas === 'boolean') optCanvas.checked = o.preserveCanvas;
      if (typeof o.triggerScroll === 'boolean') optScroll.checked = o.triggerScroll;
      if (typeof o.addAiHeader === 'boolean') optAi.checked = o.addAiHeader;
    }
    if (result && typeof result.snaphtml_depth === 'number') {
      setDepth(result.snaphtml_depth);
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
    btnCrawlDownload.disabled = true;
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
        metricLinks.textContent = `${stats.internalLinksCount || 0} link`;
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
          metricLinks.textContent = `${statsRetry.internalLinksCount || 0} link`;
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

  // Sayfadaki iç linkleri ve sekmeleri keşfet
  async function loadDiscoveredLinks() {
    try {
      const res = await chrome.tabs.sendMessage(currentTab.id, { action: 'discoverLinks' });
      if (res && res.success && res.links) {
        discoveredLinks = res.links;
        foundLinksCount.textContent = discoveredLinks.length;
        renderLinksList(discoveredLinks);
      }
    } catch (err) {
      console.warn('Link keşif hatası:', err);
    }
  }

  function renderLinksList(links) {
    if (links.length === 0) {
      linksList.innerHTML = '<span style="color: #94a3b8; padding: 4px;">İç bağlantı bulunamadı.</span>';
      return;
    }
    linksList.innerHTML = links.map((l, idx) => `
      <label class="link-checkbox-item">
        <input type="checkbox" checked value="${l.url}" data-index="${idx}">
        <span title="${l.url}"><strong>${l.title}</strong> (${l.pathname})</span>
      </label>
    `).join('');
  }

  btnToggleLinksList.addEventListener('click', () => {
    linksList.classList.toggle('hidden');
    btnToggleLinksList.textContent = linksList.classList.contains('hidden') ? 'Listeyi Gör' : 'Listeyi Gizle';
  });

  await loadDiscoveredLinks();

  // 3. DERİNLİK SEVİYESİ DEĞİŞTİRME
  function setDepth(depth) {
    currentDepth = depth;
    chrome.storage.local.set({ snaphtml_depth: depth });

    depthButtons.forEach(btn => {
      const d = parseInt(btn.dataset.depth, 10);
      btn.classList.toggle('active', d === depth);
    });

    if (depth === 0) {
      depthDescription.textContent = 'Sadece aktif sayfa';
      depthDetails.classList.add('hidden');
      btnDownload.classList.remove('hidden');
      btnCrawlDownload.classList.add('hidden');
    } else if (depth === 1) {
      depthDescription.textContent = 'Aktif sayfadaki menü & sekmeler';
      depthDetails.classList.remove('hidden');
      btnDownload.classList.add('hidden');
      btnCrawlDownload.classList.remove('hidden');
      document.getElementById('btnCrawlText').textContent = `Seviye 1: Sekmeleri Klonla (.zip)`;
    } else if (depth === 2) {
      depthDescription.textContent = 'Tüm alt sayfalar ve bağlantılar';
      depthDetails.classList.remove('hidden');
      btnDownload.classList.add('hidden');
      btnCrawlDownload.classList.remove('hidden');
      document.getElementById('btnCrawlText').textContent = `Seviye 2: Tüm Siteyi Klonla (.zip)`;
    }
  }

  depthButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const d = parseInt(btn.dataset.depth, 10);
      setDepth(d);
    });
  });

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
    btnCrawlDownload.disabled = busy;
    btnPreview.disabled = busy;
    btnCopyAi.disabled = busy;
    depthButtons.forEach(b => b.disabled = busy);

    if (busy) {
      progressWrap.classList.remove('hidden');
      progressText.textContent = text || 'İşlem yürütülüyor...';
      progressFill.style.animation = 'indeterminate 1.5s infinite linear';
    } else {
      progressWrap.classList.add('hidden');
    }
  }

  // 4. AKSİYON: SEVİYE 0 (Tek Sayfa HTML İndir)
  btnDownload.addEventListener('click', async () => {
    const ready = await ensureContentScript();
    if (!ready) return;

    setBusy(true, 'Sayfa klonlanıyor...');
    const opts = saveCurrentOptions();

    try {
      const response = await chrome.tabs.sendMessage(currentTab.id, {
        action: 'cloneCurrentPage',
        options: opts
      });

      if (!response || !response.success) throw new Error(response?.error || 'Klonlama başarısız.');

      progressText.textContent = 'HTML dosyası indiriliyor...';
      const cleanHost = tabDomain.textContent.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filename = `${cleanHost}_${Date.now()}.html`;

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

  // 5. AKSİYON: SEVİYE 1 & 2 (Çok Seviyeli Crawl & ZIP Paketleme)
  btnCrawlDownload.addEventListener('click', async () => {
    const ready = await ensureContentScript();
    if (!ready) return;

    const maxPages = parseInt(maxPagesSelect.value, 10) || 25;
    const opts = saveCurrentOptions();

    // Kullanıcının listeden seçtiği linkleri belirle
    let selectedUrls = null;
    const checkedInputs = linksList.querySelectorAll('input[type="checkbox"]:checked');
    if (checkedInputs.length > 0 && checkedInputs.length < discoveredLinks.length) {
      selectedUrls = Array.from(checkedInputs).map(inp => {
        const idx = parseInt(inp.dataset.index, 10);
        return discoveredLinks[idx];
      }).filter(Boolean);
    }

    setBusy(true, `Seviye ${currentDepth} taraması başlatılıyor...`);

    try {
      const result = await chrome.runtime.sendMessage({
        action: 'startCrawl',
        startUrl: currentTab.url,
        startTabId: currentTab.id,
        targetDepth: currentDepth,
        maxPages: maxPages,
        options: opts,
        selectedUrls: selectedUrls
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
  });

  // 6. AKSİYON: Önizleme Sekmesi
  btnPreview.addEventListener('click', async () => {
    const ready = await ensureContentScript();
    if (!ready) return;

    setBusy(true, 'Önizleme hazırlanıyor...');
    const opts = saveCurrentOptions();

    try {
      const response = await chrome.tabs.sendMessage(currentTab.id, {
        action: 'cloneCurrentPage',
        options: opts
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

  // 7. AKSİYON: AI Promptu Kopyala
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
- Tespit Edilen İç Bağlantılar: ${discoveredLinks.length} adet

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
