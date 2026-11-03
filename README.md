# SnapHTML V2.1 — Mobile Capture, Safe Modal Recovery & Dual-Viewport Accuracy 🌐✨

**SnapHTML V2.1**, web sayfalarını ve tek sayfalı (SPA) modern web uygulamalarını (`localhost`, React, Vue, Next.js, Angular vb.) tek tıkla; **tüm CSS stilleri, fontları, görselleri, anlık DOM durumunu ve AI metadata'sını** koruyarak **gerçek masaüstü ve mobil (390×844) viewport'larıyla** klonlayan yeni nesil bir Chrome Eklentisidir (Manifest V3).

Playwright veya harici bir tarayıcı otomasyon aracına ihtiyaç duymadan, doğrudan Chrome'un kendi mimarisi (`chrome.debugger` CDP) üzerinden çalışır.

---

## 🚀 V2.1 ile Gelen Çözümler & Yenilikler

### 1. 🛡️ Güvenli Modal Tespiti ve Kurtarma (Safe Modal Detection & Recovery)
- DevHub ve SPA'larda sayfa açılışında beliren **"Çalışma Alanı Projesi Oluştur veya İçe Aktar"** gibi dialog/modal overlay'leri otomatik tespit edilir.
- Modal başlı başına taranması gereken bir ekran ise önce bağımsız bir snapshot (`screen_modal_create_project`) olarak kaydedilir.
- Ardından diğer ekranların üzerini kapatmaması için güvenli sıralama ile kapatılır:
  1. Belirgin ve güvenli **Kapat / İptal / X** butonu
  2. Desteklenen **Escape** klavye olayı
  3. Güvenli **Backdrop** etkileşimi
  4. **Gerçek DOM doğrulaması** (modalın gerçekten kapandığı teyit edilmeden sonraki adıma geçilmez).
- Save, Submit, Delete gibi form onayları asla otomatik tetiklenmez. Kapanmayan formlar `BLOCKED_BY_MODAL` olarak işaretlenir.

### 2. 🎯 Kusursuz Desktop / Mobile Ekran Eşleştirmesi (Zero Mismatches)
- React SPA'larda URL'ler aynı kaldığında ekran kimliği URL'den değil; aktif menü, aktif tab, semantik başlıklar ve içerik parmak izi üzerinden kanonik kimliklerle oluşturulur:
  - `screen_chat` (Sohbet / Chat)
  - `screen_editor` (Kod Editörü / Editor)
  - `screen_git` (Git)
  - `screen_agents` (Ajanlar / Agents)
  - `screen_database` (Veritabanı / Database)
  - `screen_deployments` (Dağıtımlar / Deployments)
  - `screen_settings` (Ayarlar / Settings)
- Desktop ve Mobile taramaları bağımsız yürütülür ve her iki taraftaki ekranlar ortak kanonik kimlikleriyle birebir eşleştirilir.
- Mobilde bulunmayan ekranlar yanlış bir ekrana bağlanmaz; `UNMATCHED` olarak raporlanır.

### 3. 🧹 Temiz Navigasyon Durumu (Clean Navigation State)
- Her capture öncesinde açık kalan geçici menüler, mobil hamburger drawer'ları veya popover'lar otomatik temizlenir.
- Ekran görüntüsü ve HTML çıktısının aynı temiz ekran durumuna ait olması kesin olarak garanti edilir.

### 4. 🩺 Capture Health Raporu (`capture-health.json`)
ZIP arşivine ve portala tam teşekküllü bir sağlık denetim raporu eklenmiştir:
- **Discovered Screens** (Keşfedilen toplam ekran sayısı)
- **Desktop Captures** (Masaüstü HTML sayısı)
- **Mobile Captures** (Mobil 390px HTML sayısı)
- **Matched Screens** (Kusursuz eşleşen çift viewport ekranları)
- **Unmatched Screens** (Yalnızca bir platformda bulunanlar)
- **Modal Blocked Captures** (Modal nedeniyle içeriği engellenenler)
- **Skipped Unsafe Interactions** (Güvenlik gereği atlanan butonlar)

### 5. 📦 Gelişmiş ZIP Paketi & İnteraktif Çevrimdışı Portal
Paketlenen ZIP dosyasının yapısı:
```text
snapshots/
  desktop/
    01-screen_home.html
    02-screen_chat.html
    03-screen_editor.html
    04-screen_git.html
    05-screen_agents.html
    06-screen_database.html
    07-screen_deployments.html
    08-screen_settings.html
  mobile/
    01-screen_home.html
    02-screen_chat.html
    03-screen_editor.html
    04-screen_git.html
    05-screen_agents.html
    06-screen_database.html
    07-screen_deployments.html
    08-screen_settings.html
screenshots/
  desktop/
    01-screen_home.png ...
  mobile/
    01-screen_home.png ...
capture-health.json
manifest.json
project_ai.md
index.html
```

- **`index.html`**: Çevrimdışı çalışan interaktif portal.
  - Sol menüden ekran seçimi
  - `🖥️ Masaüstü` (1440×900) ve `📱 Mobil` (390×844 cihaz kasası)
  - `⚖️ Karşılaştır` (Canlı HTML ile gerçek CDP screenshot'ını split-view karşılaştırma)
  - `🩺 Sağlık Raporu` (KPI kartları ve ekran durum tablosu: PASS, PARTIAL, BLOCKED_BY_MODAL, UNMATCHED)
  - `📋 Manifest` (JSON formatında tüm DOM parmak izleri ve meta veriler)

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
├── content-script.js          # SPA Keşif Motoru, Modal Tespiti & Kurtarma, Kanonik Kimlikler
├── lib/
│   ├── viewport.js            # CDP Emulation (Device metrics, UA, Touch, Screenshot)
│   ├── spa-crawler.js         # Master SPA Keşif, Modal Recovery & Çift Viewport Koordinatörü
│   ├── zip-export.js          # capture-health.json, manifest.json ve index.html portal üreticisi
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
