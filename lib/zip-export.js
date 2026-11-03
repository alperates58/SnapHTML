/**
 * SnapHTML - ZIP Export, Health Report & Interactive Offline Viewer Generator V2.1
 * Desktop ve Mobile snapshot'ları, screenshot'ları, capture-health.json,
 * manifest.json ve bağımsız index.html gezginini tek parça standart ZIP içinde paketler.
 */

import { SimpleZip } from './zip.js';

/**
 * Capture Health Report JSON verisini üretir (Requirement 7)
 */
export function generateCaptureHealthData(manifest) {
  let desktopCount = 0;
  let mobileCount = 0;
  let matchedCount = 0;
  let unmatchedCount = 0;
  let modalBlockedCount = 0;
  let failedCount = 0;

  const screenHealthList = manifest.screens.map(s => {
    const hasDesktop = Boolean(s.desktop?.htmlPath);
    const hasMobile = Boolean(s.mobile?.htmlPath);

    if (hasDesktop) desktopCount++;
    if (hasMobile) mobileCount++;

    let status = s.status || 'PASS';
    let desktopStatus = hasDesktop ? 'PASS' : 'UNMATCHED';
    let mobileStatus = hasMobile ? 'PASS' : 'UNMATCHED';

    if (s.isBlocked || s.status === 'BLOCKED_BY_MODAL') {
      status = 'BLOCKED_BY_MODAL';
      modalBlockedCount++;
    } else if (hasDesktop && hasMobile) {
      status = 'PASS';
      matchedCount++;
    } else if (hasDesktop || hasMobile) {
      status = 'PARTIAL';
      unmatchedCount++;
    } else {
      status = 'FAILED';
      failedCount++;
    }

    return {
      logicalId: s.logicalId,
      title: s.title,
      status,
      desktopStatus,
      mobileStatus,
      navigationPath: s.sourceElement || 'Direct Navigation',
      modalEvents: s.modalEvents || [],
      warnings: s.warnings || []
    };
  });

  return {
    version: '2.1.0',
    generatedAt: new Date().toISOString(),
    projectUrl: manifest.projectUrl,
    summary: {
      discoveredScreens: manifest.screens.length,
      desktopCaptures: desktopCount,
      mobileCaptures: mobileCount,
      matchedScreens: matchedCount,
      unmatchedScreens: unmatchedCount,
      duplicateCaptures: manifest.duplicateCount || 0,
      modalBlockedCaptures: modalBlockedCount,
      failedCaptures: failedCount,
      skippedUnsafeInteractions: (manifest.skippedElements || []).length
    },
    screens: screenHealthList,
    skippedUnsafeInteractions: manifest.skippedElements || []
  };
}

/**
 * AI Asistanları için çoklu ekran ve çift viewport raporu (project_ai.md) üretir
 */
export function generateAiProjectReport(manifest, healthData) {
  const timestamp = manifest.capturedAt || new Date().toISOString();
  let tableRows = manifest.screens.map((s, idx) => {
    const dStat = s.desktop?.domStats?.totalNodes || '-';
    const mStat = s.mobile?.domStats?.totalNodes || '-';
    return `| ${idx + 1} | [${s.title}](./snapshots/desktop/${s.filename || s.logicalId + '.html'}) | \`${s.logicalId}\` | ${dStat} DOM | ${mStat} DOM | ${s.status || 'PASS'} |`;
  }).join('\n');

  let skippedInfo = '';
  if (manifest.skippedElements && manifest.skippedElements.length > 0) {
    skippedInfo = `\n### 🛡️ Güvenlik Nedeniyle Atlanan Yıkıcı Öğeler (${manifest.skippedElements.length} adet):\n` +
      manifest.skippedElements.map(sk => `- **"${sk.text}"**: ${sk.reason}`).join('\n');
  }

  const h = healthData.summary;

  return `# 🌐 SnapHTML V2.1 — Akıllı Proje Röntgeni & Doğruluk Raporu

- **Proje URL:** ${manifest.projectUrl}
- **Toplam Güvenli Ekran:** ${manifest.screens.length} adet
- **Eşleşen (Desktop + Mobile):** ${h.matchedScreens} adet
- **Kısmi / Eşleşmeyen:** ${h.unmatchedScreens} adet
- **Modal Tarafından Engellenen:** ${h.modalBlockedCaptures} adet
- **Tarih:** ${timestamp}

---

## 📊 Capture Health Özeti
- **Masaüstü HTML:** ${h.desktopCaptures} adet
- **Mobil HTML (390px):** ${h.mobileCaptures} adet
- **Yıkıcı Eylem Koruması:** ${h.skippedUnsafeInteractions} eylem engellendi

---

## 🗺️ Keşfedilen Ekran Haritası

Aşağıdaki ekranlar hem Masaüstü (1440×900) hem de Mobil (390×844) viewport'larında ayrı ayrı DOM durumlarıyla yakalanmıştır:

| # | Ekran Başlığı | Mantıksal ID | Masaüstü DOM | Mobil DOM | Durum |
| :- | :--- | :--- | :--- | :--- | :--- |
${tableRows}
${skippedInfo}

---

## 💡 AI İçin Kullanım Talimatı
Bu paket, projenin tüm React / SPA ekranlarını içeren çift viewport çevrimdışı kopyasıdır.
\`index.html\` dosyasını açarak tüm ekranlar arasında canlı gezinebilir ve screenshot karşılaştırması yapabilirsiniz.
`;
}

/**
 * ZIP kök dizininde yer alan interaktif index.html portalını üretir
 */
export function generateInteractiveViewerHtml(manifest, healthData) {
  const manifestJson = JSON.stringify(manifest, null, 2);
  const healthJson = JSON.stringify(healthData, null, 2);

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SnapHTML V2.1 Portal — ${manifest.projectName || 'Web Projesi'}</title>
  <style>
    :root {
      --bg: #090d16;
      --card-bg: #111827;
      --border: #1f293d;
      --border-light: #2d3748;
      --text: #f3f4f6;
      --text-muted: #94a3b8;
      --accent: #38bdf8;
      --accent-hover: #0ea5e9;
      --badge-bg: #1e293b;
      --green: #10b981;
      --orange: #f59e0b;
      --red: #ef4444;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      display: flex;
      height: 100vh;
      overflow: hidden;
    }
    .sidebar {
      width: 320px;
      min-width: 320px;
      background: var(--card-bg);
      border-right: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      height: 100%;
      z-index: 10;
    }
    .brand-header {
      padding: 16px 20px;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      gap: 12px;
      background: rgba(17, 24, 39, 0.95);
    }
    .brand-icon {
      width: 34px;
      height: 34px;
      background: linear-gradient(135deg, #0284c7, #38bdf8);
      border-radius: 9px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(56, 189, 248, 0.3);
    }
    .brand-title { font-size: 15px; font-weight: 700; color: #fff; }
    .brand-sub { font-size: 11px; color: var(--accent); }
    .project-info {
      padding: 12px 18px;
      background: rgba(15, 23, 42, 0.6);
      border-bottom: 1px solid var(--border);
      font-size: 12px;
    }
    .project-url {
      color: var(--text-muted);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      margin-bottom: 4px;
    }
    .project-stats {
      display: flex;
      gap: 10px;
      color: #cbd5e1;
      font-size: 11px;
    }
    .screen-list {
      flex: 1;
      overflow-y: auto;
      padding: 10px 8px;
    }
    .screen-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 12px;
      border-radius: 8px;
      cursor: pointer;
      margin-bottom: 5px;
      border: 1px solid transparent;
      transition: all 0.15s ease;
    }
    .screen-item:hover {
      background: #1e293b;
      border-color: var(--border-light);
    }
    .screen-item.active {
      background: rgba(2, 132, 199, 0.18);
      border-color: var(--accent);
    }
    .screen-item-info { flex: 1; min-width: 0; }
    .screen-item-title {
      font-size: 13px;
      font-weight: 600;
      color: #fff;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .screen-item-meta {
      font-size: 10px;
      color: var(--text-muted);
      margin-top: 2px;
      display: flex;
      gap: 5px;
      align-items: center;
    }
    .pill {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 600;
      background: var(--badge-bg);
      color: #94a3b8;
    }
    .pill.green { background: rgba(16, 185, 129, 0.2); color: #34d399; }
    .pill.blue { background: rgba(56, 189, 248, 0.2); color: #38bdf8; }
    .pill.orange { background: rgba(245, 158, 11, 0.2); color: #fbbf24; }
    .pill.red { background: rgba(239, 68, 68, 0.2); color: #f87171; }

    .main-workspace {
      flex: 1;
      display: flex;
      flex-direction: column;
      height: 100%;
      background: #060911;
      overflow: hidden;
    }
    .top-toolbar {
      height: 60px;
      background: var(--card-bg);
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 24px;
    }
    .toolbar-left {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .current-screen-title {
      font-size: 16px;
      font-weight: 700;
      color: #fff;
    }
    .view-switcher {
      display: flex;
      background: #0f172a;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 3px;
      gap: 2px;
    }
    .view-btn {
      background: transparent;
      border: none;
      color: var(--text-muted);
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s;
    }
    .view-btn:hover { color: #fff; }
    .view-btn.active {
      background: var(--accent);
      color: #04101e;
      box-shadow: 0 2px 8px rgba(56, 189, 248, 0.4);
    }
    .toolbar-right {
      display: flex;
      gap: 10px;
    }
    .btn-action {
      background: #1e293b;
      border: 1px solid var(--border-light);
      color: #f1f5f9;
      padding: 7px 14px;
      border-radius: 7px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s;
    }
    .btn-action:hover { background: #334155; }

    .viewport-stage {
      flex: 1;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 20px;
      overflow: auto;
      position: relative;
    }
    .desktop-container {
      width: 100%;
      height: 100%;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5);
      border: 1px solid var(--border);
      background: #fff;
    }
    .desktop-container iframe {
      width: 100%;
      height: 100%;
      border: none;
      display: block;
    }

    .mobile-phone-frame {
      width: 390px;
      height: 844px;
      border-radius: 46px;
      border: 12px solid #1e293b;
      box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.8), 0 0 0 1px #334155;
      background: #000;
      position: relative;
      overflow: hidden;
      flex-shrink: 0;
    }
    .mobile-phone-notch {
      position: absolute;
      top: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 120px;
      height: 25px;
      background: #1e293b;
      border-bottom-left-radius: 16px;
      border-bottom-right-radius: 16px;
      z-index: 20;
      pointer-events: none;
    }
    .mobile-phone-frame iframe {
      width: 100%;
      height: 100%;
      border: none;
      background: #fff;
    }

    .compare-container {
      display: flex;
      width: 100%;
      height: 100%;
      gap: 16px;
    }
    .compare-pane {
      flex: 1;
      display: flex;
      flex-direction: column;
      border: 1px solid var(--border);
      border-radius: 8px;
      overflow: hidden;
      background: var(--card-bg);
    }
    .compare-pane-header {
      padding: 10px 16px;
      background: #131d2e;
      border-bottom: 1px solid var(--border);
      font-size: 12px;
      font-weight: 600;
      color: var(--accent);
      display: flex;
      justify-content: space-between;
    }
    .compare-pane-content {
      flex: 1;
      overflow: auto;
      background: #fff;
      display: flex;
      justify-content: center;
      align-items: flex-start;
    }
    .compare-pane-content iframe {
      width: 100%;
      height: 100%;
      border: none;
    }
    .compare-pane-content img {
      max-width: 100%;
      height: auto;
      display: block;
    }

    .code-view {
      display: none;
      width: 100%;
      height: 100%;
      padding: 24px;
      overflow: auto;
      background: #0a0f1d;
    }
    .code-view.active { display: block; }
    pre.code-box {
      background: #030712;
      border: 1px solid var(--border);
      padding: 18px;
      border-radius: 8px;
      color: #38bdf8;
      font-family: Consolas, Monaco, monospace;
      font-size: 12px;
      line-height: 1.5;
      overflow: auto;
    }

    /* Sağlık Raporu Görünümü */
    .health-container {
      display: flex;
      flex-direction: column;
      gap: 20px;
      max-width: 1100px;
      margin: 0 auto;
    }
    .kpi-row {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 14px;
    }
    .kpi-card {
      background: #111827;
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .kpi-val { font-size: 24px; font-weight: 700; color: #fff; }
    .kpi-lbl { font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }

    .health-table {
      width: 100%;
      border-collapse: collapse;
      background: #111827;
      border: 1px solid var(--border);
      border-radius: 8px;
      overflow: hidden;
      font-size: 12px;
    }
    .health-table th {
      background: #1e293b;
      padding: 10px 14px;
      text-align: left;
      font-weight: 600;
      color: #f1f5f9;
      border-bottom: 1px solid var(--border);
    }
    .health-table td {
      padding: 10px 14px;
      border-bottom: 1px solid var(--border);
      color: #cbd5e1;
    }
    .health-table tr:hover td {
      background: rgba(255, 255, 255, 0.02);
    }
  </style>
</head>
<body>
  <!-- Sol Menü -->
  <aside class="sidebar">
    <div class="brand-header">
      <div class="brand-icon">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" stroke-width="2.5">
          <polyline points="16 18 22 12 16 6"></polyline>
          <polyline points="8 6 2 12 8 18"></polyline>
        </svg>
      </div>
      <div>
        <div class="brand-title">SnapHTML Portal</div>
        <div class="brand-sub">Dual-Viewport & Health V2.1</div>
      </div>
    </div>

    <div class="project-info">
      <div class="project-url" title="${manifest.projectUrl}">${manifest.projectUrl}</div>
      <div class="project-stats">
        <span>Ekran: <strong>${manifest.screens.length}</strong></span>
        <span>Eşleşen: <strong>${healthData.summary.matchedScreens}</strong></span>
        <span>Atlanan Güvenlik: <strong>${healthData.summary.skippedUnsafeInteractions}</strong></span>
      </div>
    </div>

    <div class="screen-list" id="screenList"></div>
  </aside>

  <!-- Sağ Çalışma Alanı -->
  <main class="main-workspace">
    <header class="top-toolbar">
      <div class="toolbar-left">
        <h2 class="current-screen-title" id="screenTitle">Yükleniyor...</h2>
        <span class="pill blue" id="screenLogicalId">screen_id</span>
        <span class="pill green" id="screenStatusBadge">PASS</span>
      </div>

      <!-- Viewport & Rapor Seçici -->
      <div class="view-switcher">
        <button class="view-btn active" data-mode="desktop">
          <span>🖥️ Masaüstü</span>
        </button>
        <button class="view-btn" data-mode="mobile">
          <span>📱 Mobil (390px)</span>
        </button>
        <button class="view-btn" data-mode="compare">
          <span>⚖️ Karşılaştır</span>
        </button>
        <button class="view-btn" data-mode="health">
          <span>🩺 Sağlık Raporu</span>
        </button>
        <button class="view-btn" data-mode="manifest">
          <span>📋 Manifest</span>
        </button>
      </div>

      <div class="toolbar-right">
        <button class="btn-action" id="btnOpenNewTab" title="Aktif görünümü yeni sekmede aç">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
          </svg>
          <span>Yeni Sekmede Aç</span>
        </button>
      </div>
    </header>

    <!-- Sahne -->
    <div class="viewport-stage" id="stageContainer">
      <!-- Masaüstü Görünümü -->
      <div class="desktop-container" id="desktopView">
        <iframe id="desktopIframe" src=""></iframe>
      </div>

      <!-- Mobil Görünümü (390px Çerçeveli) -->
      <div class="mobile-phone-frame" id="mobileView" style="display: none;">
        <div class="mobile-phone-notch"></div>
        <iframe id="mobileIframe" src=""></iframe>
      </div>

      <!-- Karşılaştırma Split View -->
      <div class="compare-container" id="compareView" style="display: none;">
        <div class="compare-pane">
          <div class="compare-pane-header">
            <span>Canlı Klon HTML (Mobil 390px)</span>
            <span class="pill green">Rendered DOM</span>
          </div>
          <div class="compare-pane-content">
            <iframe id="compareIframe" src=""></iframe>
          </div>
        </div>
        <div class="compare-pane">
          <div class="compare-pane-header">
            <span>Yakalama Anı Ekran Görüntüsü (CDP Screenshot PNG)</span>
            <span class="pill blue">Gerçek Piksel</span>
          </div>
          <div class="compare-pane-content">
            <img id="compareScreenshot" src="" alt="Screenshot">
          </div>
        </div>
      </div>

      <!-- Sağlık Raporu Görünümü -->
      <div class="code-view" id="healthView">
        <div class="health-container">
          <div class="kpi-row">
            <div class="kpi-card">
              <span class="kpi-val" style="color: #38bdf8;">${healthData.summary.discoveredScreens}</span>
              <span class="kpi-lbl">Keşfedilen Ekran</span>
            </div>
            <div class="kpi-card">
              <span class="kpi-val" style="color: #10b981;">${healthData.summary.matchedScreens}</span>
              <span class="kpi-lbl">Kusursuz Eşleşen (Dual)</span>
            </div>
            <div class="kpi-card">
              <span class="kpi-val" style="color: #f59e0b;">${healthData.summary.unmatchedScreens}</span>
              <span class="kpi-lbl">Kısmi / Eşleşmeyen</span>
            </div>
            <div class="kpi-card">
              <span class="kpi-val" style="color: #ef4444;">${healthData.summary.modalBlockedCaptures}</span>
              <span class="kpi-lbl">Modal Engeli</span>
            </div>
          </div>

          <table class="health-table">
            <thead>
              <tr>
                <th>Ekran Başlığı</th>
                <th>Mantıksal ID</th>
                <th>Durum</th>
                <th>Desktop</th>
                <th>Mobile</th>
                <th>Navigasyon Rotası</th>
              </tr>
            </thead>
            <tbody>
              ${healthData.screens.map(sc => `
                <tr>
                  <td><strong>${sc.title}</strong></td>
                  <td><code>${sc.logicalId}</code></td>
                  <td><span class="pill ${sc.status === 'PASS' ? 'green' : sc.status === 'BLOCKED_BY_MODAL' ? 'red' : 'orange'}">${sc.status}</span></td>
                  <td><span class="pill ${sc.desktopStatus === 'PASS' ? 'green' : 'orange'}">${sc.desktopStatus}</span></td>
                  <td><span class="pill ${sc.mobileStatus === 'PASS' ? 'green' : 'orange'}">${sc.mobileStatus}</span></td>
                  <td><small>${sc.navigationPath}</small></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Manifest İnceleyici -->
      <div class="code-view" id="manifestView">
        <pre class="code-box" id="manifestJsonCode"></pre>
      </div>
    </div>
  </main>

  <script>
    const manifest = ${manifestJson};
    let currentIndex = 0;
    let currentMode = 'desktop';

    const screenListEl = document.getElementById('screenList');
    const screenTitleEl = document.getElementById('screenTitle');
    const screenLogicalIdEl = document.getElementById('screenLogicalId');
    const screenStatusBadge = document.getElementById('screenStatusBadge');
    const viewButtons = document.querySelectorAll('.view-btn');

    const desktopView = document.getElementById('desktopView');
    const mobileView = document.getElementById('mobileView');
    const compareView = document.getElementById('compareView');
    const healthView = document.getElementById('healthView');
    const manifestView = document.getElementById('manifestView');

    const desktopIframe = document.getElementById('desktopIframe');
    const mobileIframe = document.getElementById('mobileIframe');
    const compareIframe = document.getElementById('compareIframe');
    const compareScreenshot = document.getElementById('compareScreenshot');
    const manifestJsonCode = document.getElementById('manifestJsonCode');
    const btnOpenNewTab = document.getElementById('btnOpenNewTab');

    manifestJsonCode.textContent = JSON.stringify(manifest, null, 2);

    function renderScreenList() {
      screenListEl.innerHTML = manifest.screens.map((s, idx) => {
        const isMatched = s.desktop && s.mobile;
        const statusBadge = s.status === 'BLOCKED_BY_MODAL' ? '<span class="pill red">MODAL</span>' : (isMatched ? '<span class="pill green">DUAL</span>' : '<span class="pill orange">PARTIAL</span>');
        return \`
          <div class="screen-item \${idx === currentIndex ? 'active' : ''}" data-index="\${idx}">
            <div class="screen-item-info">
              <div class="screen-item-title">\${idx + 1}. \${s.title}</div>
              <div class="screen-item-meta">
                <span class="pill">\${s.logicalId}</span>
                \${statusBadge}
              </div>
            </div>
          </div>
        \`;
      }).join('');

      document.querySelectorAll('.screen-item').forEach(item => {
        item.addEventListener('click', () => {
          const idx = parseInt(item.dataset.index, 10);
          selectScreen(idx);
        });
      });
    }

    function selectScreen(index) {
      currentIndex = index;
      const screen = manifest.screens[index];
      if (!screen) return;

      screenTitleEl.textContent = \`\${index + 1}. \${screen.title}\`;
      screenLogicalIdEl.textContent = screen.logicalId;

      const st = screen.status || 'PASS';
      screenStatusBadge.textContent = st;
      screenStatusBadge.className = 'pill ' + (st === 'PASS' ? 'green' : (st === 'BLOCKED_BY_MODAL' ? 'red' : 'orange'));

      document.querySelectorAll('.screen-item').forEach((item, idx) => {
        item.classList.toggle('active', idx === index);
      });

      const desktopPath = screen.desktop?.htmlPath || '';
      const mobilePath = screen.mobile?.htmlPath || screen.desktop?.htmlPath || '';
      const screenshotPath = screen.mobile?.screenshotPath || screen.desktop?.screenshotPath || '';

      if (desktopPath) desktopIframe.src = desktopPath;
      if (mobilePath) mobileIframe.src = mobilePath;
      if (mobilePath) compareIframe.src = mobilePath;
      if (screenshotPath) compareScreenshot.src = screenshotPath;
    }

    function setViewMode(mode) {
      currentMode = mode;
      viewButtons.forEach(b => b.classList.toggle('active', b.dataset.mode === mode));

      desktopView.style.display = mode === 'desktop' ? 'block' : 'none';
      mobileView.style.display = mode === 'mobile' ? 'block' : 'none';
      compareView.style.display = mode === 'compare' ? 'flex' : 'none';
      healthView.style.display = mode === 'health' ? 'block' : 'none';
      manifestView.style.display = mode === 'manifest' ? 'block' : 'none';
    }

    viewButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        setViewMode(btn.dataset.mode);
      });
    });

    btnOpenNewTab.addEventListener('click', () => {
      const screen = manifest.screens[currentIndex];
      if (!screen) return;
      const path = currentMode === 'mobile' ? (screen.mobile?.htmlPath || screen.desktop?.htmlPath) : (screen.desktop?.htmlPath || screen.mobile?.htmlPath);
      if (path) window.open(path, '_blank');
    });

    renderScreenList();
    if (manifest.screens.length > 0) {
      selectScreen(0);
    }
  </script>
</body>
</html>`;
}
