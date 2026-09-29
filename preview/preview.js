/**
 * SnapHTML - Preview Workspace Controller
 * IndexedDB'den snapshot'ı çeker, iframe içinde canlı render eder,
 * AI röntgeni ve kaynak kod görünümlerini yönetir.
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
  if (meta.frameworks && meta.frameworks.length > 0) {
    tagsList.innerHTML = meta.frameworks.map(f => `<span class="framework-tag">${f}</span>`).join('');
  } else {
    tagsList.innerHTML = '<span class="meta-pill">Standart Web</span>';
  }

  // AI Prompt Şablonu
  const generatedAiPrompt = `# Sayfa İnceleme ve İyileştirme Promptu
**Başlık:** ${record.title || 'Web Sayfası'}
**Kaynak URL:** ${record.url}
**Yakalanma:** ${meta.timestamp || new Date().toISOString()}
**Viewport:** ${meta.viewport || '1920x1080'}

## 🎯 Sayfa Yapısı:
- ${stats.navbars || 0} Menü / Navigasyon
- ${stats.mainContainers || 0} Ana Konteyner
- ${stats.forms || 0} Form (${stats.inputs || 0} input/select)
- ${stats.buttons || 0} Etkileşimli Buton
- Kullanılan Kütüphaneler: ${meta.frameworks?.join(', ') || 'Standart'}

## 🎨 Stil & Renkler:
- Sayfa Arka Planı: ${bg}
- Metin Rengi: ${textColor}

## 🤖 Görev / Talimat:
Bu sayfanın çalışan, bağımsız ve stilleri gömülü tek parça HTML kopyası elimde.
Lütfen bu sayfayı analiz ederek tasarım, kullanıcı deneyimi (UX) ve kod yapısını incele.
`;
  promptText.textContent = generatedAiPrompt;

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
      iframeContainer.style.maxWidth = btn.dataset.width;
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
  btnCopyHtml.addEventListener('click', () => {
    copyWithFeedback(record.html, btnCopyHtml, 'Kopyalandı!');
  });

  btnCopyCodeInline.addEventListener('click', () => {
    copyWithFeedback(record.html, btnCopyCodeInline, 'Kopyalandı!');
  });

  btnCopyAiPrompt.addEventListener('click', () => {
    const fullText = generatedAiPrompt + '\n\n```html\n' + record.html + '\n```';
    copyWithFeedback(fullText, btnCopyAiPrompt, 'AI Promptu Kopyalandı!');
  });

  btnCopyPromptInline.addEventListener('click', () => {
    copyWithFeedback(generatedAiPrompt, btnCopyPromptInline, 'Kopyalandı!');
  });

  btnDownload.addEventListener('click', () => {
    let cleanTitle = (record.title || 'snapshot').slice(0, 30).replace(/[^a-zA-Z0-9çÇğĞıİöÖşŞüÜ_-]/g, '_');
    const filename = `${metaDomain.textContent}_${cleanTitle}_${Date.now()}.html`;

    chrome.runtime.sendMessage({
      action: 'downloadHTML',
      html: record.html,
      filename: filename
    }, (res) => {
      if (res && res.success) {
        const origText = btnDownload.innerHTML;
        btnDownload.innerHTML = '<span>✓ İndirildi</span>';
        setTimeout(() => btnDownload.innerHTML = origText, 1500);
      }
    });
  });
});
