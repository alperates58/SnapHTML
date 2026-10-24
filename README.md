# SnapHTML — Multi-Level Web Cloner & AI Mirror 🌐✨

**SnapHTML**, açık olan herhangi bir web sayfasını veya tüm web projenizi (`localhost`, React/Next.js panelleri vb.) tek tıkla; **tüm CSS stilleri, fontları, görselleri, anlık DOM durumunu ve AI metadata'sını** içine gömerek **tek parça bağımsız `.html`** veya **birbirine bağlı çok sayfalı bir `.zip` web sitesi paketi** olarak klonlayan yeni nesil bir Chrome Eklentisidir (Manifest V3).

---

## 🎯 Seviyeler ve Derinlik (Crawl Depth Levels)

SnapHTML, tek bir sayfanın ötesine geçerek tüm sekmeleri ve alt sayfaları zincirleme klonlayabilir:

### 🔘 Seviye 0: Tek Sayfa (Instant Standalone HTML)
- Sadece ekranda açık olan aktif sayfayı dondurur.
- Çıktı: Tek bir `sayfa.html` dosyası. İnternetsiz veya sunucusuz çift tıklandığında projenin aynısı açılır.

### 🔘 Seviye 1: Sekmeler ve Menü Bağlantıları (Multi-Page ZIP)
- Sayfanın üst menüsündeki tüm sekmeleri (örn: **Genel Bakış**, **Kişilik DNA**, **Psikolojik Rapor**, **11 Boyut** vb.) ve iç linkleri otomatik keşfeder.
- Her bir sekmeyi arka planda açıp stilleri ve görselleriyle klonlar.
- **Yerel Link Dönüştürme:** Sayfalardaki `href="/kisilik-dna"` linklerini yerel `href="./kisilik_dna.html"` dosyalarına bağlar.
- Çıktı: `index.html`'i açtığınızda üstteki sekmelere tıkladıkça sayfalar arası gerçekten geçiş yapabileceğiniz tam bir **`.zip` Web Sitesi Paketi**.

### 🔘 Seviye 2: Kapsamlı Derinlik (Recursive Crawl)
- Seviye 1'deki sayfaların da kendi içindeki alt bağlantıları (detay sayfaları, alt kategoriler) zincirleme olarak tarar.
- Çok sayfalı web portallarını, dokümantasyon sitelerini veya büyük dashboard'ları tek seferde yerel bir arşive dönüştürür.

---

## 🤖 AI Proje Röntgeni (`project_ai.md`)

Çok sayfalı klonlama yapıldığında, ZIP paketinin içine otomatik olarak bir **`project_ai.md`** dosyası eklenir. Bu dosya şunları içerir:
- Tüm sayfaların hiyerarşik site haritası
- Her sayfanın DOM elemanı, buton, girdi ve form istatistikleri
- Kullanılan renk paleti ve Framework tespiti (Tailwind, React, Next.js, Bootstrap)

> **Kullanım:** ZIP'i açıp klasörü **Cursor**, **Antigravity** veya **Claude Projects** içerisine sürükleyin. AI artık sadece bir ekranı değil, **tüm yazılım projenizi** bir bütün olarak anlayıp geliştirebilir!

---

## 🚀 Chrome'a Nasıl Kurulur? (30 Saniye)

1. Google Chrome adres çubuğuna şunu yazıp Enter'a basın:
   ```text
   chrome://extensions
   ```
2. Sağ üstteki **"Geliştirici modu" (Developer mode)** anahtarını açın.
3. Sol üstte beliren **"Paketlenmemiş öğe yükle" (Load unpacked)** butonuna tıklayın.
4. Masaüstündeki **`SnapHTML`** klasörünü seçin.
5. Araç çubuğundaki yapboz simgesinden **SnapHTML**'i raptiyeyle sabitleyin.

---

## 💡 Nasıl Kullanılır?

1. Klonlamak istediğiniz web sayfasına gidin (örn. `http://localhost:3000/dashboard`).
2. Chrome araç çubuğundaki **SnapHTML** ikonuna tıklayın.
3. **Klonlama Derinliğini Seçin**:
   - `0`: Yalnızca aktif sayfa (.html)
   - `1`: Aktif sayfadaki menü & sekmeler (.zip)
   - `2`: Tüm alt sayfalar (.zip)
4. (İsteğe bağlı) **"Listeyi Gör"** butonuna basarak taranmasını istemediğiniz linklerin işaretini kaldırabilirsiniz.
5. **Klonla & İndir** butonuna basın. Gerisini SnapHTML halleder!

---

## 📁 Proje Dosya Yapısı

```text
SnapHTML/
├── manifest.json              # Chrome Manifest V3 yapılandırması & universal host permissions
├── background.js              # Recursive Crawl Engine, Universal CORS bypass, Link Rewriter & ZIP Manager
├── content-script.js          # DOM serialization, Canvas-to-PNG, Declarative Shadow DOM, Link Discovery
├── icons/                     # 16, 32, 48, 128 PNG ikonları
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
├── lib/
│   ├── storage.js             # IndexedDB motoru: Büyük boyutlu snapshot'lar için kotasız depolama
│   └── zip.js                 # Sıfır bağımlılıklı pure-JS ZIP arşivleme kütüphanesi
├── popup/
│   ├── popup.html             # Derinlik seçicili dark-glassmorphism açılır menü
│   ├── popup.css              # Segmented control ve modern UI stilleri
│   └── popup.js               # Derinlik yönetimi, link filtreleme ve tarama tetikleyicisi
├── preview/
│   ├── preview.html           # Çoklu cihaz (Desktop/Tablet/Mobile) önizleme çalışma alanı
│   ├── preview.css            # Workspace stilleri
│   └── preview.js             # Canlı iframe render & AI prompt motoru
├── store-assets/              # Chrome Web Store için 1280x800 ekran görüntüleri ve tanıtım banner'ları
├── STORE_LISTING.md           # Mağaza başlıkları, açıklamaları ve izin gerekçeleri kılavuzu
├── PRIVACY_POLICY.md          # Google CWS uyumlu resmi Gizlilik Politikası
├── SnapHTML_v1.0.1_ChromeWebStore.zip # Mağazaya doğrudan yüklenecek temiz üretim paketi
└── README.md                  # Proje dokümantasyonu
```
