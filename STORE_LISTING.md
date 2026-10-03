# 🛍️ SnapHTML — Chrome Web Store Yayınlama Paketi & Mağaza Metinleri

Bu doküman, **SnapHTML** eklentisini **Google Chrome Web Store Developer Dashboard** üzerinde yayınlarken girmeniz gereken tüm metinleri, mağaza varlıklarını, izin gerekçelerini ve inceleme yönergelerini içermektedir.

---

## 📌 1. Temel Mağaza Bilgileri

| Alan | Değer / Açıklama | Karakter Sınırı / Durum |
| :--- | :--- | :--- |
| **Eklenti Adı (Extension Name)** | `SnapHTML — Web Cloner & AI Mirror` | Max 45 karakter (34 karakter ✅) |
| **Kısa Açıklama (TR)** | `Web sayfalarını stilleri, fontları ve DOM durumuyla klonlar; tek tıkla bağımsız HTML veya AI için hazır ZIP paketi yapar.` | Max 132 karakter (120 karakter ✅) |
| **Short Description (EN)** | `Clone any web page with styles, fonts, images, and DOM state into standalone offline HTML or multi-page ZIP ready for AI.` | Max 132 karakter (122 karakter ✅) |
| **Sürüm (Version)** | `1.0.0` | Manifest V3 |
| **Kategori (Category)** | `Geliştirici Araçları (Developer Tools)` veya `Verimlilik (Productivity)` | Birincil: Developer Tools |
| **Fiyatlandırma** | `Ücretsiz (Free)` | — |
| **Dil Desteği** | Türkçe & İngilizce | — |

---

## 📝 2. Detaylı Mağaza Açıklaması (Store Description)

### 🇹🇷 Türkçe Açıklama (Chrome Web Store İçin Kopyalayın):

```text
SnapHTML — Açık olan herhangi bir web sayfasını veya web uygulamasını (React, Next.js, Vue, Tailwind, localhost vb.) tek tıkla; tüm CSS stilleri, fontları, resimleri, Canvas grafiklerini, form verilerini ve anlık DOM durumunu içine gömerek %100 bağımsız tek parça bir HTML dosyası veya birbirine bağlı çok sayfalı bir ZIP web sitesi paketi olarak donduran yeni nesil bir geliştirici aracıdır.

Artık web sitelerini Claude, Cursor, ChatGPT, Antigravity ve Gemini gibi yapay zeka modellerine eksiksiz aktarmak çocuk oyuncağı!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 3 FARKLI KLONLAMA DERİNLİĞİ:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔘 Seviye 0: Tek Sayfa (Standalone .HTML)
- Açık olan sayfayı tüm görselleri (Base64), Google Fonts/Web fontlarını (@font-face) ve hesaplanmış CSS kurallarını tek bir dosyaya mühürler.
- Çift tıkladığınızda internet bağlantısı veya yerel sunucu olmadan doğrudan tarayıcınızda açılır.

🔘 Seviye 1: Sekmeler & Menü Bağlantıları (.ZIP Web Sitesi)
- Sayfadaki üst menü sekmelerini (Örn: Genel Bakış, Raporlar, Profil, Ayarlar) otomatik keşfeder.
- Her sekmeyi arka planda açıp stilleriyle klonlar.
- Yerel Link Dönüştürme: Sayfalardaki href="/ayarlar" linklerini otomatik olarak yerel href="./ayarlar.html" dosyalarına bağlar. ZIP'i açtığınızda sekmelere tıklayarak sayfalar arasında gezinebilirsiniz!

🔘 Seviye 2: Kapsamlı Derinlik (Recursive Crawl)
- Seviye 1'deki sayfaların alt detay bağlantılarını da zincirleme tarayarak çok sayfalı dokümantasyonları, panelleri veya portalları yerel bir çevrimdışı site paketine dönüştürür.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🤖 AI PROJE RÖNTGENİ (project_ai.md):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ZIP paketinin içine otomatik olarak eklenen 'project_ai.md' dosyası ile:
- Tüm sayfaların hiyerarşik site haritası
- Sayfa başına DOM elemanları, butonlar ve form girdi sayıları
- Kullanılan CSS Framework tespiti (Tailwind, React, Next.js, Bootstrap)
- Sayfanın hesaplanmış renk paleti hazır bir AI promptu olarak sunulur.

Kullanım: ZIP klasörünü Cursor veya Claude Projects içerisine sürükleyin; yapay zeka tüm sitenizin mimarisini anında anlasın ve yeni özellikler kodlasın!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ ÖNE ÇIKAN ÖZELLİKLER:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✔ Sıfır Bağımlılık & Saf JavaScript: Pure-JS ZIP motoru ile harici sunucuya ihtiyaç duymaz.
✔ Canvas-to-PNG: Sayfadaki Chart.js ve çizim grafiklerini kayıpsız görsellere dönüştürür.
✔ Canlı Önizleme Çalışma Alanı: Klonlanan sayfayı indirmeden önce Masaüstü, Tablet ve Mobil boyutlarında test edin.
✔ Gizlilik Odaklı & %100 Yerel: Hiçbir veriniz, oturum bilginiz veya taranan kodlar üçüncü taraf sunuculara gitmez. Her şey yerel tarayıcınızda çalışır.
```

---

### 🇬🇧 English Description (For Global Chrome Web Store Listing):

```text
SnapHTML — The next-generation web cloning and AI mirroring tool that freezes any web page or full web application (React, Next.js, Vue, Tailwind, dashboards, localhost) into a 100% self-contained standalone .html file or a multi-page connected .zip website package.

Capture live DOM states, all computed CSS rules, Base64 embedded fonts (@font-face), images, Canvas graphics, and form values with zero dependencies. Perfectly structured for LLMs including Claude, Cursor, ChatGPT, Antigravity, and Gemini!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 3 CRAWL DEPTH LEVELS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔘 Level 0: Single Page (Standalone .HTML)
- Inlines all CSS, images (Base64), web fonts, and interactive form states into one single offline file.
- Double-click to open in any browser without needing a local server or internet access.

🔘 Level 1: Tabs & Internal Navigation (.ZIP Website Package)
- Auto-discovers navigation tabs, menu links, and SPA routes (e.g. Overview, Analytics, Settings, Team).
- Opens and clones each tab in the background.
- Smart Link Rewriter: Automatically converts links like href="/settings" into local href="./settings.html". You can click tabs and navigate seamlessly offline!

🔘 Level 2: Recursive Crawl
- Recursively crawls child pages and sub-routes to archive entire dashboards or documentation portals.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🤖 AI PROJECT MIRROR (project_ai.md):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Every multi-page ZIP export includes an automated 'project_ai.md' file:
- Hierarchical sitemap of all crawled pages
- Breakdown of DOM nodes, interactive buttons, inputs, and form statistics
- Framework detection (Tailwind CSS, React, Next.js, Vue, Bootstrap)
- Extracted computed color palette and design tokens

Usage: Drag and drop the unzipped folder into Cursor or Claude Projects — your AI assistant can now comprehend and refactor your entire application architecture!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ KEY HIGHLIGHTS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✔ Zero External Dependencies: In-browser pure-JS ZIP writer and IndexedDB engine.
✔ Canvas to High-Res Image: Converts live dynamic charts (Chart.js, Canvas) into crisp PNGs.
✔ Live Responsive Preview: Test snapshots across Desktop, Tablet (768px), and Mobile (390px) viewports before exporting.
✔ 100% Private & Local-First: No analytics, no remote tracking, no server uploads. Everything runs locally in your browser.
```

---

## 🔒 3. Google İnceleme Ekibi İçin Form Girdileri (Reviewer Declarations)

Google Chrome Web Store onay süreci sırasında sorulan sorulara şu yanıtları verin:

### A. Tek Amaç Bildirimi (Single Purpose Description):
> *"SnapHTML allows developers and AI users to capture complete, standalone offline snapshots of web pages and multi-page web applications with inlined styles, fonts, and assets for offline viewing and AI architecture analysis."*

### B. İzin Gerekçeleri (Permission Justifications):

| İzin (Permission) | Google İnceleme Formuna Yazılacak Gerekçe (Justification) |
| :--- | :--- |
| **`activeTab`** | *Used to access the currently active browser tab to read its DOM structure, styles, and internal links when the user clicks the clone button in the popup.* |
| **`scripting`** | *Used to inject the DOM serialization and asset inlining content script into the active tab and background crawling tabs.* |
| **`storage`** | *Used to persist user preferences (e.g. toggle inline images, fonts, freeze scripts, selected crawl depth).* |
| **`unlimitedStorage`** | *Used to store large snapshot HTML files containing Base64 encoded assets in IndexedDB so the user can inspect them in the Preview tab without browser quota exceptions.* |
| **`downloads`** | *Used to trigger the direct download of the generated standalone .html file or the bundled multi-page .zip archive to the user's local disk.* |
| **`clipboardWrite`** | *Used to allow the user to click the "Copy AI Prompt" button and instantly copy the structured Markdown architecture summary to their clipboard.* |
| **`<all_urls>` (Host Permissions)** | *Necessary because the extension is designed to clone user-specified web pages across any domain (including developer localhost servers, staging environments, and public websites). It is also required to fetch cross-origin stylesheets (CSS) and font files via the background service worker to inline them and bypass browser CORS restrictions.* |

### C. Uzak Kod Kullanımı (Remote Code Policy):
- **Soru:** Does your extension use remote code (e.g. `eval`, dynamically loaded external scripts)?
- **Cevap:** **NO** (SnapHTML contains 100% local, self-contained JavaScript and bundles all its logic in MV3 service workers and local modules).

---

## 🎨 4. Hazırlanan Görsel Varlıklar Listesi

Aşağıdaki dosyalar `store-assets/` ve `icons/` dizininde tam mağaza standartlarına uygun olarak üretilmiştir:

1. **Uygulama İkonları (Extension Icons):**
   - `icons/icon16.png` (16×16 px)
   - `icons/icon32.png` (32×32 px)
   - `icons/icon48.png` (48×48 px)
   - `icons/icon128.png` (128×128 px)
   - `store-assets/icon-128.png` (Mağaza ana simgesi)

2. **Tanıtım Görselleri (Promotional Tiles):**
   - `store-assets/promo-small-440x280.png` (Küçük tanıtım kutusu — 440×280 px)
   - `store-assets/promo-marquee-1400x560.png` (Geniş vitrin banner'ı — 1400×560 px)

3. **Mağaza Ekran Görüntüleri (Screenshots - 1280×800 px):**
   - `store-assets/screenshot-1-instant-clone.png` — *Tek Tıkla Eksiksiz HTML Klonlama & Popup Arayüzü*
   - `store-assets/screenshot-2-multi-page-crawl.png` — *Çok Sayfalı Crawl & ZIP Paketleme (Seviye 0, 1, 2)*
   - `store-assets/screenshot-3-responsive-preview.png` — *Çoklu Cihaz Önizleme & Test Çalışma Alanı (Workspace)*
   - `store-assets/screenshot-4-ai-mirror.png` — *AI Proje Röntgeni (project_ai.md) & Claude/Cursor Entegrasyonu*

---

## 🚀 5. Mağazaya Yükleme Adımları (Adım Adım Kılavuz)

1. **Chrome Developer Dashboard'a Girin:**
   - [https://chrome.google.com/webstore/devconsole](https://chrome.google.com/webstore/devconsole) adresine gidin.
   - (İlk defa yüklüyorsanız bir defalık 5$ Google geliştirici kayıt ücreti ödenir).
2. **"Yeni Öğe Ekle" (Add new item) Butonuna Tıklayın:**
   - Projenin kök dizininde oluşturulan **`SnapHTML_v1.0.0_ChromeWebStore.zip`** dosyasını sürükleyip bırakın.
3. **Mağaza Bilgilerini Doldurun:**
   - Yukarıdaki **Başlık**, **Kısa Açıklama** ve **Detaylı Açıklama** metinlerini yapıştırın.
4. **Görselleri Yükleyin:**
   - `store-assets/icon-128.png` dosyasını mağaza ikonuna yükleyin.
   - `store-assets/` içerisindeki 4 adet 1280×800 ekran görüntüsünü yükleyin.
   - `promo-small-440x280.png` ve `promo-marquee-1400x560.png` dosyalarını tanıtım kutularına yükleyin.
5. **Gizlilik Sekmesi (Privacy Tab):**
   - Gizlilik Politikası URL'si alanına GitHub Pages veya Notion linkinizi girin (Şablon `PRIVACY_POLICY.md` dosyasında hazırdır).
   - Yukarıdaki izin gerekçelerini formdaki ilgili alanlara kopyalayın.
   - "Veri topluyor musunuz?" sorusuna **HAYIR** işaretleyin.
6. **"İncelemeye Gönder" (Submit for review) Butonuna Basın:**
   - Google genellikle 24-48 saat içerisinde eklentiyi onaylayıp canlıya alır.
