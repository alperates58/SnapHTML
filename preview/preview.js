/**
 * SnapHTML - Preview Workspace Controller V2
 * IndexedDB'den snapshot'ı çeker, iframe içinde canlı render eder,
 * 390px mobil çerçeve simülasyonu, AI röntgeni ve kaynak kod görünümlerini yönetir.
 */

import { getSnapshot } from '../lib/storage.js';

document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const snapshotId = urlParams.get('id');

  // DOM Elemanları
  const metaDomain = document.getElementById('metaDomain');
  const metaSize = document.getElementById('metaSize');
  const metaNodes = document.getElementById('metaNodes');
  const metaViewport = document.getElementById('metaViewport');

  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');
  const deviceSwitcher = document.getElementById('deviceSwitcher');
  const devButtons = document.querySelectorAll('.dev-btn');
  const iframeContainer = document.getElementById('iframeContainer');
  const previewFrame = document.getElementById('previewFrame');

  const paletteList = document.getElementById('paletteList');
  const statsList = document.getElementById('statsList');
  const tagsList = document.getElementById('tagsList');
  const promptText = document.getElementById('promptText');
  const rawHtmlCode = document.getElementById('rawHtmlCode');
  const codeLength = document.getElementById('codeLength');

  const btnDownload = document.getElementById('btnDownload');
  const btnCopyHtml = document.getElementById('btnCopyHtml');
  const btnCopyAiPrompt = document.getElementById('btnCopyAiPrompt');
  const btnCopyPromptInline = document.getElementById('btnCopyPromptInline');
  const btnCopyCodeInline = document.getElementById('btnCopyCodeInline');

  if (!snapshotId) {
    alert('Geçersiz snapshot kimliği.');
    return;
  }

  // 1. Snapshot Verisini IndexedDB'den Al
  const record = await getSnapshot(snapshotId);
  if (!record || !record.html) {
    alert('Snapshot verisi bulunamadı veya süresi doldu.');
    return;
  }

  // Boyut hesapla
  const byteLength = new Blob([record.html]).size;
  const sizeFormatted = byteLength > 1024 * 1024
    ? (byteLength / (1024 * 1024)).toFixed(2) + ' MB'
    : (byteLength / 1024).toFixed(1) + ' KB';

  // Domain ve meta bilgileri
  try {
    const urlObj = new URL(record.url);
    metaDomain.textContent = urlObj.hostname || 'Yerel Sayfa';
  } catch {
    metaDomain.textContent = 'Klon Sayfası';
  }

  metaSize.textContent = sizeFormatted;
  metaNodes.textContent = (record.metadata?.domStats?.totalNodes || 'N/A') + ' DOM';
  metaViewport.textContent = record.metadata?.viewport || '1920×1080';

  // 2. Canlı Iframe Render Et
  previewFrame.srcdoc = record.html;

  // Mobil Viewport Kontrolü: Otomatik 390px mobil çerçeve uygula
  const isMobileRecord = record.metadata?.viewportDetails?.mode === 'mobile' ||
    (record.metadata?.viewport && record.metadata.viewport.toLowerCase().includes('mobile')) ||
    (record.metadata?.viewport && record.metadata.viewport.includes('390'));

  if (isMobileRecord) {
    devButtons.forEach(b => {
      b.classList.toggle('active', b.dataset.width === '390px');
    });
    iframeContainer.style.maxWidth = '390px';
    iframeContainer.classList.add('mobile-frame-view');
  }

  // 3. AI Röntgeni Verilerini Doldur
  const meta = record.metadata || {};
  const stats = meta.domStats || {};

  // Renk Paleti
  const bg = meta.computedPalette?.bodyBackground || '#ffffff';
  const textColor = meta.computedPalette?.bodyText || '#000000';
  paletteList.innerHTML = `
    <div class="color-item">
      <div class="color-swatch" style="background-color: ${bg}"></div>
      <span>Arka Plan: <strong>${bg}</strong></span>
    </div>
    <div class="color-item">
      <div class="color-swatch" style="background-color: ${textColor}"></div>
      <span>Metin: <strong>${textColor}</strong></span>
    </div>
  `;

  // Yapısal Sayılar
  statsList.innerHTML = `
    <div class="stat-box"><span class="val">${stats.navbars || 0}</span><span class="lbl">Menü / Nav</span></div>
    <div class="stat-box"><span class="val">${stats.mainContainers || 0}</span><span class="lbl">Ana Alan</span></div>
    <div class="stat-box"><span class="val">${stats.forms || 0}</span><span class="lbl">Form</span></div>
    <div class="stat-box"><span class="val">${stats.inputs || 0}</span><span class="lbl">Girdi (Input)</span></div>
    <div class="stat-box"><span class="val">${stats.buttons || 0}</span><span class="lbl">Buton</span></div>
    <div class="stat-box"><span class="val">${stats.tables || 0}</span><span class="lbl">Tablo</span></div>
  `;

  // Framework Etiketleri
  const fwList = meta.frameworks || ['Standart Web'];
  tagsList.innerHTML = fwList.map(f => `<span class="tag-pill">${f}</span>`).join('');

  // AI Promptu
  const headings = stats.headings || {};
  const promptTemplate = `# 🤖 SnapHTML Web Klon Röntgeni

## 📌 Sayfa Bilgileri:
- **Kaynak URL:** ${record.url}
- **Başlık:** ${record.title}
- **Tarih:** ${record.timestamp}
- **Viewport:** ${meta.viewport || 'N/A'}

## 🎯 Semantik Mimari:
- **Navigasyon Menüleri:** ${stats.navbars || 0} adet
- **Ana Taşıyıcılar:** ${stats.mainContainers || 0} adet
- **Formlar:** ${stats.forms || 0} adet (${stats.inputs || 0} girdi alanı)
- **Butonlar:** ${stats.buttons || 0} adet
- **Tablolar:** ${stats.tables || 0} adet
- **Başlık Hiyerarşisi:** H1: ${headings.h1 || 0} | H2: ${headings.h2 || 0} | H3: ${headings.h3 || 0}
- **Tespit Edilen Kütüphaneler:** ${fwList.join(', ')}

## 🎨 Renk Paleti:
- **Gövde Arka Planı:** ${bg}
- **Metin Rengi:** ${textColor}

## 💡 AI Asistanına Talimat:
Aşağıdaki canlı HTML kodunu referans alarak:
1. Tasarımı ve bileşen hiyerarşisini incele.
2. Tüm etkileşimli buton ve form alanlarının state davranışlarını modelle.
3. Bu arayüzü modern React + Tailwind CSS bileşenlerine dönüştür.
`;

  promptText.value = promptTemplate;

  // 4. Kaynak Kod Sekmesi
  rawHtmlCode.textContent = record.html;
  codeLength.textContent = `${record.html.length.toLocaleString('tr-TR')} karakter (${sizeFormatted})`;

  // 5. Sekme Değiştirme Mantığı
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const tabName = btn.dataset.tab;

      if (tabName === 'live') {
        document.getElementById('paneLive').classList.add('active');
        deviceSwitcher.style.display = 'flex';
      } else if (tabName === 'ai') {
        document.getElementById('paneAi').classList.add('active');
        deviceSwitcher.style.display = 'none';
      } else if (tabName === 'code') {
        document.getElementById('paneCode').classList.add('active');
        deviceSwitcher.style.display = 'none';
      }
    });
  });

  // 6. Cihaz Boyutu Değiştirme
  devButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      devButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const w = btn.dataset.width;
      iframeContainer.style.maxWidth = w;

      if (w === '390px') {
        iframeContainer.classList.add('mobile-frame-view');
      } else {
        iframeContainer.classList.remove('mobile-frame-view');
      }
    });
  });

  // Geri bildirimli kopyalama fonksiyonu
  async function copyWithFeedback(text, button, successMsg) {
    try {
      await navigator.clipboard.writeText(text);
      const originalHtml = button.innerHTML;
      button.innerHTML = `<span>✓ ${successMsg}</span>`;
      setTimeout(() => {
        button.innerHTML = originalHtml;
      }, 1500);
    } catch (e) {
      alert('Kopyalama başarısız: ' + e.message);
    }
  }

  // 7. Aksiyonlar
  btnCopyAiPrompt.addEventListener('click', () => {
    copyWithFeedback(promptTemplate, btnCopyAiPrompt, 'Prompt Kopyalandı!');
  });

  btnCopyPromptInline.addEventListener('click', () => {
    copyWithFeedback(promptTemplate, btnCopyPromptInline, 'Kopyalandı!');
  });

  btnCopyHtml.addEventListener('click', () => {
    copyWithFeedback(record.html, btnCopyHtml, 'HTML Kopyalandı!');
  });

  btnCopyCodeInline.addEventListener('click', () => {
    copyWithFeedback(record.html, btnCopyCodeInline, 'Kopyalandı!');
  });

  btnDownload.addEventListener('click', () => {
    const cleanHost = metaDomain.textContent.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filename = `${cleanHost}_snapshot_${Date.now()}.html`;

    chrome.runtime.sendMessage({
      action: 'downloadHTML',
      html: record.html,
      filename: filename
    }, (res) => {
      if (res && res.success) {
        btnDownload.innerHTML = '<span>✓ İndirildi!</span>';
        setTimeout(() => {
          btnDownload.innerHTML = `
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            <span>HTML İndir</span>
          `;
        }, 2000);
      }
    });
  });
});
