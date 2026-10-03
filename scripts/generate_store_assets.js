const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const PROJECT_DIR = path.resolve(__dirname, '..');
const ICONS_DIR = path.join(PROJECT_DIR, 'icons');
const STORE_ASSETS_DIR = path.join(PROJECT_DIR, 'store-assets');

if (!fs.existsSync(ICONS_DIR)) fs.mkdirSync(ICONS_DIR, { recursive: true });
if (!fs.existsSync(STORE_ASSETS_DIR)) fs.mkdirSync(STORE_ASSETS_DIR, { recursive: true });

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

function captureHtml(htmlContent, width, height, outputPath) {
  const tempHtmlPath = path.join(os.tmpdir(), `snap_render_${Date.now()}_${Math.random().toString(36).substring(2, 6)}.html`);
  const tempPngPath = path.join(os.tmpdir(), `snap_shot_${Date.now()}_${Math.random().toString(36).substring(2, 6)}.png`);

  fs.writeFileSync(tempHtmlPath, htmlContent, 'utf-8');

  const fileUrl = `file:///${tempHtmlPath.replace(/\\/g, '/')}`;
  const cmd = `"${CHROME_PATH}" --headless=new --disable-gpu --force-device-scale-factor=1 --window-size=${width},${height} --screenshot="${tempPngPath}" "${fileUrl}"`;

  try {
    execSync(cmd, { stdio: 'pipe' });
    if (fs.existsSync(tempPngPath)) {
      fs.copyFileSync(tempPngPath, outputPath);
      fs.unlinkSync(tempPngPath);
      console.log(`[OK] Generated: ${path.relative(PROJECT_DIR, outputPath)} (${width}x${height})`);
    } else {
      console.error(`[ERROR] Output not found for ${outputPath}`);
    }
  } catch (err) {
    console.error(`[FAIL] Error rendering ${outputPath}:`, err.message);
  } finally {
    if (fs.existsSync(tempHtmlPath)) {
      try { fs.unlinkSync(tempHtmlPath); } catch {}
    }
  }
}

// 1. İKON ÜRETİMİ (16, 32, 48, 128)
function getIconHtml(size) {
  const radius = Math.round(size * 0.22);
  const strokeW = Math.max(1.5, Math.round(size * 0.085));
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: ${size}px;
    height: ${size}px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    overflow: hidden;
  }
  .icon-box {
    width: ${size}px;
    height: ${size}px;
    border-radius: ${radius}px;
    background: linear-gradient(135deg, #06b6d4 0%, #0284c7 50%, #2563eb 100%);
    box-shadow: inset 0 1px 2px rgba(255,255,255,0.4), 0 ${Math.max(1, Math.round(size*0.05))}px ${Math.max(2, Math.round(size*0.1))}px rgba(0,0,0,0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
  }
  svg {
    width: ${Math.round(size * 0.72)}px;
    height: ${Math.round(size * 0.72)}px;
  }
</style>
</head>
<body>
  <div class="icon-box">
    <svg viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="${strokeW / (size / 24)}" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="16 18 22 12 16 6"></polyline>
      <polyline points="8 6 2 12 8 18"></polyline>
      <line x1="14" y1="4" x2="10" y2="20" stroke="#38bdf8"></line>
    </svg>
  </div>
</body>
</html>`;
}

// İkonları oluştur
[16, 32, 48, 128].forEach(size => {
  captureHtml(getIconHtml(size), size, size, path.join(ICONS_DIR, `icon${size}.png`));
});
// Store icon (128x128)
captureHtml(getIconHtml(128), 128, 128, path.join(STORE_ASSETS_DIR, 'icon-128.png'));

// 2. KÜÇÜK TANITIM KARTI (Small Promo Tile - 440 x 280)
const promoSmallHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 440px;
    height: 280px;
    background: radial-gradient(circle at 80% 20%, #1e293b 0%, #090d16 100%);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    color: #ffffff;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
  }
  .bg-glow {
    position: absolute;
    width: 260px;
    height: 260px;
    background: radial-gradient(circle, rgba(6, 182, 212, 0.25) 0%, rgba(2, 132, 199, 0.05) 60%, transparent 80%);
    top: -40px;
    left: 50%;
    transform: translateX(-50%);
    border-radius: 50%;
    pointer-events: none;
  }
  .logo-row {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 12px;
    z-index: 2;
  }
  .icon-wrap {
    width: 58px;
    height: 58px;
    border-radius: 14px;
    background: linear-gradient(135deg, #06b6d4, #0284c7, #2563eb);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 8px 24px rgba(6, 182, 212, 0.4), inset 0 1px 1px rgba(255,255,255,0.4);
  }
  .brand-name {
    font-size: 32px;
    font-weight: 800;
    letter-spacing: -0.5px;
    background: linear-gradient(to right, #ffffff, #e0f2fe);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  .badge {
    display: inline-block;
    background: rgba(6, 182, 212, 0.15);
    border: 1px solid rgba(6, 182, 212, 0.4);
    color: #38bdf8;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    padding: 3px 8px;
    border-radius: 20px;
    letter-spacing: 0.5px;
  }
  .tagline {
    font-size: 13.5px;
    color: #94a3b8;
    text-align: center;
    max-width: 360px;
    line-height: 1.45;
    margin-bottom: 18px;
    z-index: 2;
  }
  .features-row {
    display: flex;
    gap: 8px;
    z-index: 2;
  }
  .pill {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 20px;
    padding: 6px 12px;
    font-size: 11px;
    font-weight: 600;
    color: #cbd5e1;
    display: flex;
    align-items: center;
    gap: 5px;
    backdrop-filter: blur(8px);
  }
</style>
</head>
<body>
  <div class="bg-glow"></div>
  <div class="logo-row">
    <div class="icon-wrap">
      <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="16 18 22 12 16 6"></polyline>
        <polyline points="8 6 2 12 8 18"></polyline>
        <line x1="14" y1="4" x2="10" y2="20" stroke="#bae6fd"></line>
      </svg>
    </div>
    <div>
      <div class="brand-name">SnapHTML</div>
      <span class="badge">Multi-Level AI Mirror</span>
    </div>
  </div>
  <p class="tagline">Clone any web app into standalone offline HTML or multi-page ZIP package ready for AI.</p>
  <div class="features-row">
    <div class="pill"><span>📄</span> Standalone .HTML</div>
    <div class="pill"><span>🗂️</span> Multi-Page .ZIP</div>
    <div class="pill"><span>🤖</span> AI Mirror</div>
  </div>
</body>
</html>`;
captureHtml(promoSmallHtml, 440, 280, path.join(STORE_ASSETS_DIR, 'promo-small-440x280.png'));

// 3. GENİŞ TANITIM BANNERI (Marquee Promo Tile - 1400 x 560)
const promoMarqueeHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 1400px;
    height: 560px;
    background: linear-gradient(135deg, #090d16 0%, #0f172a 50%, #0a1122 100%);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    color: #ffffff;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 80px;
    position: relative;
    overflow: hidden;
  }
  .grid-pattern {
    position: absolute;
    inset: 0;
    background-image: linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
    background-size: 40px 40px;
    pointer-events: none;
  }
  .glow-cyan {
    position: absolute;
    width: 600px;
    height: 600px;
    background: radial-gradient(circle, rgba(6, 182, 212, 0.18) 0%, transparent 70%);
    top: -150px;
    left: 20%;
    pointer-events: none;
  }
  .glow-blue {
    position: absolute;
    width: 500px;
    height: 500px;
    background: radial-gradient(circle, rgba(37, 99, 235, 0.18) 0%, transparent 70%);
    bottom: -100px;
    right: 10%;
    pointer-events: none;
  }
  .left-content {
    max-width: 620px;
    z-index: 2;
  }
  .brand-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: rgba(6, 182, 212, 0.12);
    border: 1px solid rgba(6, 182, 212, 0.35);
    color: #38bdf8;
    padding: 6px 14px;
    border-radius: 30px;
    font-size: 13px;
    font-weight: 700;
    margin-bottom: 24px;
  }
  .headline {
    font-size: 46px;
    font-weight: 800;
    line-height: 1.15;
    margin-bottom: 18px;
    letter-spacing: -0.5px;
  }
  .headline span {
    background: linear-gradient(135deg, #38bdf8 0%, #818cf8 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  .subheadline {
    font-size: 18px;
    color: #94a3b8;
    line-height: 1.55;
    margin-bottom: 32px;
  }
  .badges-list {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }
  .feature-tag {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    padding: 10px 16px;
    font-size: 14px;
    font-weight: 600;
    color: #e2e8f0;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .right-mockup {
    position: relative;
    z-index: 2;
    width: 520px;
    height: 420px;
    perspective: 1000px;
  }
  .card-popup {
    width: 380px;
    background: rgba(15, 23, 42, 0.88);
    border: 1px solid rgba(255, 255, 255, 0.15);
    backdrop-filter: blur(20px);
    border-radius: 20px;
    padding: 24px;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 30px rgba(6, 182, 212, 0.25);
    transform: rotateY(-8deg) rotateX(4deg);
  }
  .pop-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
  }
  .pop-title {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 18px;
    font-weight: 700;
  }
  .pop-icon {
    width: 32px;
    height: 32px;
    background: linear-gradient(135deg, #06b6d4, #0284c7);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .depth-pills {
    display: flex;
    gap: 8px;
    margin-bottom: 20px;
    background: rgba(0,0,0,0.3);
    padding: 4px;
    border-radius: 12px;
  }
  .d-pill {
    flex: 1;
    text-align: center;
    padding: 10px 0;
    font-size: 12px;
    font-weight: 600;
    border-radius: 8px;
    color: #94a3b8;
  }
  .d-pill.active {
    background: #0284c7;
    color: #ffffff;
    box-shadow: 0 2px 8px rgba(2, 132, 199, 0.5);
  }
  .pop-btn {
    background: linear-gradient(135deg, #0284c7, #2563eb);
    color: white;
    font-weight: 700;
    font-size: 14px;
    text-align: center;
    padding: 12px;
    border-radius: 12px;
    margin-bottom: 12px;
    box-shadow: 0 4px 14px rgba(2, 132, 199, 0.4);
  }
  .pop-meta {
    font-size: 12px;
    color: #64748b;
    text-align: center;
  }
</style>
</head>
<body>
  <div class="grid-pattern"></div>
  <div class="glow-cyan"></div>
  <div class="glow-blue"></div>

  <div class="left-content">
    <div class="brand-badge">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
      CHROME EXTENSION MANIFEST V3
    </div>
    <h1 class="headline">Freeze Any Web Project into <span>Standalone Code</span></h1>
    <p class="subheadline">Capture entire live DOM states, styles, Base64 fonts, and deep multi-page tabs into independent offline HTML or a connected ZIP website — 100% prepared for Claude, Cursor & ChatGPT.</p>
    <div class="badges-list">
      <div class="feature-tag"><span>🚀</span> Single-File Standalone HTML</div>
      <div class="feature-tag"><span>🔗</span> Recursive Multi-Page Crawl</div>
      <div class="feature-tag"><span>🤖</span> AI Architecture Mirror</div>
      <div class="feature-tag"><span>🔒</span> 100% Client-Side & Private</div>
    </div>
  </div>

  <div class="right-mockup">
    <div class="card-popup">
      <div class="pop-header">
        <div class="pop-title">
          <div class="pop-icon">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" stroke-width="2.5"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
          </div>
          SnapHTML
        </div>
        <span style="font-size: 11px; background: rgba(16, 185, 129, 0.2); color: #34d399; padding: 2px 8px; border-radius: 10px; font-weight: 700;">ACTIVE</span>
      </div>

      <div style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 12px; margin-bottom: 16px;">
        <div style="font-size: 11px; color: #38bdf8; font-weight: 600;">localhost:3000/dashboard</div>
        <div style="font-size: 13px; font-weight: 600; color: #f8fafc; margin-top: 2px;">SaaS Analytics & AI Studio</div>
        <div style="font-size: 11px; color: #94a3b8; margin-top: 6px;">1,420 DOM Nodes • 14 Internal Tabs</div>
      </div>

      <div class="depth-pills">
        <div class="d-pill">0: Tek Sayfa</div>
        <div class="d-pill active">1: Sekmeler</div>
        <div class="d-pill">2: Tam Site</div>
      </div>

      <div class="pop-btn">⚡ Seviye 1: Sekmeleri Klonla (.zip)</div>
      <div class="pop-meta">CSS, Web Fontları ve Canvas Grafikleri Dahil</div>
    </div>
  </div>
</body>
</html>`;
captureHtml(promoMarqueeHtml, 1400, 560, path.join(STORE_ASSETS_DIR, 'promo-marquee-1400x560.png'));

// 4. SCREENSHOT 1: Popup & Instant Standalone HTML (1280 x 800)
const screenshot1Html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 1280px;
    height: 800px;
    background: #0b1120;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #fff;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  /* Top Banner Callout */
  .banner-header {
    background: linear-gradient(90deg, #0284c7 0%, #0ea5e9 50%, #06b6d4 100%);
    padding: 16px 40px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    box-shadow: 0 4px 20px rgba(2, 132, 199, 0.3);
  }
  .banner-title {
    font-size: 20px;
    font-weight: 800;
    letter-spacing: -0.3px;
  }
  .banner-sub {
    font-size: 14px;
    opacity: 0.9;
    font-weight: 500;
  }
  /* Browser Window Mockup */
  .browser-canvas {
    flex: 1;
    margin: 20px 40px 30px;
    background: #0f172a;
    border-radius: 12px;
    border: 1px solid #1e293b;
    box-shadow: 0 20px 50px rgba(0,0,0,0.5);
    display: flex;
    flex-direction: column;
    position: relative;
    overflow: hidden;
  }
  .browser-bar {
    height: 42px;
    background: #1e293b;
    display: flex;
    align-items: center;
    padding: 0 16px;
    gap: 12px;
    border-bottom: 1px solid #334155;
  }
  .dots { display: flex; gap: 6px; }
  .dot { width: 10px; height: 10px; border-radius: 50%; }
  .dot-red { background: #ef4444; }
  .dot-yellow { background: #f59e0b; }
  .dot-green { background: #10b981; }
  .url-bar {
    flex: 1;
    max-width: 480px;
    background: #0f172a;
    border-radius: 6px;
    height: 26px;
    display: flex;
    align-items: center;
    padding: 0 12px;
    font-size: 12px;
    color: #94a3b8;
  }
  .browser-body {
    flex: 1;
    display: flex;
    position: relative;
    background: #0b1120;
  }
  /* Background Dashboard Mock */
  .mock-dash {
    flex: 1;
    padding: 30px;
    opacity: 0.6;
    filter: blur(1px);
    display: grid;
    grid-template-columns: 240px 1fr;
    gap: 20px;
  }
  .mock-sidebar {
    background: #1e293b;
    border-radius: 8px;
    height: 100%;
  }
  .mock-content {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .mock-cards {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
    height: 120px;
  }
  .m-card { background: #1e293b; border-radius: 8px; }
  .m-main-chart { background: #1e293b; border-radius: 8px; height: 340px; }

  /* SnapHTML Popup Floating */
  .floating-popup {
    position: absolute;
    top: 20px;
    right: 50px;
    width: 380px;
    background: #0f172a;
    border: 1px solid rgba(56, 189, 248, 0.4);
    border-radius: 16px;
    padding: 22px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.8), 0 0 35px rgba(2, 132, 199, 0.3);
    z-index: 10;
  }
  .pop-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
  }
  .pop-logo {
    display: flex;
    align-items: center;
    gap: 10px;
    font-weight: 800;
    font-size: 17px;
  }
  .pop-icon-box {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: linear-gradient(135deg, #06b6d4, #0284c7);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .active-card {
    background: rgba(30, 41, 59, 0.7);
    border: 1px solid #334155;
    border-radius: 10px;
    padding: 12px;
    margin-bottom: 16px;
  }
  .dom-chips {
    display: flex;
    gap: 8px;
    margin-top: 8px;
  }
  .dom-chip {
    background: rgba(2, 132, 199, 0.15);
    border: 1px solid rgba(2, 132, 199, 0.3);
    color: #38bdf8;
    font-size: 11px;
    font-weight: 600;
    padding: 4px 8px;
    border-radius: 6px;
  }
  .depth-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
    margin-bottom: 18px;
  }
  .d-btn {
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 8px;
    padding: 10px 4px;
    text-align: center;
    cursor: pointer;
  }
  .d-btn.active {
    background: #0284c7;
    border-color: #38bdf8;
    color: #fff;
    box-shadow: 0 0 15px rgba(2, 132, 199, 0.5);
  }
  .d-btn .num { font-size: 16px; font-weight: 800; display: block; }
  .d-btn .lbl { font-size: 10px; opacity: 0.8; }
  .action-btn {
    background: linear-gradient(135deg, #0284c7 0%, #2563eb 100%);
    color: #fff;
    font-weight: 700;
    font-size: 14px;
    text-align: center;
    padding: 14px;
    border-radius: 10px;
    margin-bottom: 10px;
    box-shadow: 0 4px 15px rgba(2, 132, 199, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }
  .sec-btn {
    background: #1e293b;
    color: #cbd5e1;
    font-size: 13px;
    font-weight: 600;
    text-align: center;
    padding: 11px;
    border-radius: 8px;
    border: 1px solid #334155;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }
  .feature-callout {
    position: absolute;
    left: 40px;
    bottom: 50px;
    background: rgba(15, 23, 42, 0.95);
    border: 1px solid #38bdf8;
    padding: 18px 24px;
    border-radius: 12px;
    max-width: 420px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.6);
  }
  .callout-title { font-size: 16px; font-weight: 700; color: #38bdf8; margin-bottom: 6px; }
  .callout-desc { font-size: 13px; color: #94a3b8; line-height: 1.5; }
</style>
</head>
<body>
  <div class="banner-header">
    <div class="banner-title">⚡ SnapHTML — Tek Tıkla Standalone Web Klonlama</div>
    <div class="banner-sub">CSS, Web Fontları, Resimler ve Form Durumu Tek Parça .html Dosyasına Mühürlenir</div>
  </div>

  <div class="browser-canvas">
    <div class="browser-bar">
      <div class="dots">
        <div class="dot dot-red"></div>
        <div class="dot dot-yellow"></div>
        <div class="dot dot-green"></div>
      </div>
      <div class="url-bar">🔒 https://app.analytics-cloud.io/dashboard</div>
    </div>

    <div class="browser-body">
      <div class="mock-dash">
        <div class="mock-sidebar"></div>
        <div class="mock-content">
          <div class="mock-cards">
            <div class="m-card"></div>
            <div class="m-card"></div>
            <div class="m-card"></div>
          </div>
          <div class="m-main-chart"></div>
        </div>
      </div>

      <div class="floating-popup">
        <div class="pop-head">
          <div class="pop-logo">
            <div class="pop-icon-box">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" stroke-width="2.5"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
            </div>
            SnapHTML
          </div>
          <span style="font-size: 11px; color: #38bdf8; font-weight: 700;">v1.0.0</span>
        </div>

        <div class="active-card">
          <div style="font-size: 11px; color: #38bdf8; font-weight: 700;">app.analytics-cloud.io</div>
          <div style="font-size: 13px; font-weight: 600; color: #f1f5f9; margin-top: 2px;">Cloud Analytics — Live Overview</div>
          <div class="dom-chips">
            <div class="dom-chip">1,420 DOM</div>
            <div class="dom-chip">14 İç Link</div>
            <div class="dom-chip">Tailwind + React</div>
          </div>
        </div>

        <div style="font-size: 11px; font-weight: 700; color: #94a3b8; margin-bottom: 8px;">KLONLAMA DERİNLİĞİ</div>
        <div class="depth-grid">
          <div class="d-btn active">
            <span class="num">0</span>
            <span class="lbl">Tek Sayfa</span>
          </div>
          <div class="d-btn">
            <span class="num">1</span>
            <span class="lbl">Sekmeler</span>
          </div>
          <div class="d-btn">
            <span class="num">2</span>
            <span class="lbl">Tam Site</span>
          </div>
        </div>

        <div class="action-btn">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#fff" stroke-width="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          Sayfayı Klonla & İndir (.html)
        </div>

        <div class="sec-btn">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
          Önizleme & Test Sekmesinde Aç
        </div>
      </div>

      <div class="feature-callout">
        <div class="callout-title">📦 Bağımsız, Tek Parça HTML</div>
        <div class="callout-desc">İnternet bağlantısı veya yerel sunucu gerekmeden çift tıklandığında açılır. Form verileri, Canvas grafikleri ve modern CSS grid/flex stilleri %100 korunur.</div>
      </div>
    </div>
  </div>
</body>
</html>`;
captureHtml(screenshot1Html, 1280, 800, path.join(STORE_ASSETS_DIR, 'screenshot-1-instant-clone.png'));

// 5. SCREENSHOT 2: Multi-Page Crawl & ZIP (1280 x 800)
const screenshot2Html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 1280px;
    height: 800px;
    background: #090d16;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #fff;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .banner-header {
    background: linear-gradient(90deg, #059669 0%, #10b981 50%, #14b8a6 100%);
    padding: 16px 40px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .banner-title { font-size: 20px; font-weight: 800; }
  .banner-sub { font-size: 14px; font-weight: 500; opacity: 0.95; }
  .content-grid {
    flex: 1;
    display: grid;
    grid-template-columns: 460px 1fr;
    gap: 30px;
    padding: 30px 40px;
  }
  .panel {
    background: #0f172a;
    border: 1px solid #1e293b;
    border-radius: 14px;
    padding: 24px;
    display: flex;
    flex-direction: column;
  }
  .panel-title {
    font-size: 16px;
    font-weight: 700;
    margin-bottom: 16px;
    display: flex;
    align-items: center;
    gap: 8px;
    color: #34d399;
  }
  .link-item {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    padding: 10px 14px;
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 13px;
  }
  .link-name { font-weight: 600; color: #f8fafc; }
  .link-path { font-size: 11px; color: #64748b; }
  .status-badge {
    background: rgba(16, 185, 129, 0.15);
    color: #34d399;
    font-size: 11px;
    padding: 3px 8px;
    border-radius: 6px;
    font-weight: 700;
  }
  .zip-tree {
    background: #020617;
    border: 1px solid #1e293b;
    border-radius: 10px;
    padding: 18px;
    font-family: monospace;
    font-size: 13px;
    line-height: 1.8;
    color: #cbd5e1;
    flex: 1;
  }
  .file-html { color: #38bdf8; }
  .file-md { color: #a78bfa; font-weight: 700; }
  .file-json { color: #f59e0b; }
  .zip-badge-box {
    margin-top: 16px;
    background: rgba(16, 185, 129, 0.1);
    border: 1px solid rgba(16, 185, 129, 0.3);
    border-radius: 10px;
    padding: 14px;
    display: flex;
    align-items: center;
    gap: 12px;
  }
</style>
</head>
<body>
  <div class="banner-header">
    <div class="banner-title">🗂️ Seviye 1 & 2: Çok Sayfalı Web Sitesi Paketi (.zip)</div>
    <div class="banner-sub">Sekmeler ve Alt Sayfalar Keşfedilir, İç Linkler Otomatik Olarak Yerelleştirilir</div>
  </div>

  <div class="content-grid">
    <div class="panel">
      <div class="panel-title">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
        Keşfedilen Sekmeler & Alt Sayfalar
      </div>
      <div class="link-item">
        <div>
          <div class="link-name">Genel Bakış (Ana Sayfa)</div>
          <div class="link-path">/dashboard ➔ index.html</div>
        </div>
        <span class="status-badge">Klonlandı ✓</span>
      </div>
      <div class="link-item">
        <div>
          <div class="link-name">Kullanıcı Davranış Raporu</div>
          <div class="link-path">/reports/behavior ➔ behavior.html</div>
        </div>
        <span class="status-badge">Klonlandı ✓</span>
      </div>
      <div class="link-item">
        <div>
          <div class="link-name">Yapay Zeka DNA ve Metrikler</div>
          <div class="link-path">/analytics/ai-dna ➔ ai_dna.html</div>
        </div>
        <span class="status-badge">Klonlandı ✓</span>
      </div>
      <div class="link-item">
        <div>
          <div class="link-name">Proje Ayarları & Entegrasyonlar</div>
          <div class="link-path">/settings/api ➔ settings_api.html</div>
        </div>
        <span class="status-badge">Klonlandı ✓</span>
      </div>
      <div class="link-item">
        <div>
          <div class="link-name">Fatura ve Abonelik Planları</div>
          <div class="link-path">/billing ➔ billing.html</div>
        </div>
        <span class="status-badge">Klonlandı ✓</span>
      </div>

      <div class="zip-badge-box">
        <span style="font-size: 24px;">✨</span>
        <div style="font-size: 12px; color: #94a3b8; line-height: 1.4;">
          <strong style="color: #fff;">Yerel Link Dönüştürme:</strong> Sayfalardaki <code style="color: #38bdf8;">href="/billing"</code> linkleri doğrudan yerel <code style="color: #34d399;">href="./billing.html"</code> dosyalarına bağlanır.
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-title">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg>
        Üretilen ZIP Paket Yapısı
      </div>
      <div class="zip-tree">
📦 myproject_Level1_Site.zip<br>
├── <span class="file-html">index.html</span> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style="color:#64748b;">(Ana Dashboard - Bütün stiller gömülü)</span><br>
├── <span class="file-html">behavior.html</span> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style="color:#64748b;">(Raporlar Sekmesi)</span><br>
├── <span class="file-html">ai_dna.html</span> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style="color:#64748b;">(Metrikler Sekmesi)</span><br>
├── <span class="file-html">settings_api.html</span> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style="color:#64748b;">(Ayarlar Sekmesi)</span><br>
├── <span class="file-html">billing.html</span> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style="color:#64748b;">(Faturalandırma Sekmesi)</span><br>
├── <span class="file-md">project_ai.md</span> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style="color:#a78bfa;">(AI Asistanları İçin Proje Röntgeni)</span><br>
└── <span class="file-json">sitemap.json</span> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style="color:#f59e0b;">(JSON Hiyerarşik Site Haritası)</span>
      </div>
      <div style="margin-top: 16px; font-size: 13px; color: #94a3b8; line-height: 1.5;">
        Çift tıklayıp ZIP'i açtığınızda <code style="color: #fff;">index.html</code> üzerinden sekmelere basarak tüm web sitesini internet olmadan gezebilir veya klasörü doğrudan <strong>Cursor / Claude Projects</strong> içine atabilirsiniz.
      </div>
    </div>
  </div>
</body>
</html>`;
captureHtml(screenshot2Html, 1280, 800, path.join(STORE_ASSETS_DIR, 'screenshot-2-multi-page-crawl.png'));

// 6. SCREENSHOT 3: Preview Workspace & Responsive Testing (1280 x 800)
const screenshot3Html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 1280px;
    height: 800px;
    background: #0f172a;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #fff;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .banner-header {
    background: linear-gradient(90deg, #7c3aed 0%, #8b5cf6 50%, #6366f1 100%);
    padding: 16px 40px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .banner-title { font-size: 20px; font-weight: 800; }
  .banner-sub { font-size: 14px; font-weight: 500; opacity: 0.95; }
  /* Preview Toolbar */
  .preview-toolbar {
    height: 56px;
    background: #090d16;
    border-bottom: 1px solid #1e293b;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 24px;
  }
  .tool-left { display: flex; align-items: center; gap: 14px; }
  .meta-tag {
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 6px;
    padding: 4px 10px;
    font-size: 12px;
    color: #cbd5e1;
  }
  .tool-center {
    display: flex;
    gap: 8px;
    background: #1e293b;
    padding: 4px;
    border-radius: 8px;
  }
  .view-tab {
    padding: 6px 14px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    color: #94a3b8;
  }
  .view-tab.active {
    background: #2563eb;
    color: #fff;
  }
  .device-pills {
    display: flex;
    gap: 6px;
    margin-left: 14px;
  }
  .dev-pill {
    background: #1e293b;
    border: 1px solid #334155;
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 12px;
    color: #cbd5e1;
  }
  .dev-pill.active {
    background: #0284c7;
    border-color: #38bdf8;
    color: #fff;
    font-weight: 700;
  }
  .tool-right { display: flex; gap: 10px; }
  .btn-purple {
    background: #7c3aed;
    color: #fff;
    padding: 8px 16px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 700;
  }
  .preview-area {
    flex: 1;
    background: #020617;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }
  .mock-iframe-frame {
    width: 820px;
    height: 100%;
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.7);
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .hero-box {
    background: linear-gradient(135deg, #1e293b, #0f172a);
    border: 1px solid #334155;
    border-radius: 8px;
    padding: 24px;
  }
  .grid-3 {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 14px;
    height: 180px;
  }
  .g-card {
    background: #1e293b;
    border-radius: 8px;
    border: 1px solid #334155;
    padding: 16px;
  }
</style>
</head>
<body>
  <div class="banner-header">
    <div class="banner-title">💻 Çoklu Cihaz Önizleme & Test Çalışma Alanı (Workspace)</div>
    <div class="banner-sub">IndexedDB ile Kota Sınırına Takılmadan Masaüstü, Tablet ve Mobil Görünümlerini Test Edin</div>
  </div>

  <div class="preview-toolbar">
    <div class="tool-left">
      <div style="font-weight: 800; font-size: 15px; color: #38bdf8;">SnapHTML</div>
      <div class="meta-tag">app.analytics.io</div>
      <div class="meta-tag">1.4 MB (Tüm Varlıklar Gömülü)</div>
      <div class="meta-tag">1,420 DOM</div>
    </div>

    <div style="display:flex; align-items:center;">
      <div class="tool-center">
        <div class="view-tab active">Canlı Klon</div>
        <div class="view-tab">AI Röntgeni</div>
        <div class="view-tab">Kaynak Kod</div>
      </div>
      <div class="device-pills">
        <div class="dev-pill active">Masaüstü (100%)</div>
        <div class="dev-pill">Tablet (768px)</div>
        <div class="dev-pill">Mobil (390px)</div>
      </div>
    </div>

    <div class="tool-right">
      <div class="btn-purple">⚡ AI İçin Kopyala</div>
      <div style="background:#0284c7; padding:8px 16px; border-radius:8px; font-size:13px; font-weight:700;">HTML İndir</div>
    </div>
  </div>

  <div class="preview-area">
    <div class="mock-iframe-frame">
      <div class="hero-box">
        <div style="font-size: 18px; font-weight: 800; color: #fff;">Analytics AI Projesi Önizlemesi</div>
        <div style="font-size: 13px; color: #94a3b8; margin-top: 4px;">Orijinal siteden bağımsız olarak mühürlenmiş canlı iframe görünümü</div>
      </div>
      <div class="grid-3">
        <div class="g-card">
          <div style="font-size: 12px; color: #38bdf8; font-weight: 700;">Aktif Kullanıcılar</div>
          <div style="font-size: 26px; font-weight: 800; margin-top: 6px;">24,850</div>
        </div>
        <div class="g-card">
          <div style="font-size: 12px; color: #34d399; font-weight: 700;">Dönüşüm Oranı</div>
          <div style="font-size: 26px; font-weight: 800; margin-top: 6px;">4.82%</div>
        </div>
        <div class="g-card">
          <div style="font-size: 12px; color: #a78bfa; font-weight: 700;">AI Doğruluk Skoru</div>
          <div style="font-size: 26px; font-weight: 800; margin-top: 6px;">99.4%</div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
captureHtml(screenshot3Html, 1280, 800, path.join(STORE_ASSETS_DIR, 'screenshot-3-responsive-preview.png'));

// 7. SCREENSHOT 4: AI Mirror & Claude / Cursor Ready (1280 x 800)
const screenshot4Html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 1280px;
    height: 800px;
    background: #090d16;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #fff;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .banner-header {
    background: linear-gradient(90deg, #d97706 0%, #f59e0b 50%, #e11d48 100%);
    padding: 16px 40px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .banner-title { font-size: 20px; font-weight: 800; }
  .banner-sub { font-size: 14px; font-weight: 500; opacity: 0.95; }
  .split-container {
    flex: 1;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
    padding: 24px 40px;
  }
  .editor-card {
    background: #0f172a;
    border: 1px solid #1e293b;
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .card-top {
    background: #1e293b;
    padding: 12px 18px;
    font-size: 13px;
    font-weight: 700;
    color: #cbd5e1;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .markdown-body {
    padding: 20px;
    font-family: monospace;
    font-size: 12.5px;
    line-height: 1.6;
    color: #cbd5e1;
    overflow-y: auto;
  }
  .chat-body {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    font-size: 13px;
    line-height: 1.5;
  }
  .chat-msg {
    background: #1e293b;
    padding: 14px 18px;
    border-radius: 10px;
    border: 1px solid #334155;
  }
  .ai-msg {
    background: rgba(14, 165, 233, 0.1);
    border-color: rgba(14, 165, 233, 0.3);
  }
</style>
</head>
<body>
  <div class="banner-header">
    <div class="banner-title">🤖 AI Proje Röntgeni & LLM Entegrasyonu</div>
    <div class="banner-sub">Claude, Cursor, ChatGPT ve Antigravity İçin project_ai.md ve Semantik Mimari Raporu</div>
  </div>

  <div class="split-container">
    <div class="editor-card">
      <div class="card-top">
        <span>📄 project_ai.md (SnapHTML Tarafından Üretildi)</span>
        <span style="color: #f59e0b; font-size: 11px;">OTOMATİK OLUŞTURULDU</span>
      </div>
      <div class="markdown-body">
<strong style="color: #38bdf8;"># 🌐 SnapHTML — Proje Röntgeni (Project AI Mirror)</strong><br>
- <strong>Başlangıç URL:</strong> https://app.analytics-cloud.io<br>
- <strong>Taranan Sayfa:</strong> 5 adet (Seviye 1 Sekmeler)<br>
- <strong>Kütüphaneler:</strong> Tailwind CSS, React, Lucide Icons<br><br>

<strong style="color: #f59e0b;">## 🗺️ Sayfa Ağacı & DOM İstatistikleri:</strong><br>
| Sayfa | Dosya | DOM | Buton | Form |<br>
| :--- | :--- | :--- | :--- | :--- |<br>
| Genel Bakış | index.html | 1,420 | 18 | 2 |<br>
| Raporlar | reports.html | 890 | 12 | 1 |<br>
| Ayarlar | settings.html | 640 | 8 | 4 |<br><br>

<strong style="color: #34d399;">## 🎨 Renk Paleti:</strong><br>
- Arka Plan: #0b1120<br>
- Birincil Vurgu: #0284c7 (Cyan-Blue)
      </div>
    </div>

    <div class="editor-card">
      <div class="card-top">
        <span>💬 Cursor / Claude Projects Promptu</span>
        <span style="color: #38bdf8; font-size: 11px;">CANLI AI SOHBETİ</span>
      </div>
      <div class="chat-body">
        <div class="chat-msg">
          <div style="font-weight: 700; color: #94a3b8; font-size: 11px; margin-bottom: 4px;">KULLANICI PROMPTU:</div>
          "SnapHTML'in çıkardığı ZIP arşivini projeme ekledim. project_ai.md'yi oku ve bu sitenin sekmeler arasındaki menü yapısını birebir React + Tailwind bileşenine dönüştür."
        </div>

        <div class="chat-msg ai-msg">
          <div style="font-weight: 700; color: #38bdf8; font-size: 11px; margin-bottom: 4px;">CLAUDE / CURSOR AI:</div>
          "Harika! SnapHTML'in ürettiği <code>project_ai.md</code> dosyasını ve 5 sayfanın DOM hiyerarşisini inceledim.<br><br>
          ✓ Tüm 18 buton ve 7 form girdisinin etkileşim durumları korundu.<br>
          ✓ <code>#0b1120</code> ve <code>#0284c7</code> renk şeması Tailwind config'ine aktarıldı.<br>
          ✓ Şimdi bu sayfaları tek bir Next.js App Router projesine derliyorum..."
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
captureHtml(screenshot4Html, 1280, 800, path.join(STORE_ASSETS_DIR, 'screenshot-4-ai-mirror.png'));

console.log('--- ALL ASSETS GENERATION COMPLETED SUCCESSFULLY ---');
