/**
 * SnapHTML - Content Script (DOM & Asset Cloner Engine)
 * Web sayfalarını CSS, fontlar, görseller, anlık form/DOM durumu ve
 * AI metadata'sı ile eksiksiz, tek parça bağımsız HTML olarak klonlar.
 * Çok sayfalı derinlik (Crawl Depth) için bağlantı keşfi ve yerel link dönüştürmeyi destekler.
 */

(() => {
  if (window.__snaphtml_engine_ready) return;
  window.__snaphtml_engine_ready = true;

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
      if (type.includes('json') || script.id === 'snaphtml-ai-context') {
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
  function generateAiContext(cloneDoc) {
    const title = document.title || 'Başlıksız Web Sayfası';
    const url = window.location.href;
    const viewport = `${window.innerWidth}×${window.innerHeight} (DPR: ${window.devicePixelRatio || 1})`;
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

  const DANGEROUS_LINK_PATTERNS = [
    /\/logout/i, /\/log-out/i, /\/cikis/i, /\/signout/i, /\/sign-out/i,
    /\/auth\/logout/i, /\/delete/i, /\/sil/i, /\/disconnect/i, /\/unsubscribe/i,
    /\/account\/delete/i, /\/session\/destroy/i
  ];

  /**
   * DERİNLİK MOTORU: Sayfadaki aynı domaine ait iç bağlantıları (Sekmeler, Menü linkleri vb.) keşfeder
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
   * Sayfayı hızlıca kaydırarak lazy-load (gecikmeli) görselleri ve bileşenleri uyandırır
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
   * Klonlama Ana Akışı
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
      triggerScroll: options.triggerScroll !== false && !options.isCrawlPage
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

    const aiContext = generateAiContext(cloneDoc);
    if (opts.addAiHeader) {
      const aiScript = document.createElement('script');
      aiScript.type = 'application/json';
      aiScript.id = 'snaphtml-ai-context';
      aiScript.textContent = aiContext.json;
      headEl.appendChild(aiScript);
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
      discoveredLinks: discoverInternalLinks()
    };
  }

  // Mesaj dinleyici
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
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

    if (request.action === 'discoverLinks') {
      sendResponse({
        success: true,
        links: discoverInternalLinks(),
        currentUrl: window.location.href
      });
      return false;
    }

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
