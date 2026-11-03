/**
 * SnapHTML - Viewport & CDP Emulation Engine (Manifest V3)
 * Chrome DevTools Protocol (CDP) üzerinden gerçek donanım ve ekran emülasyonu uygular.
 * Masaüstü (1440x900), Mobil (390x844), Tablet (768x1024) ve Özel Viewport'ları destekler.
 * Capture sonrasında tüm emülasyon ayarlarını kesinlikle temizler.
 */

export const VIEWPORT_PRESETS = {
  desktop: {
    id: 'desktop',
    label: 'Masaüstü (1440×900)',
    width: 1440,
    height: 900,
    dpr: 1,
    mobile: false
  },
  mobile: {
    id: 'mobile',
    label: 'Mobil (390×844 iPhone)',
    width: 390,
    height: 844,
    dpr: 3,
    mobile: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'
  },
  tablet: {
    id: 'tablet',
    label: 'Tablet (768×1024 iPad)',
    width: 768,
    height: 1024,
    dpr: 2,
    mobile: true,
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'
  }
};

/**
 * Viewport parametrelerini normalize eder
 */
export function resolveViewport(vpInput) {
  if (typeof vpInput === 'string' && VIEWPORT_PRESETS[vpInput]) {
    return { ...VIEWPORT_PRESETS[vpInput] };
  }
  if (vpInput && typeof vpInput === 'object') {
    return {
      id: vpInput.id || (vpInput.mobile ? 'mobile' : 'desktop'),
      label: vpInput.label || `${vpInput.width || 1440}×${vpInput.height || 900}`,
      width: parseInt(vpInput.width, 10) || 1440,
      height: parseInt(vpInput.height, 10) || 900,
      dpr: parseFloat(vpInput.dpr) || (vpInput.mobile ? 3 : 1),
      mobile: Boolean(vpInput.mobile),
      userAgent: vpInput.userAgent || (vpInput.mobile ? VIEWPORT_PRESETS.mobile.userAgent : undefined)
    };
  }
  return { ...VIEWPORT_PRESETS.desktop };
}

/**
 * Base64 string'ini Uint8Array'e dönüştürür (ZIP ve dosya işlemleri için)
 */
export function base64ToUint8Array(base64) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Sekmeye CDP Debugger iliştirir
 */
async function attachDebuggerSafely(tabId) {
  return new Promise((resolve) => {
    chrome.debugger.attach({ tabId }, '1.3', () => {
      if (chrome.runtime.lastError) {
        // Eğer zaten iliştirilmişse hata verme
        const msg = chrome.runtime.lastError.message || '';
        if (msg.includes('already attached') || msg.includes('Another debugger')) {
          console.warn('[SnapHTML Viewport] Debugger zaten aktif:', msg);
          return resolve(true);
        }
        console.warn('[SnapHTML Viewport] Debugger iliştirilemedi:', msg);
        return resolve(false);
      }
      resolve(true);
    });
  });
}

/**
 * CDP komutunu Promise ile yürütür
 */
function sendCdpCommand(tabId, method, params = {}) {
  return new Promise((resolve, reject) => {
    chrome.debugger.sendCommand({ tabId }, method, params, (result) => {
      if (chrome.runtime.lastError) {
        return reject(new Error(chrome.runtime.lastError.message));
      }
      resolve(result || {});
    });
  });
}

/**
 * Sekmeye gerçek ekran metriklerini (Viewport) uygular
 */
export async function applyViewportEmulation(tabId, viewportConfig) {
  const vp = resolveViewport(viewportConfig);
  const attached = await attachDebuggerSafely(tabId);
  if (!attached) {
    console.warn('[SnapHTML Viewport] Debugger bağlanamadı, emülasyon sınırlı kalabilir.');
    return { success: false, viewport: vp };
  }

  try {
    await sendCdpCommand(tabId, 'Page.enable');

    // 1. Ekran boyutları ve DPR override
    await sendCdpCommand(tabId, 'Emulation.setDeviceMetricsOverride', {
      width: vp.width,
      height: vp.height,
      deviceScaleFactor: vp.dpr,
      mobile: vp.mobile,
      screenWidth: vp.width,
      screenHeight: vp.height,
      scale: 1,
      fitWindow: false
    });

    // 2. Mobil mod için User-Agent ve Dokunma (Touch) Emülasyonu
    if (vp.mobile) {
      if (vp.userAgent) {
        await sendCdpCommand(tabId, 'Emulation.setUserAgentOverride', {
          userAgent: vp.userAgent,
          acceptLanguage: 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
          platform: 'iPhone'
        });
      }
      try {
        await sendCdpCommand(tabId, 'Emulation.setTouchEmulationEnabled', {
          enabled: true,
          maxTouchPoints: 5
        });
      } catch {}
    } else {
      try {
        await sendCdpCommand(tabId, 'Emulation.setTouchEmulationEnabled', {
          enabled: false
        });
      } catch {}
    }

    // 3. Tarayıcı sayfasında yeniden boyutlandırma reflow'unu tetikle
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        func: (w, h) => {
          window.dispatchEvent(new Event('resize'));
          window.dispatchEvent(new Event('orientationchange'));
        },
        args: [vp.width, vp.height]
      });
    } catch {}

    // Sayfanın CSS media query'leri ve bileşen düzenini oturtması için bekleme
    await new Promise(r => setTimeout(r, 400));

    return { success: true, viewport: vp };
  } catch (err) {
    console.error('[SnapHTML Viewport] Emülasyon hatası:', err);
    return { success: false, error: err.message, viewport: vp };
  }
}

/**
 * Sekmenin o anki tam ekran görüntüsünü (Screenshot PNG) çeker
 */
export async function captureTabScreenshot(tabId) {
  try {
    const result = await sendCdpCommand(tabId, 'Page.captureScreenshot', {
      format: 'png',
      fromSurface: true,
      captureBeyondViewport: false
    });

    if (result && result.data) {
      const bytes = base64ToUint8Array(result.data);
      return {
        success: true,
        bytes,
        base64: result.data,
        dataUrl: `data:image/png;base64,${result.data}`
      };
    }
  } catch (err) {
    console.warn('[SnapHTML Viewport] CDP Screenshot alınamadı, captureVisibleTab deneniyor:', err.message);
  }

  // Yedek mekanizma: chrome.tabs.captureVisibleTab
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
    const bytes = base64ToUint8Array(base64);
    return {
      success: true,
      bytes,
      base64,
      dataUrl
    };
  } catch (err2) {
    console.error('[SnapHTML Viewport] Yedek screenshot da başarısız:', err2.message);
    return { success: false, error: err2.message };
  }
}

/**
 * Sekmedeki tüm emülasyon ve debugger durumunu kesinlikle temizler
 */
export async function clearViewportEmulation(tabId) {
  if (!tabId) return;

  try {
    await sendCdpCommand(tabId, 'Emulation.clearDeviceMetricsOverride');
  } catch {}

  try {
    await sendCdpCommand(tabId, 'Emulation.setUserAgentOverride', { userAgent: '' });
  } catch {}

  try {
    await sendCdpCommand(tabId, 'Emulation.setTouchEmulationEnabled', { enabled: false });
  } catch {}

  // Sekmeyi normal masaüstü boyutunda resize event ile uyandır
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        window.dispatchEvent(new Event('resize'));
      }
    });
  } catch {}

  // Debugger bağlantısını sonlandır
  return new Promise((resolve) => {
    chrome.debugger.detach({ tabId }, () => {
      // Hata olsa bile yut ve temiz bitir
      resolve();
    });
  });
}
