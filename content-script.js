/**
 * SnapHTML - Content Script (DOM & Asset Cloner Engine V2)
 * Web sayfalarını CSS, fontlar, görseller, anlık form/DOM durumu ve
 * AI metadata'sı ile eksiksiz, tek parça bağımsız HTML olarak klonlar.
 * Gerçek Mobil/Masaüstü Viewport desteği, Akıllı SPA State Keşif Motoru (React, Vue, Angular)
 * ve Güvenli Navigasyon (Safe Crawling) yetenekleri içerir.
 */

(() => {
  if (window.__snaphtml_engine_ready) return;
  window.__snaphtml_engine_ready = true;

  // Dialogları baskıla (tarayıcının donmasını veya alert/confirm ile takılmasını engeller)
  let crawlModeActive = false;
  const originalConfirm = window.confirm;
  const originalAlert = window.alert;
  const originalPrompt = window.prompt;

  function enableCrawlSafetyOverrides() {
    crawlModeActive = true;
    window.confirm = () => false; // Yıkıcı aksiyon onaylarını her zaman iptal et
    window.alert = () => {};
    window.prompt = () => null;
  }

  function disableCrawlSafetyOverrides() {
    crawlModeActive = false;
    window.confirm = originalConfirm;
    window.alert = originalAlert;
    window.prompt = originalPrompt;
  }

  /**
   * Bağıl (relative) URL'leri mutlak (absolute) URL'ye çevirir
   */
  function toAbsoluteUrl(url, base) {
    if (!url) return '';
    try {
      return new URL(url, base || document.baseURI).href;
    } catch {
      return url;
    }
  }

  /**
   * CSS içindeki url(...) yollarını mutlak URL'ye çevirir
   */
  function rewriteCssUrls(cssText, baseUrl) {
    if (!cssText) return '';
    return cssText.replace(/url\((['"]?)(?!data:)(.*?)\1\)/gi, (match, quote, rawUrl) => {
      const trimmed = rawUrl.trim();
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('data:')) {
        return match;
      }
      const absUrl = toAbsoluteUrl(trimmed, baseUrl);
      return `url("${absUrl}")`;
    });
  }

  /**
   * Form elemanlarının o anki değerlerini DOM attribute'larına mühürler
   */
  function sealInteractiveStates(root) {
    // 1. Input elemanları
    root.querySelectorAll('input').forEach(input => {
      const type = (input.getAttribute('type') || 'text').toLowerCase();
      if (type === 'checkbox' || type === 'radio') {
        if (input.checked) {
          input.setAttribute('checked', 'checked');
        } else {
          input.removeAttribute('checked');
        }
      } else if (type !== 'file') {
        input.setAttribute('value', input.value || '');
      }
    });

    // 2. Textarea elemanları
    root.querySelectorAll('textarea').forEach(textarea => {
      textarea.textContent = textarea.value || '';
      textarea.setAttribute('value', textarea.value || '');
    });

    // 3. Select / Dropdown
    root.querySelectorAll('select').forEach(select => {
      Array.from(select.options).forEach(opt => {
        if (opt.selected) {
          opt.setAttribute('selected', 'selected');
        } else {
          opt.removeAttribute('selected');
        }
      });
    });

    // 4. Details / Accordion
    root.querySelectorAll('details').forEach(details => {
      if (details.open) {
        details.setAttribute('open', '');
      } else {
        details.removeAttribute('open');
      }
    });
  }

  /**
   * Sayfadaki Canvas elemanlarını yüksek çözünürlüklü IMG etiketine dönüştürür (Grafikler için)
   */
  function convertCanvasesToImages(originalRoot, cloneRoot) {
    const origCanvases = originalRoot.querySelectorAll('canvas');
    const cloneCanvases = cloneRoot.querySelectorAll('canvas');

    for (let i = 0; i < origCanvases.length; i++) {
      const orig = origCanvases[i];
      const clone = cloneCanvases[i];
      if (!clone) continue;

      try {
        const dataUrl = orig.toDataURL('image/png');
        const img = document.createElement('img');
        img.className = orig.className;
        img.id = orig.id ? orig.id + '__canvas_img' : '';
        img.setAttribute('style', orig.getAttribute('style') || '');
        img.style.maxWidth = '100%';
        img.src = dataUrl;
        img.alt = 'Rendered Canvas Graphic';
        img.setAttribute('data-snaphtml-canvas', 'true');

        clone.parentNode?.replaceChild(img, clone);
      } catch (err) {
        console.warn('[SnapHTML] Canvas dönüştürme atlandı:', err);
      }
    }
  }

  /**
   * Open Shadow DOM içeren elemanları Declarative Shadow DOM (<template shadowrootmode="open">) ile klonlar
   */
  function serializeShadowRoots(originalRoot, cloneRoot) {
    const origElements = originalRoot.querySelectorAll('*');
    const cloneElements = cloneRoot.querySelectorAll('*');

    for (let i = 0; i < origElements.length; i++) {
      const orig = origElements[i];
      const clone = cloneElements[i];
      if (!clone || !orig.shadowRoot) continue;

      try {
        const template = document.createElement('template');
        template.setAttribute('shadowrootmode', 'open');
        template.innerHTML = orig.shadowRoot.innerHTML;
        clone.insertBefore(template, clone.firstChild);
      } catch (e) {
        console.warn('[SnapHTML] Shadow DOM serialization atlandı:', e);
      }
    }
  }

  /**
   * Tüm CSS kurallarını derinlemesine toplar (Same-origin + Cross-origin CORS bypass)
   */
  async function harvestAllCss(onProgress) {
    const collectedCss = [];
    const styleSheets = Array.from(document.styleSheets);
    const total = styleSheets.length;

    for (let i = 0; i < total; i++) {
      const sheet = styleSheets[i];
      const href = sheet.href;

      if (onProgress) {
        onProgress(`Stiller toplanıyor (${i + 1}/${total})...`);
      }

      try {
        if (sheet.cssRules && sheet.cssRules.length > 0) {
          const rulesText = Array.from(sheet.cssRules).map(r => r.cssText).join('\n');
          collectedCss.push(`/* Stylesheet: ${href || 'inline'} */\n` + rewriteCssUrls(rulesText, href || document.baseURI));
          continue;
        }
      } catch {}

      if (href) {
        try {
          const res = await chrome.runtime.sendMessage({
            action: 'fetchStylesheet',
            url: href
          });

          if (res && res.success && res.cssText) {
            collectedCss.push(`/* Remote Stylesheet: ${href} */\n` + rewriteCssUrls(res.cssText, href));
          }
        } catch (fetchErr) {
          console.warn('[SnapHTML] Harici stil yüklenemedi:', href, fetchErr);
        }
      }
    }

    document.querySelectorAll('style:not([id^="__snap"])').forEach(st => {
      collectedCss.push(`/* Inline Style */\n` + rewriteCssUrls(st.textContent || '', document.baseURI));
    });

    return collectedCss.join('\n\n');
  }

  /**
   * CSS içindeki @font-face font dosyalarını (woff2/woff) Base64'e dönüştürür
   */
  async function inlineWebFonts(cssText, onProgress) {
    if (!cssText) return cssText;

    const fontUrlRegex = /@font-face\s*{[^}]*?src:[^}]*?url\((['"]?)(https?:\/\/[^)'"]+\.(?:woff2|woff|ttf|otf))\1\)/gi;
    const matches = Array.from(cssText.matchAll(fontUrlRegex));
    const uniqueFontUrls = [...new Set(matches.map(m => m[2]))];

    if (uniqueFontUrls.length > 0 && onProgress) {
      onProgress(`Yazı tipleri gömülüyor (0/${uniqueFontUrls.length})...`);
    }

    let modifiedCss = cssText;
    for (let i = 0; i < uniqueFontUrls.length; i++) {
      const fontUrl = uniqueFontUrls[i];
      if (onProgress) {
        onProgress(`Yazı tipleri gömülüyor (${i + 1}/${uniqueFontUrls.length})...`);
      }

      try {
        const res = await chrome.runtime.sendMessage({
          action: 'fetchAssetAsBase64',
          url: fontUrl
        });

        if (res && res.success && res.dataUrl) {
          modifiedCss = modifiedCss.split(fontUrl).join(res.dataUrl);
        }
      } catch (fontErr) {
        console.warn('[SnapHTML] Font indirilemedi:', fontUrl, fontErr);
      }
    }

    return modifiedCss;
  }

  /**
   * Görselleri (img, background-image) Base64 Data URL'e dönüştürür
   */
  async function inlineAllImages(cloneRoot, onProgress) {
    const images = Array.from(cloneRoot.querySelectorAll('img'));
    const totalImg = images.length;

    for (let i = 0; i < totalImg; i++) {
      const img = images[i];
      const src = img.currentSrc || img.getAttribute('src') || img.getAttribute('data-src');

      if (!src || src.startsWith('data:')) continue;

      if (onProgress && totalImg > 4 && i % 3 === 0) {
        onProgress(`Görseller gömülüyor (${i + 1}/${totalImg})...`);
      }

      const absoluteSrc = toAbsoluteUrl(src, document.baseURI);

      let converted = false;
      const origImg = document.querySelector(`img[src="${CSS.escape(src)}"]`);
      if (origImg && origImg.naturalWidth > 0 && origImg.naturalHeight > 0) {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = origImg.naturalWidth;
          canvas.height = origImg.naturalHeight;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(origImg, 0, 0);
          const dataUrl = canvas.toDataURL('image/png');
          img.setAttribute('src', dataUrl);
          converted = true;
        } catch {}
      }

      if (!converted) {
        try {
          const res = await chrome.runtime.sendMessage({
            action: 'fetchAssetAsBase64',
            url: absoluteSrc
          });
          if (res && res.success && res.dataUrl) {
            img.setAttribute('src', res.dataUrl);
          } else {
            img.setAttribute('src', absoluteSrc);
          }
        } catch {
          img.setAttribute('src', absoluteSrc);
        }
      }

      img.removeAttribute('srcset');
      img.removeAttribute('loading');
    }

    const bgElements = cloneRoot.querySelectorAll('[style*="background"]');
    for (const el of bgElements) {
      const styleAttr = el.getAttribute('style') || '';
      const bgMatch = styleAttr.match(/url\((['"]?)(https?:\/\/[^)'"]+)\1\)/i);
      if (bgMatch && !bgMatch[2].startsWith('data:')) {
        const bgUrl = bgMatch[2];
        try {
          const res = await chrome.runtime.sendMessage({
            action: 'fetchAssetAsBase64',
            url: bgUrl
          });
          if (res && res.success && res.dataUrl) {
            el.setAttribute('style', styleAttr.replace(bgUrl, res.dataUrl));
          }
        } catch {}
      }
    }
  }

  /**
   * JavaScript betiklerini dondurur
   */
  function freezeScripts(cloneRoot) {
    const scripts = cloneRoot.querySelectorAll('script');
    scripts.forEach(script => {
      const type = script.getAttribute('type') || '';
      if (type.includes('json') || script.id === 'snaphtml-ai-context' || script.id === 'snaphtml-mobile-containment') {
        return;
      }
      script.setAttribute('type', 'text/plain');
      script.setAttribute('data-snaphtml-neutralized', 'true');
      script.textContent = '/* SnapHTML: Script neutralized to maintain frozen layout */';
      script.removeAttribute('src');
    });

    const all = cloneRoot.querySelectorAll('*');
    all.forEach(el => {
      Array.from(el.attributes).forEach(attr => {
        if (attr.name.toLowerCase().startsWith('on')) {
          el.removeAttribute(attr.name);
        }
      });
    });
  }

  /**
   * AI Asistanları için semantik özet üretir
   */
  function generateAiContext(cloneDoc, customViewport = null) {
    const title = document.title || 'Başlıksız Web Sayfası';
    const url = window.location.href;
    const vpWidth = customViewport?.width || window.innerWidth;
    const vpHeight = customViewport?.height || window.innerHeight;
    const vpDpr = customViewport?.dpr || window.devicePixelRatio || 1;
    const vpMode = customViewport?.mode || (vpWidth <= 600 ? 'mobile' : 'desktop');
    const viewport = `${vpWidth}×${vpHeight} (DPR: ${vpDpr}, Mod: ${vpMode})`;
    const timestamp = new Date().toISOString();

    const navCount = cloneDoc.querySelectorAll('nav, [role="navigation"]').length;
    const mainCount = cloneDoc.querySelectorAll('main, [role="main"]').length;
    const asideCount = cloneDoc.querySelectorAll('aside, [role="complementary"]').length;
    const footerCount = cloneDoc.querySelectorAll('footer, [role="contentinfo"]').length;
    const formCount = cloneDoc.querySelectorAll('form').length;
    const buttonCount = cloneDoc.querySelectorAll('button, input[type="button"], input[type="submit"], [role="button"]').length;
    const inputCount = cloneDoc.querySelectorAll('input:not([type="hidden"]), textarea, select').length;
    const tableCount = cloneDoc.querySelectorAll('table').length;
    
    const headings = {
      h1: cloneDoc.querySelectorAll('h1').length,
      h2: cloneDoc.querySelectorAll('h2').length,
      h3: cloneDoc.querySelectorAll('h3').length
    };

    const detected = [];
    if (document.querySelector('[class*="tw-"], [class*="flex"], [class*="grid"], [class*="bg-"], [class*="text-"]')) {
      detected.push('Tailwind CSS');
    }
    if (document.getElementById('root') || document.querySelector('[data-reactroot]')) {
      detected.push('React');
    }
    if (document.getElementById('__next')) {
      detected.push('Next.js');
    }
    if (document.querySelector('[data-v-]')) {
      detected.push('Vue');
    }
    if (document.querySelector('.container, .row, .col')) {
      detected.push('Bootstrap');
    }

    let bodyBg = '#ffffff';
    let bodyColor = '#000000';
    try {
      const comp = window.getComputedStyle(document.body);
      bodyBg = comp.backgroundColor || '#ffffff';
      bodyColor = comp.color || '#000000';
    } catch {}

    const aiData = {
      url,
      title,
      timestamp,
      viewport,
      viewportDetails: {
        width: vpWidth,
        height: vpHeight,
        dpr: vpDpr,
        mode: vpMode
      },
      frameworks: detected,
      domStats: {
        totalNodes: cloneDoc.querySelectorAll('*').length,
        navbars: navCount,
        mainContainers: mainCount,
        sidebars: asideCount,
        footers: footerCount,
        forms: formCount,
        inputs: inputCount,
        buttons: buttonCount,
        tables: tableCount,
        headings
      },
      computedPalette: {
        bodyBackground: bodyBg,
        bodyText: bodyColor
      }
    };

    const headerComment = `<!--
================================================================================
🤖 SNAPHTML — STANDALONE WEB SNAPSHOT & AI MIRROR
================================================================================
KAYNAK URL  : ${url}
SAYFA BAŞLIĞI: ${title}
YAKALANMA   : ${timestamp}
VIEWPORT    : ${viewport}

[YAPISAL ÖZET (SEMANTIC STRUCTURE)]:
- Navigasyon Menüleri : ${navCount} adet
- Ana Alan (Main)     : ${mainCount} adet
- Yan Menü (Sidebar)  : ${asideCount} adet
- Alt Bilgi (Footer)  : ${footerCount} adet
- Formlar             : ${formCount} adet (${inputCount} girdi alanı)
- Butonlar            : ${buttonCount} adet
- Tablolar            : ${tableCount} adet
- Başlıklar (H1-H3)   : H1: ${headings.h1} | H2: ${headings.h2} | H3: ${headings.h3}
- Tespit Edilen UI    : ${detected.join(', ') || 'Standart Web'}

[RENK PALETİ]:
- Arka Plan: ${bodyBg}
- Yazı Rengi: ${bodyColor}
================================================================================
-->`;

    return {
      comment: headerComment,
      json: JSON.stringify(aiData, null, 2),
      data: aiData
    };
  }

  // ============================================================================
  // SPA STATE DISCOVERY & SAFE CRAWLING ENGINE
  // ============================================================================

  // Yıkıcı / Tehlikeli Eylemler (Kesinlikle Tıklanmayacak İşlemler)
  const DESTRUCTIVE_KEYWORDS_REGEX = /\b(delete|remove|sil|kaldır|drop|destroy|clear|purge|çıkış|logout|signout|sign-out|log-out|disconnect|save|kaydet|submit|gönder|deploy|yayınla|dağıt|push|commit|migrate|migration|öde|pay|checkout|buy|satın|iptal|cancel|onayla|confirm|reset|format|upload|yükle|kill|terminate|stop|trash|unsubscribe)\b/i;

  // Güvenli Navigasyon / Sekme Anahtar Kelimeleri
  const SAFE_NAV_KEYWORDS = /\b(sohbet|chat|kod|code|editör|editor|git|ajan|agent|ajanlar|agents|veritabanı|database|db|dağıtımlar|deployments|dağıtım listesi|ayarlar|settings|ayar|setting|genel|general|panel|dashboard|proje|projeler|project|projects|profil|profile|log|logs|metrik|metrics|doküman|docs|hakkında|about|yardım|help|keşfet|explore|sekme|tab|overview|genel bakış|ana sayfa|home|activity|aktivite)\b/i;

  const DANGEROUS_LINK_PATTERNS = [
    /\/logout/i, /\/log-out/i, /\/cikis/i, /\/signout/i, /\/sign-out/i,
    /\/auth\/logout/i, /\/delete/i, /\/sil/i, /\/disconnect/i, /\/unsubscribe/i,
    /\/account\/delete/i, /\/session\/destroy/i
  ];

  /**
   * Mantıksal Ekran ID'si üretir (Örn: screen_chat, screen_editor, screen_git...)
   */
  function generateLogicalScreenId(rawTitle, fallbackIndex = 0) {
    const text = (rawTitle || '').toLowerCase().trim();
    if (/sohbet|chat/.test(text)) return 'screen_chat';
    if (/kod|code|editör|editor/.test(text)) return 'screen_editor';
    if (/\bgit\b/.test(text)) return 'screen_git';
    if (/ajan|agent/.test(text)) return 'screen_agents';
    if (/veritaban|database|\bdb\b/.test(text)) return 'screen_database';
    if (/dağıtım|deploy/.test(text)) return 'screen_deployments';
    if (/ayar|setting/.test(text)) return 'screen_settings';
    if (/dashboard|panel|genel bakış|overview/.test(text)) return 'screen_dashboard';
    if (/proje|project/.test(text)) return 'screen_projects';
    if (/profil|profile/.test(text)) return 'screen_profile';
    if (/log/.test(text)) return 'screen_logs';
    if (/metrik|metric/.test(text)) return 'screen_metrics';

    // Genel slug üretici
    let slug = text.replace(/[^a-z0-9_-]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
    if (!slug) slug = `screen_${fallbackIndex}`;
    return `screen_${slug.slice(0, 24)}`;
  }

  /**
   * DOM Stabilizasyonunu Bekler (MutationObserver + Debounce)
   */
  function waitForDomStabilization(timeout = 3000, debounceTime = 300) {
    return new Promise((resolve) => {
      let timer = null;
      let maxTimer = null;
      let observer = null;

      const cleanup = () => {
        if (timer) clearTimeout(timer);
        if (maxTimer) clearTimeout(maxTimer);
        if (observer) observer.disconnect();
      };

      const finish = () => {
        cleanup();
        resolve();
      };

      maxTimer = setTimeout(finish, timeout);

      try {
        observer = new MutationObserver(() => {
          if (timer) clearTimeout(timer);
          timer = setTimeout(finish, debounceTime);
        });

        observer.observe(document.body || document.documentElement, {
          childList: true,
          subtree: true,
          attributes: true,
          characterData: true
        });

        timer = setTimeout(finish, debounceTime);
      } catch {
        setTimeout(finish, 800);
      }
    });
  }

  /**
   * O anki ekranın semantik içerik ve yapı parmak izini (Fingerprint) hesaplar
   */
  function computeDomFingerprint() {
    const mainEl = document.querySelector('main, [role="main"]') || document.body;
    
    // 1. Başlıklar
    const headings = Array.from(mainEl.querySelectorAll('h1, h2, h3'))
      .map(h => (h.innerText || '').trim())
      .filter(Boolean)
      .join(' | ');

    // 2. Aktif Navigasyon Durumu
    const activeNav = Array.from(document.querySelectorAll('[role="tab"][aria-selected="true"], [data-state="active"], [aria-current="page"], .active'))
      .map(el => (el.innerText || el.getAttribute('aria-label') || '').trim())
      .filter(Boolean)
      .join(' > ');

    // 3. İçerik Örneği (ilk 400 karakter)
    const textSample = (mainEl.innerText || '')
      .slice(0, 400)
      .replace(/\s+/g, ' ')
      .trim();

    // 4. Yapısal İstatistikler
    const nodeCount = mainEl.querySelectorAll('*').length;
    const buttonCount = mainEl.querySelectorAll('button').length;
    const inputCount = mainEl.querySelectorAll('input, select, textarea').length;

    // 5. 32-bit FNV-1a Hash
    const rawFingerprint = `${headings}:::${activeNav}:::${textSample.slice(0, 180)}:::${nodeCount}:${buttonCount}:${inputCount}`;
    let hash = 0x811c9dc5;
    for (let i = 0; i < rawFingerprint.length; i++) {
      hash ^= rawFingerprint.charCodeAt(i);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    const hexHash = ('00000000' + (hash >>> 0).toString(16)).slice(-8);

    return {
      hash: hexHash,
      headings: headings || document.title || 'Ekran',
      activeNav: activeNav || 'Genel',
      textSample: textSample.slice(0, 80),
      stats: { nodeCount, buttonCount, inputCount }
    };
  }

  /**
   * Bir öğenin güvenli navigasyon olup olmadığını ve yıkıcı olmadığını doğrular
   */
  function evaluateNavigationElementSafety(el) {
    const tag = el.tagName.toLowerCase();
    const type = (el.getAttribute('type') || '').toLowerCase();
    const text = (el.innerText || el.textContent || '').trim();
    const ariaLabel = el.getAttribute('aria-label') || '';
    const titleAttr = el.getAttribute('title') || '';
    const actionAttr = el.getAttribute('data-action') || '';
    const testId = el.getAttribute('data-testid') || '';
    const role = el.getAttribute('role') || '';

    const combinedMeta = `${text} ${ariaLabel} ${titleAttr} ${actionAttr} ${testId}`.trim();

    // 1. Yıkıcı Anahtar Kelime Kontrolü (Kesin Reddet)
    if (DESTRUCTIVE_KEYWORDS_REGEX.test(combinedMeta)) {
      return {
        isSafe: false,
        reason: `Yıkıcı kelime eşleşmesi: "${combinedMeta.slice(0, 30)}"`
      };
    }

    // 2. Form Gönderim Butonları
    if (type === 'submit') {
      return {
        isSafe: false,
        reason: 'Form gönderme butonu (type="submit")'
      };
    }

    // 3. Dosya Girişi
    if (type === 'file') {
      return {
        isSafe: false,
        reason: 'Dosya yükleme kontrolü'
      };
    }

    // 4. Tehlikeli Link Kontrolü
    const href = el.getAttribute('href');
    if (href) {
      if (href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) {
        return { isSafe: false, reason: 'Protokol linki' };
      }
      if (DANGEROUS_LINK_PATTERNS.some(re => re.test(href))) {
        return { isSafe: false, reason: 'Tehlikeli rota linki' };
      }
    }

    // 5. Pozitif Navigasyon Doğrulaması
    const isTab = role === 'tab' || el.hasAttribute('data-tab') || el.hasAttribute('aria-controls') || el.hasAttribute('data-state');
    const isMenuItem = role === 'menuitem' || role === 'button';
    const isInsideNav = Boolean(el.closest('nav, aside, header, [role="navigation"], [role="tablist"], [class*="sidebar" i], [class*="bottom-nav" i], [class*="tabbar" i]'));
    const matchesKeyword = SAFE_NAV_KEYWORDS.test(combinedMeta);

    if (isTab || matchesKeyword || (isInsideNav && (tag === 'a' || tag === 'button' || isMenuItem))) {
      return {
        isSafe: true,
        label: text || ariaLabel || titleAttr || 'Görünüm'
      };
    }

    return {
      isSafe: false,
      reason: 'Belirgin bir navigasyon veya sekme yapısına ait değil'
    };
  }

  /**
   * Sayfadaki tüm güvenli SPA Menü & Sekme Öğelerini Keşfeder
   */
  function discoverSpaNavigationElements() {
    const candidates = [];
    const skippedElements = [];
    const seenLabels = new Set();

    // Mobil modda kapalı hamburger menüsü varsa tespit et
    const mobileHamburger = document.querySelector('button[aria-label*="menu" i], button[aria-label*="menü" i], [class*="hamburger" i], [class*="nav-toggle" i]');

    // Aday seçiciler
    const selectorQueries = [
      'nav a', 'nav button', 'nav [role="tab"]', 'nav [role="menuitem"]',
      'aside a', 'aside button', 'aside [role="tab"]',
      'header a', 'header button',
      '[role="navigation"] a', '[role="navigation"] button',
      '[role="tablist"] [role="tab"]', '[role="tab"]',
      '[data-route]', '[data-href]', '[data-tab]',
      '[class*="sidebar" i] a', '[class*="sidebar" i] button',
      '[class*="bottom-nav" i] a', '[class*="bottom-nav" i] button',
      '[class*="tabbar" i] a', '[class*="tabbar" i] button'
    ];

    const elementSet = new Set();
    selectorQueries.forEach(query => {
      document.querySelectorAll(query).forEach(el => elementSet.add(el));
    });

    let index = 0;
    for (const el of elementSet) {
      // Görünürlük kontrolü
      const rect = el.getBoundingClientRect();
      const isVisible = rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).display !== 'none';
      if (!isVisible && !el.closest('[class*="mobile-menu" i]')) continue;

      const evalResult = evaluateNavigationElementSafety(el);
      const rawText = (el.innerText || el.getAttribute('aria-label') || el.getAttribute('title') || '').trim();

      if (!evalResult.isSafe) {
        if (rawText && rawText.length < 40) {
          skippedElements.push({ text: rawText, reason: evalResult.reason });
        }
        continue;
      }

      const cleanLabel = evalResult.label.replace(/\s+/g, ' ').trim();
      const normKey = cleanLabel.toLowerCase();

      // Duplicate kontrolü
      if (!cleanLabel || cleanLabel.length < 2 || cleanLabel.length > 50) continue;
      if (seenLabels.has(normKey)) continue;
      seenLabels.add(normKey);

      index++;
      const navId = `snap_nav_${index}`;
      el.setAttribute('data-snaphtml-nav-id', navId);

      const logicalId = generateLogicalScreenId(cleanLabel, index);

      candidates.push({
        navId,
        label: cleanLabel,
        logicalId,
        tagName: el.tagName.toLowerCase(),
        role: el.getAttribute('role') || '',
        href: el.getAttribute('href') || '',
        active: el.getAttribute('aria-selected') === 'true' || el.getAttribute('data-state') === 'active' || el.classList.contains('active')
      });
    }

    return {
      candidates,
      skippedElements,
      hasMobileHamburger: Boolean(mobileHamburger),
      currentFingerprint: computeDomFingerprint()
    };
  }

  /**
   * Güvenli bir SPA Navigasyon Öğesine Tıklar ve Ekran Değişimini Bekler
   */
  async function performSafeNavigationClick(navId) {
    enableCrawlSafetyOverrides();

    const el = document.querySelector(`[data-snaphtml-nav-id="${navId}"]`);
    if (!el) {
      return { success: false, error: `Navigasyon öğesi bulunamadı: ${navId}` };
    }

    const beforeFingerprint = computeDomFingerprint();
    const beforeUrl = window.location.href;

    try {
      // Görünür alana getir
      try {
        el.scrollIntoView({ behavior: 'instant', block: 'center' });
      } catch {}

      // Fare ve işaretçi olaylarını sırayla ateşle (React/Vue onClick uyumluluğu)
      const events = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'];
      for (const evName of events) {
        el.dispatchEvent(new MouseEvent(evName, {
          bubbles: true,
          cancelable: true,
          view: window
        }));
      }

      // Doğrudan .click() tetikle
      try {
        el.click();
      } catch {}

      // DOM ve veri yükleme stabilizasyonunu bekle
      await waitForDomStabilization(3000, 350);

      // Async loading / spinner varsa ek tolerans
      const spinner = document.querySelector('.spinner, .loading, [aria-busy="true"], [data-loading="true"]');
      if (spinner) {
        await new Promise(r => setTimeout(r, 600));
      }

      const afterFingerprint = computeDomFingerprint();
      const afterUrl = window.location.href;

      const changed = beforeFingerprint.hash !== afterFingerprint.hash || beforeUrl !== afterUrl;

      return {
        success: true,
        changed,
        fingerprint: afterFingerprint,
        url: afterUrl,
        title: document.title || 'Başlıksız Ekran'
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Mobil HTML'in masaüstünde doğrudan açıldığında 390px mobil çerçeveyle render edilmesini sağlayan
   * bağımsız ve sıfır bağımlılıklı Responsive Containment betiği üretir.
   */
  function generateMobileContainmentScript(viewport) {
    const w = viewport?.width || 390;
    const h = viewport?.height || 844;
    const dpr = viewport?.dpr || 3;

    return `
<script id="snaphtml-mobile-containment">
(function() {
  if (window.self !== window.top) return;
  if (window.innerWidth <= 520) return;

  window.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('snaphtml-standalone-mobile-root')) return;

    var origHtml = '<!DOCTYPE html>\\n' + document.documentElement.outerHTML.replace('id="snaphtml-mobile-containment"', 'id="snaphtml-mobile-containment-inert"');

    document.documentElement.innerHTML = [
      '<head>',
      '<meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
      '<title>' + (document.title || 'Mobil Snapshot') + ' [SnapHTML Mobil Görünüm]</title>',
      '<style>',
      '* { box-sizing: border-box; margin: 0; padding: 0; }',
      'body { background: #090d16; color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; min-height: 100vh; display: flex; flex-direction: column; align-items: center; }',
      '.sh-bar { width: 100%; background: #131c2e; border-bottom: 1px solid #1e293b; padding: 12px 24px; display: flex; align-items: center; justify-content: space-between; font-size: 13px; z-index: 100; box-shadow: 0 4px 12px rgba(0,0,0,0.4); }',
      '.sh-brand { display: flex; align-items: center; gap: 10px; font-weight: 600; color: #38bdf8; font-size: 14px; }',
      '.sh-meta { color: #94a3b8; font-size: 12px; margin-left: 8px; font-weight: normal; }',
      '.sh-actions { display: flex; gap: 8px; }',
      '.sh-btn { background: #1e293b; color: #f8fafc; border: 1px solid #334155; padding: 7px 14px; border-radius: 8px; cursor: pointer; font-size: 12px; font-weight: 500; transition: all 0.2s; }',
      '.sh-btn:hover { background: #334155; }',
      '.sh-btn.active { background: #0284c7; border-color: #38bdf8; color: #fff; box-shadow: 0 0 12px rgba(56, 189, 248, 0.35); }',
      '.sh-container { flex: 1; display: flex; justify-content: center; align-items: flex-start; padding: 36px 16px; width: 100%; }',
      '.sh-phone-frame { width: ${w}px; height: ${h}px; border-radius: 46px; border: 12px solid #1e293b; box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.8), 0 0 0 1px #334155; background: #000; overflow: hidden; position: relative; transition: all 0.3s ease; }',
      '.sh-phone-notch { position: absolute; top: 0; left: 50%; transform: translateX(-50%); width: 120px; height: 26px; background: #1e293b; border-bottom-left-radius: 16px; border-bottom-right-radius: 16px; z-index: 20; pointer-events: none; }',
      '.sh-phone-frame iframe { width: 100%; height: 100%; border: none; background: #fff; }',
      '.sh-full-view .sh-phone-frame { width: 100%; height: calc(100vh - 65px); border-radius: 0; border: none; box-shadow: none; }',
      '.sh-full-view .sh-phone-notch { display: none; }',
      '</style>',
      '</head>',
      '<body id="snaphtml-standalone-mobile-root">',
      '<header class="sh-bar">',
      '  <div class="sh-brand">',
      '    <span>📱 SnapHTML Mobil Snapshot</span>',
      '    <span class="sh-meta">Viewport: ${w}×${h} (DPR: ${dpr})</span>',
      '  </div>',
      '  <div class="sh-actions">',
      '    <button class="sh-btn active" id="shBtnFrame">📱 ${w}px Mobil Çerçeve</button>',
      '    <button class="sh-btn" id="shBtnFull">🖥️ Masaüstü Tam Genişlik</button>',
      '  </div>',
      '</header>',
      '<main class="sh-container" id="shContainer">',
      '  <div class="sh-phone-frame">',
      '    <div class="sh-phone-notch"></div>',
      '    <iframe id="shFrame" sandbox="allow-same-origin allow-scripts allow-popups" srcdoc=""></iframe>',
      '  </div>',
      '</main>',
      '</body>'
    ].join('\\n');

    var frame = document.getElementById('shFrame');
    if (frame) frame.srcdoc = origHtml;

    document.getElementById('shBtnFrame').addEventListener('click', function() {
      document.getElementById('shContainer').classList.remove('sh-full-view');
      document.getElementById('shBtnFrame').classList.add('active');
      document.getElementById('shBtnFull').classList.remove('active');
    });

    document.getElementById('shBtnFull').addEventListener('click', function() {
      document.getElementById('shContainer').classList.add('sh-full-view');
      document.getElementById('shBtnFull').classList.add('active');
      document.getElementById('shBtnFrame').classList.remove('active');
    });
  });
})();
</script>
`;
  }

  /**
   * DERİNLİK MOTORU: Sayfadaki aynı domaine ait iç bağlantıları keşfeder
   */
  function discoverInternalLinks() {
    const links = [];
    const currentOrigin = window.location.origin;
    const currentUrlClean = window.location.href.split('#')[0];
    const seenUrls = new Set([currentUrlClean]);

    // 1. <a href> etiketleri
    document.querySelectorAll('a[href]').forEach(a => {
      try {
        const rawHref = a.getAttribute('href');
        if (!rawHref || rawHref.startsWith('javascript:') || rawHref.startsWith('mailto:') || rawHref.startsWith('tel:')) return;
        if (rawHref.startsWith('#')) return;

        const absUrl = new URL(rawHref, document.baseURI).href.split('#')[0];
        const parsed = new URL(absUrl);

        if (parsed.origin !== currentOrigin) return;
        if (/\.(pdf|zip|rar|tar|gz|mp4|mp3|exe|apk|dmg|iso)$/i.test(parsed.pathname)) return;

        // Güvenlik: Oturumu kapatacak veya veri silecek rotaları atla
        if (DANGEROUS_LINK_PATTERNS.some(re => re.test(parsed.pathname))) return;

        if (!seenUrls.has(absUrl)) {
          seenUrls.add(absUrl);
          const label = (a.innerText || a.getAttribute('title') || a.getAttribute('aria-label') || parsed.pathname)
            .replace(/\s+/g, ' ')
            .trim();
          links.push({
            url: absUrl,
            pathname: parsed.pathname,
            title: label.slice(0, 45) || parsed.pathname
          });
        }
      } catch {}
    });

    // 2. Modern SPA Tab / Sekme Butonları ([role="tab"], [data-route], [data-href])
    document.querySelectorAll('[role="tab"], [data-route], [data-href], [data-tab]').forEach(el => {
      try {
        const rawRoute = el.getAttribute('data-href') || el.getAttribute('data-route') || el.getAttribute('href');
        if (!rawRoute || rawRoute.startsWith('#')) return;

        const absUrl = new URL(rawRoute, document.baseURI).href.split('#')[0];
        const parsed = new URL(absUrl);

        if (parsed.origin === currentOrigin && !seenUrls.has(absUrl)) {
          if (DANGEROUS_LINK_PATTERNS.some(re => re.test(parsed.pathname))) return;

          seenUrls.add(absUrl);
          const label = (el.innerText || el.getAttribute('title') || el.getAttribute('aria-label') || 'Sekme')
            .replace(/\s+/g, ' ')
            .trim();
          links.push({
            url: absUrl,
            pathname: parsed.pathname,
            title: label.slice(0, 45) || 'Sekme'
          });
        }
      } catch {}
    });

    return links;
  }

  /**
   * Sayfayı hızlıca kaydırarak lazy-load görselleri ve bileşenleri uyandırır
   */
  async function triggerLazyLoadPass(onProgress) {
    if (onProgress) onProgress('Görseller uyandırılıyor (Lazy-load pass)...');
    const originalScrollY = window.scrollY;
    const bodyHeight = Math.max(document.body.scrollHeight || 0, document.documentElement.scrollHeight || 0);
    const viewportHeight = window.innerHeight || 800;
    const maxScroll = Math.min(bodyHeight, viewportHeight * 5);
    const step = Math.max(400, Math.floor(viewportHeight * 0.8));

    for (let pos = 0; pos < maxScroll; pos += step) {
      window.scrollTo(0, pos);
      await new Promise(r => setTimeout(r, 35));
    }
    window.scrollTo(0, originalScrollY);
    await new Promise(r => setTimeout(r, 60));
  }

  /**
   * AI Asistanları (Claude/Cursor) için HTML'i budar; ağır Base64 görsel ve fontları hafifletir.
   */
  function pruneHtmlForAi(root) {
    const clone = root.cloneNode(true);
    clone.querySelectorAll('img').forEach(img => {
      const src = img.getAttribute('src') || '';
      if (src.startsWith('data:')) {
        const alt = img.getAttribute('alt') || 'Görsel';
        img.setAttribute('src', `[Görsel: ${alt.slice(0, 30)}]`);
      }
    });
    clone.querySelectorAll('style').forEach(st => {
      if (st.textContent) {
        st.textContent = st.textContent.replace(/url\(["']?data:font\/[^;]+;base64,[^"')]+["']?\)/gi, 'local("sans-serif")');
      }
    });
    return clone;
  }

  /**
   * Klonlama Ana Akışı V2
   */
  async function clonePage(options = {}, onProgress = null) {
    const opts = {
      inlineImages: options.inlineImages !== false,
      inlineFonts: options.inlineFonts !== false,
      freezeScripts: options.freezeScripts !== false,
      preserveCanvas: options.preserveCanvas !== false,
      addAiHeader: options.addAiHeader !== false,
      inlineStyles: options.inlineStyles !== false,
      dietMode: options.dietMode === true,
      triggerScroll: options.triggerScroll !== false && !options.isCrawlPage,
      viewport: options.viewport || null,
      isMobile: options.isMobile || Boolean(options.viewport?.mobile) || window.innerWidth <= 600
    };

    if (opts.triggerScroll) {
      await triggerLazyLoadPass(onProgress);
    }

    if (onProgress) onProgress('Sayfa form durumları mühürleniyor...');
    sealInteractiveStates(document);

    const cloneDoc = document.documentElement.cloneNode(true);
    serializeShadowRoots(document, cloneDoc);

    if (opts.preserveCanvas) {
      if (onProgress) onProgress('Grafik ve Canvas elemanları dönüştürülüyor...');
      convertCanvasesToImages(document, cloneDoc);
    }

    if (opts.inlineStyles) {
      let allCss = await harvestAllCss(onProgress);

      if (opts.inlineFonts && !opts.dietMode) {
        allCss = await inlineWebFonts(allCss, onProgress);
      }

      cloneDoc.querySelectorAll('link[rel="stylesheet"]').forEach(l => l.remove());

      const head = cloneDoc.querySelector('head') || cloneDoc;
      const masterStyle = document.createElement('style');
      masterStyle.id = 'snaphtml-master-styles';
      masterStyle.textContent = allCss;
      head.appendChild(masterStyle);
    }

    if (opts.inlineImages && !opts.dietMode) {
      await inlineAllImages(cloneDoc, onProgress);
    }

    if (opts.freezeScripts) {
      if (onProgress) onProgress('Betikler donduruluyor...');
      freezeScripts(cloneDoc);
    }

    let headEl = cloneDoc.querySelector('head');
    if (!headEl) {
      headEl = document.createElement('head');
      cloneDoc.insertBefore(headEl, cloneDoc.firstChild);
    }

    // Çok sayfalı ZIP arşivinde remote base tag yerel href="./sayfa.html" linklerini bozar
    if (options.isCrawlPage) {
      const existingBase = headEl.querySelector('base');
      if (existingBase) existingBase.remove();
    } else if (!headEl.querySelector('base')) {
      const baseTag = document.createElement('base');
      baseTag.href = document.baseURI || window.location.href;
      headEl.insertBefore(baseTag, headEl.firstChild);
    }

    const aiContext = generateAiContext(cloneDoc, opts.viewport);
    if (opts.addAiHeader) {
      const aiScript = document.createElement('script');
      aiScript.type = 'application/json';
      aiScript.id = 'snaphtml-ai-context';
      aiScript.textContent = aiContext.json;
      headEl.appendChild(aiScript);
    }

    // Mobil HTML ise: Bağımsız masaüstü açılışında 390px çerçeve sağlayan containment betiğini ekle
    if (opts.isMobile) {
      const containmentSnippet = generateMobileContainmentScript(opts.viewport);
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = containmentSnippet;
      const containmentScript = tempDiv.firstElementChild;
      if (containmentScript) {
        headEl.appendChild(containmentScript);
      }
    }

    const prunedDoc = pruneHtmlForAi(cloneDoc);
    const aiHtml = '<!DOCTYPE html>\n' + (opts.addAiHeader ? aiContext.comment + '\n' : '') + prunedDoc.outerHTML;

    const finalHtml = opts.dietMode ? aiHtml : ('<!DOCTYPE html>\n' + (opts.addAiHeader ? aiContext.comment + '\n' : '') + cloneDoc.outerHTML);

    if (onProgress) onProgress('Tamamlandı!');

    return {
      html: finalHtml,
      aiHtml: aiHtml,
      metadata: aiContext.data,
      title: document.title || 'snapshot',
      url: window.location.href,
      discoveredLinks: discoverInternalLinks(),
      fingerprint: computeDomFingerprint()
    };
  }

  // ============================================================================
  // MESAJ DİNLEYİCİ
  // ============================================================================
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // 1. Sayfayı Klonla
    if (request.action === 'cloneCurrentPage') {
      (async () => {
        try {
          const result = await clonePage(request.options || {}, (msg) => {
            try {
              chrome.runtime.sendMessage({ action: 'cloneProgress', message: msg });
            } catch {}
          });
          sendResponse({ success: true, ...result });
        } catch (err) {
          console.error('[SnapHTML] Klonlama hatası:', err);
          sendResponse({ success: false, error: err.message });
        }
      })();
      return true;
    }

    // 2. Klasik Linkleri Keşfet
    if (request.action === 'discoverLinks') {
      sendResponse({
        success: true,
        links: discoverInternalLinks(),
        currentUrl: window.location.href
      });
      return false;
    }

    // 3. Akıllı SPA Navigasyon Öğelerini Keşfet
    if (request.action === 'discoverSpaElements') {
      try {
        const result = discoverSpaNavigationElements();
        sendResponse({ success: true, ...result, currentUrl: window.location.href });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
      return false;
    }

    // 4. Güvenli SPA Tıklaması Gerçekleştir
    if (request.action === 'performSafeClick') {
      (async () => {
        try {
          const result = await performSafeNavigationClick(request.navId);
          sendResponse(result);
        } catch (err) {
          sendResponse({ success: false, error: err.message });
        }
      })();
      return true;
    }

    // 5. O Anki DOM Parmak İzini Al
    if (request.action === 'getDomFingerprint') {
      try {
        const fp = computeDomFingerprint();
        sendResponse({ success: true, fingerprint: fp, url: window.location.href, title: document.title });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
      return false;
    }

    // 6. Hızlı Sayfa İstatistikleri
    if (request.action === 'getPageQuickStats') {
      sendResponse({
        success: true,
        title: document.title || 'Başlıksız',
        url: window.location.href,
        hostname: window.location.hostname || 'Yerel Dosya',
        nodeCount: document.querySelectorAll('*').length,
        viewport: `${window.innerWidth} × ${window.innerHeight}`,
        internalLinksCount: discoverInternalLinks().length
      });
      return false;
    }
  });
})();
