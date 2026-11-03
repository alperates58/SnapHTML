# SnapHTML V2 — Mobile Capture & Intelligent SPA Crawler 🌐✨

**SnapHTML V2**, web sayfalarını ve tek sayfalı (SPA) modern web uygulamalarını (`localhost`, React, Vue, Next.js, Angular vb.) tek tıkla; **tüm CSS stilleri, fontları, görselleri, anlık DOM durumunu ve AI metadata'sını** koruyarak **gerçek masaüstü ve mobil (390×844) viewport'larıyla** klonlayan yeni nesil bir Chrome Eklentisidir (Manifest V3).

Playwright veya harici bir tarayıcı otomasyon aracına ihtiyaç duymadan, doğrudan Chrome'un kendi mimarisi (`chrome.debugger` CDP) üzerinden çalışır.

---

## 🚀 V2 ile Gelen Yenilikler

### 1. 📱 Gerçek Mobil Viewport ve Çift Görünüm (Desktop + Mobile)
- **Masaüstü (1440×900)**, **Mobil (390×844 iPhone)**, **Tablet (768×1024 iPad)** veya **Dual View (Desktop + Mobile)**.
- `chrome.debugger` üzerinden `Emulation.setDeviceMetricsOverride` ve `setUserAgentOverride` ile gerçek ekran boyutları ve CSS media query hesaplamaları uygulanır.
- Geçici emülasyon capture sonrasında kesinlikle temizlenir.
- Orijinal sekmenin düzeni bozulmaz; tarama işlemi izole bir geçici sekmede yürütülür.

### 2. 🛡️ True Mobile HTML Export & Standalone Responsive Containment
- Mobil görünümde yakalanan HTML masaüstünde doğrudan çift tıklandığında masaüstü düzenine dönüşmez.
- Bağımsız açılışlarda dahili 390px mobil cihaz çerçevesi ile açılır ve medya sorgularını mobil sınırlar içinde tutar.
- SnapHTML Viewer ve ZIP içindeki `index.html` portalında otomatik 390px telefon çerçevesi sunulur.

### 3. 🧭 Akıllı SPA State Keşif Motoru (Zero-URL-Change SPAs)
- React, Vue ve Angular gibi URL değiştirmeyen arayüzlerde:
  - Sidebar navigasyonu
  - Üst menü sekmeleri
  - Tab barlar (`role="tab"`, `aria-controls`, `data-state`)
  - Mobil alt gezinme çubuğu (Bottom Navigation)
  - `data-testid` ve veri öznitelikleri
- Her tıklama sonrası:
  - **DOM Stabilizasyonu & MutationObserver**
  - **Semantik İçerik Parmak İzi (DOM Fingerprint)**
  - **Asenkron İçerik & Yükleme Spinner Kontrolleri**
- URL değişmese bile içerik anlamlı şekilde değiştiğinde bağımsız mantıksal bir ekran kimliğiyle (`screen_chat`, `screen_editor`, `screen_git`, `screen_agents`, `screen_database`, `screen_deployments`, `screen_settings`) kaydedilir.

### 4. 🔒 Güvenli Tarama (Safe Crawling Guarantee)
- Tarayıcı yalnızca salt-okunur güvenli navigasyon işlemleri yapar.
- Şunlar **asla** otomatik tıklanmaz:
  - `Delete / Sil / Kaldır`
  - `Save / Submit / Kaydet / Gönder`
  - `Deploy / Yayınla / Dağıt`
  - `Push / Commit / Migration`
  - `Logout / Çıkış / Sign Out`
  - `Payment / Satın Alma / Ödeme`
  - `Form Gönderimi & Dosya Yükleme`

### 5. 📦 Gelişmiş ZIP Paketi & İnteraktif Çevrimdışı Portal
Paketlenen ZIP dosyasının yapısı:
```text
snapshots/
  desktop/
    01-home.html
    02-chat.html
    03-editor.html
    04-git.html
    05-agents.html
    06-database.html
    07-deployments.html
    08-settings.html
  mobile/
    01-home.html
    02-chat.html
    03-editor.html
    04-git.html
    05-agents.html
    06-database.html
    07-deployments.html
    08-settings.html
screenshots/
  desktop/
    01-home.png
    02-chat.png ...
  mobile/
    01-home.png
    02-chat.png ...
manifest.json
project_ai.md
index.html
```

- **`index.html`**: Çevrimdışı çalışan interaktif portal. Sol menüden ekranlar seçilebilir; Masaüstü, Mobil veya **"Screenshot Karşılaştır"** split-view modu ile yakalanan HTML ve gerçek ekran görüntüsü piksel piksel yan yana kıyaslanabilir!
- **`manifest.json`**: Original URL, Logical Screen ID, Title, Viewport, DOM Fingerprint, Zaman Damgası ve Atlanan Güvenlik Öğelerini eksiksiz içerir.

---

## 🛠️ Chrome'a Kurulum (30 Saniye)

1. Google Chrome adres çubuğuna şunu yazıp Enter'a basın:
   ```text
   chrome://extensions
   ```
2. Sağ üstteki **"Geliştirici modu" (Developer mode)** anahtarını açın.
3. Sol üstte beliren **"Paketlenmemiş öğe yükle" (Load unpacked)** butonuna tıklayın.
4. Masaüstündeki **`SnapHTML`** klasörünü seçin.
5. Araç çubuğundaki yapboz simgesinden **SnapHTML**'i raptiyeyle sabitleyin.

---

## 💡 Kullanım

1. Hedef web uygulamasına gidin (örn. `https://dev.alperates.com.tr` veya `http://localhost:3000`).
2. Chrome araç çubuğundaki **SnapHTML** ikonuna tıklayın.
3. **Görünüm Seçin:** `Desktop`, `Mobile` veya `Dual View (Desktop + Mobile)`.
4. **Tarama Modu Seçin:** `Akıllı SPA` (Önerilen) veya `Tek Ekran`.
5. **"Tüm Siteyi Tara (Desktop + Mobile) [.zip]"** butonuna tıklayın.
6. İndirilen ZIP dosyasını açıp içindeki `index.html` üzerinden projenizi çevrimdışı inceleyin!

---

## 📁 Proje Dosya Mimarisi

```text
SnapHTML/
├── manifest.json              # Chrome MV3, debugger, tabs, storage izinleri
├── background.js              # Service Worker, CDP köprüsü, ZIP yöneticisi
├── content-script.js          # SPA Keşif Motoru, Fingerprinting, Güvenli Navigasyon, DOM Klonlama
├── lib/
│   ├── viewport.js            # CDP Emulation (Device metrics, UA, Touch, Screenshot)
│   ├── spa-crawler.js         # Master SPA Keşif & Çift Viewport Koordinatörü
│   ├── zip-export.js          # manifest.json ve interaktif index.html portal üreticisi
│   ├── zip.js                 # Sıfır bağımlılıklı pure-JS ZIP yazıcı
│   └── storage.js             # IndexedDB motoru
├── popup/
│   ├── popup.html             # Viewport & SPA modlu popup arayüzü
│   ├── popup.css              # Dark glassmorphism stilleri
│   └── popup.js               # Popup kontrolörü & canlı ilerleme göstergesi
├── preview/
│   ├── preview.html           # Çoklu cihaz (390px mobil çerçeveli) önizleme alanı
│   ├── preview.css            # Preview çalışma alanı stilleri
│   └── preview.js             # Canlı iframe ve mobil çerçeve kontrolü
└── scripts/
    └── pack_extension.js      # Chrome Web Store üretim paketi derleyici
```
