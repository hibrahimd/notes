# Not Al – Ürün Tanımı ve Teknik README Taslağı

## 1) Proje Özeti

**Not Al**, mobilde gezinirken link, metin, görsel ve paylaşılabilir içerikleri hızlıca kaydetmeye yarayan; kaydedilen notları daha sonra okuyup özetleyebilen, çevirebilen, kategorize edebilen ve uygun durumlarda videolar için altyazı üretebilen bir web uygulamasıdır.

Sistem iki ana arayüzden oluşur:
- **Admin paneli**
- **User paneli**

Uygulamanın temel amacı şudur:
- Kullanıcı mobil cihazında gezerken bir içeriği hızlıca paylaşır.
- İçerik sisteme not olarak düşer.
- Sistem içeriği tipine göre işler.
- Kullanıcı daha sonra bu notu kendi dilinde anlamlandırılmış halde görür.

---

## 2) Hedef Kullanım Senaryosu

Kullanıcı iPhone üzerinde gezerken:
- Safari / X / Instagram / YouTube / diğer uygulamalarda bir içerik açar.
- **Paylaş > Not Al** kısayolu ile içeriği gönderir.
- Sistem içeriği kaydeder.
- Eğer içerik bir video ise:
  - video metadata alınır,
  - mümkünse video locale indirilir,
  - ses çözümlenir,
  - transkript oluşturulur,
  - kullanıcının seçtiği dile çevrilir,
  - altyazılı oynatma hazırlanır.
- Eğer içerik bir blog / makale ise:
  - Readability benzeri içerik çıkarımı yapılır,
  - özet oluşturulur,
  - tam çeviri hazırlanır.
- Sistem notu AI ile kategorize eder.
- Kullanıcı isterse notu paylaşılabilir hale getirir.

---

## 3) Roller

### 3.1 Admin
Admin aşağıdaki yetkilere sahip olacaktır:
- Kullanıcıları listeleme ve yönetme
- Genel sistem ayarlarını yönetme
- SMTP / email ayarlarını tanımlama
- Sistem loglarını görüntüleme
- Kuyruk / job durumlarını görüntüleme
- Hata kayıtlarını inceleme
- Gerektiğinde kullanıcı not işlemlerini yeniden kuyruğa alma
- Plan / kota / sistem limitleri tanımlama

### 3.2 User
Kullanıcı aşağıdaki işlemleri yapabilecektir:
- Email + doğrulama kodu ile giriş yapma
- Profil ve ayarlarını yönetme
- Kendi API anahtarlarını ekleme / silme
- iPhone paylaşım kısayolu oluşturma
- Link / metin / görsel / medya notlarını görüntüleme
- Not detaylarını görme
- Çeviri, özet, kategori, transkript, altyazı gibi işlenmiş çıktıları görme
- Notu paylaşılabilir hale getirme
- Kendi notları içinde arama / filtreleme yapma

---

## 4) Kimlik Doğrulama

### 4.1 Giriş Mantığı
Şifreli klasik giriş yerine **email magic code** kullanılacaktır.

Akış:
1. Kullanıcı email adresini girer.
2. Sistem tek kullanımlık, 6 hanelik kısa ömürlü doğrulama kodu üretir.
3. Bu kod email ile kullanıcıya gönderilir.
4. Kullanıcı kodu ekrana girer. ekrandaki kodlar yan yana 6 kutu olmalı ve kullanıcı dostu olmalı birine girince diğer kutuya geçmeli, silince bir öncekine dönmeli.
5. Kod doğrulanırsa oturum açılır.

### 4.2 Güvenlik Kuralları
- Kodun geçerlilik süresi örneğin **5 dakika**
- Peş peşe yanlış girişlerde rate limit
- Aynı email için kısa sürede çok fazla kod talebine engel
- Kodlar plaintext değil hash olarak saklanmalı
- Login denemeleri loglanmalı
- Session cookie `HttpOnly`, `Secure`, `SameSite=Lax/Strict`

---

## 5) Panel Yapısı

## 5.1 Admin Paneli
Önerilen menüler:
- Dashboard
- Users
- Email Settings
- System Settings
- Jobs / Queue
- Logs
- Providers
- Limits / Plans

### Admin Panelinde Bulunması Gerekenler
#### Email Settings
- SMTP host
- SMTP port
- SMTP kullanıcı adı
- SMTP şifresi
- Gönderen adı
- Gönderen email
- SSL / TLS ayarı
- Test email gönder butonu

#### System Settings
- Varsayılan uygulama dili
- Desteklenen diller
- Maksimum not boyutu
- Maksimum video süresi
- Maksimum dosya boyutu
- Queue concurrency
- Storage sağlayıcı ayarları
- FFmpeg yolu / medya işleme ayarları

#### Providers
- OpenAI / ChatGPT provider ayarları
- Transcription provider ayarları
- DeepL provider varsayılanları
- Opsiyonel olarak alternatif sağlayıcılar

---

## 5.2 User Paneli
Önerilen menüler:
- Notlarım
- Paylaşılan Notlar
- Ayarlar
- API Anahtarları
- Kısayollar
- Profil

### Ayarlar Sayfasında
- Tercih edilen dil
- Çeviri dili
- DeepL API key
- OpenAI API key
- Not işleme tercihleri
- Video indirme izni
- Otomatik transkript oluşturma ayarı
- Otomatik özet oluşturma ayarı
- Otomatik kategori oluşturma ayarı

### API Anahtarı Yönetimi
Kullanıcı:
- Yeni API key üretebilir
- Aktif API key listesini görebilir
- Silme / revoke yapabilir
- Son kullanım tarihini görebilir

Not:
- API key tam hali bir kez gösterilmeli
- Sonrasında maskeli gösterilmeli
- DB’de hashlenerek saklanmalı

### Kısayol Oluşturma
Kullanıcıya 2 yöntem sunulabilir:
1. **Hazır iPhone Shortcut import linki**
2. Kullanıcıya özel token içeren **shortcut script / JSON üretimi**

Amaç:
- Paylaş menüsünden gelen veri doğrudan kullanıcının hesabına not olarak düşsün.

---

## 6) Not Türleri

Her not aşağıdaki tiplerden biri olabilir:
- `link`
- `article`
- `video`
- `image`
- `text`
- `mixed`

Sistem ilk kayıtta not tipini tahmin eder, sonra işleyici servis bunu netleştirir.

---

## 7) Not İşleme Akışları

## 7.1 Video Notları
Öncelik verilen platformlar:
- X / Twitter
- Instagram
- YouTube

### Hedef Akış
1. Kullanıcı link paylaşır.
2. Sistem URL türünü tespit eder.
3. Video metadata alınır.
4. Uygunsa video locale indirilir.
5. Ses ayrıştırılır.
6. Transkripsiyon oluşturulur.
7. Kullanıcının seçtiği dile çeviri yapılır.
8. VTT / SRT altyazı oluşturulur.
9. Player içinde video + altyazı gösterilir.

### Kullanıcının Görmesi Gereken Durumlar
Not detay sayfasında adım adım durum görünmelidir:
- Kaydedildi
- Link analiz ediliyor
- Video bulunuyor
- Video indiriliyor
- Ses çıkarılıyor
- Transkript oluşturuluyor
- Çeviri yapılıyor
- Altyazı hazırlanıyor
- Tamamlandı
- Hata oluştu

### Teknik Notlar
- FFmpeg gerekli
- Video indirme için platform uyumluluğu önemli
- Bazı platformlar için doğrudan indirme yerine embed/metadata fallback gerekebilir
- Çok uzun videolarda parça parça transcription yapılmalı
- Telif / erişim / rate limit kuralları ayrıca değerlendirilmeli

### Çıktılar
- Orijinal link
- Video metadata
- Yerel video dosyası veya işlenmiş media kaydı
- Orijinal transkript
- Çevrilmiş transkript
- VTT / SRT dosyası
- Özet
- Ana konu başlıkları

---

## 7.2 Blog / Makale Notları

### Hedef Akış
1. Kullanıcı bir blog linki paylaşır.
2. Sayfa fetch edilir.
3. Readability.js benzeri araçla ana içerik çıkarılır.
4. İçerik temizlenir.
5. AI ile özet üretilir.
6. Kullanıcının seçtiği dile tam çeviri hazırlanır.
7. Not detayında gösterilir.

### Not Detayında Görünmesi Gerekenler
- Başlık
- Kaynak site
- Kapak görseli
- Tahmini okuma süresi
- Kısa özet
- Madde madde ana fikirler
- Tam metin
- Tam çeviri
- Orijinal sayfaya git bağlantısı

### Teknik Notlar
- Önce HTML parse
- Sonra içerik çıkarımı
- Sonra sanitize
- Sonra özet / çeviri
- İçerik cache’lenmeli
- Aynı link ikinci kez işlendiğinde yeniden fetch etmeyip cache kullanılabilir

---

## 7.3 AI ile Kategorilendirme

Her not AI ile otomatik kategorize edilecektir.

Örnek kategoriler:
- İş
- Kişisel
- Haber
- Teknoloji
- Yazılım
- Pazarlama
- Eğitim
- Video
- Sosyal Medya
- İlham
- Araştırma
- Satın Alma

Ek olarak:
- tag üretimi
- kısa konu özeti
- önem puanı
- tekrar ziyaret et önerisi

Kullanıcı ayarlar ekranında kendi OpenAI / ChatGPT API bilgisini yönetebilir.

---

## 7.4 Not Paylaşımı

Kullanıcı bir notunu paylaşmak isterse:
- Not için public paylaşım linki oluşturabilir
- İsterse link korumalı olabilir
- İsterse linki son kullanma tarihli olabilir
- İsterse tek sefer görüntülenebilir olabilir

Paylaşılan notlarda dikkat edilmesi gerekenler:
- Varsayılan olarak tüm notlar private olmalı
- Kullanıcı açıkça paylaş demeden hiçbir not erişilebilir olmamalı
- Paylaşım loglanmalı

---

## 8) Gizlilik ve Yetkilendirme

Temel kural:
**Her kullanıcının notunu yalnızca kendisi görebilir.**

Gereken kurallar:
- Tüm sorgularda `user_id` scope zorunlu
- Admin bile kullanıcı not içeriğine varsayılan olarak erişmemeli; gerekiyorsa denetimli support modu düşünülmeli
- Public paylaşımlar ayrı token ile açılmalı
- Dosya erişimleri signed URL veya access kontrolü ile korunmalı
- API anahtarları şifreli / hashli saklanmalı

---

## 9) Önerilen Teknik Mimari

## 9.1 Frontend
- **Web app**: React + Next.js veya React + Vite
- Admin ve user için ayrı layout
- Mobil uyumlu responsive yapı
- Video player için altyazı desteği

## 9.2 Backend
- **Node.js + Express / NestJS**
- REST API veya kısmen tRPC
- Background jobs için queue sistemi

## 9.3 Veritabanı
- **PostgreSQL** önerilir

## 9.4 Queue / Background Jobs
Gerekli çünkü:
- Video indirme
- Ses çıkarma
- Transkripsiyon
- Çeviri
- Özet
- Kategorileme
- Thumbnail üretimi
- Email gönderimi

Öneri:
- Redis + BullMQ

## 9.5 Storage
- S3 uyumlu object storage
- Medya dosyaları, altyazılar, görseller burada tutulmalı

## 9.6 Medya İşleme
- FFmpeg
- Whisper veya eşdeğer transcription provider
- VTT/SRT üretici servis

---

## 10) Önerilen Veritabanı Modelleri

### users
- id
- email
- role (`admin`, `user`)
- preferred_language
- translation_language
- created_at
- updated_at

### login_codes
- id
- user_id
- code_hash
- expires_at
- consumed_at
- created_at
- ip_address

### user_settings
- id
- user_id
- deepl_api_key_encrypted
- openai_api_key_encrypted
- auto_summarize
- auto_translate
- auto_transcribe
- auto_categorize
- shortcut_token_hash
- created_at
- updated_at

### api_keys
- id
- user_id
- name
- key_hash
- last_used_at
- revoked_at
- created_at

### notes
- id
- user_id
- type
- source_url
- original_text
- title
- status
- visibility (`private`, `public`)
- public_token
- language_detected
- category
- summary
- translated_text
- metadata_json
- created_at
- updated_at

### note_media
- id
- note_id
- media_type
- storage_path
- mime_type
- duration
- size
- created_at

### transcripts
- id
- note_id
- language
- transcript_text
- translated_text
- subtitle_vtt_path
- subtitle_srt_path
- created_at

### note_jobs
- id
- note_id
- job_type
- status
- progress
- message
- started_at
- finished_at
- error_text

### shares
- id
- note_id
- created_by_user_id
- token
- expires_at
- password_hash
- max_views
- current_views
- created_at

### system_settings
- id
- smtp_host
- smtp_port
- smtp_username
- smtp_password_encrypted
- smtp_from_name
- smtp_from_email
- created_at
- updated_at

---

## 11) API Taslakları

### Auth
- `POST /api/auth/request-code`
- `POST /api/auth/verify-code`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### User Settings
- `GET /api/settings`
- `PUT /api/settings`

### API Keys
- `GET /api/api-keys`
- `POST /api/api-keys`
- `DELETE /api/api-keys/:id`

### Notes
- `GET /api/notes`
- `POST /api/notes`
- `GET /api/notes/:id`
- `DELETE /api/notes/:id`
- `POST /api/notes/:id/reprocess`
- `POST /api/notes/:id/share`
- `DELETE /api/notes/:id/share`

### Shortcut Ingestion
- `POST /api/ingest/share`
- `POST /api/ingest/text`
- `POST /api/ingest/link`
- `POST /api/ingest/image`

### Admin
- `GET /api/admin/users`
- `GET /api/admin/system-settings`
- `PUT /api/admin/system-settings`
- `GET /api/admin/jobs`
- `GET /api/admin/logs`
- `POST /api/admin/test-email`

---

## 12) iPhone Kısayol Mantığı

Amaç:
Kullanıcı iPhone paylaşım ekranından veriyi uygulamaya tek hamlede gönderebilsin.

### Olası Yaklaşım
- Kullanıcıya özel bir ingestion endpoint verilir.
- Shortcut, paylaşılan içeriği bu endpoint’e gönderir.
- Kimlik doğrulama için user token veya API key kullanılır.

### Shortcut’ın Gönderebileceği Alanlar
- URL
- Başlık
- Seçili metin
- Açıklama
- Görsel dosyası
- Kaynak uygulama

### Kullanıcı Deneyimi
Ayarlar ekranında:
- “Shortcut Oluştur” butonu
- “Kopyala”
- “iPhone’da aç”
- “Kurulum adımları”

---

## 13) Not Durum Makinesi

Önerilen `note.status` değerleri:
- `pending`
- `analyzing`
- `queued`
- `downloading`
- `extracting`
- `transcribing`
- `translating`
- `summarizing`
- `categorizing`
- `ready`
- `failed`

Bu yapı hem UI’da durum göstermek hem de job yönetmek için çok faydalı olur.

---

## 14) MVP Kapsamı

İlk versiyonda şu kapsam önerilir:

### MVP v1
- Email magic code ile login
- Admin panelinde SMTP ayarları
- User paneli
- Not ekleme: link + metin
- iPhone shortcut ile link gönderme
- Kullanıcının sadece kendi notlarını görmesi
- Makale içeriği çıkarımı
- AI ile özet
- AI ile kategori
- Basit paylaşım linki

### v1.5
- Full text translation
- API key yönetimi
- DeepL entegrasyonu
- Gelişmiş arama ve filtre
- Tag sistemi

### v2
- Video indirme
- Transcription
- Subtitle üretimi
- Video player
- İşlem durum ekranı

### v2.5
- Görsel OCR
- Sesli not desteği
- Browser extension
- Android share target

---

## 15) Riskler ve Dikkat Edilecek Noktalar

### Teknik Riskler
- Instagram / X / YouTube içerik indirme tarafı değişken olabilir
- Telif / erişim / rate limit problemleri yaşanabilir
- Uzun videolar maliyetli olabilir
- Çeviri ve transcription maliyetleri kullanıcı bazlı izlenmeli

### Ürün Riskleri
- Fazla karmaşık ilk sürüm kullanıcıyı yorabilir
- Önce en çok kullanılan akışa odaklanmak gerekir
- İlk sürümde “link kaydet + özet + çeviri + kategori” odaklı gitmek daha sağlıklı olabilir

---

## 16) Benim Ek Önerilerim

Senin maddelerine ek olarak bence şunlar çok faydalı olur:

### 16.1 Inbox / Quick Capture Mantığı
Kullanıcının gelen her şeyi önce bir “Inbox” listesine düşsün.
Sonra isterse kategorilendirsin, arşivlesin, favorilesin.

### 16.2 Favori / Sonra Bak
Notlara:
- favori
- daha sonra bak
- arşivlendi
- işlendi
etiketleri verilebilir.

### 16.3 Arama ve Filtre
Aşağıdaki filtreler çok önemli olur:
- not tipi
- kategori
- tarih
- dil
- hazır / işleniyor / hata
- paylaşılan / özel

### 16.4 Tekrar İşle Butonu
Bir not hata aldıysa kullanıcı “yeniden işle” diyebilmeli.

### 16.5 Maliyet Takibi
Özellikle video ve AI işlemleri için kullanıcı bazlı kullanım takibi çok faydalı olur:
- bu ay kaç not işlendi
- kaç transkripsiyon yapıldı
- tahmini maliyet

### 16.6 Browser Extension
İleride masaüstü için Chrome extension çok mantıklı olur.
Mobil share mantığının desktop karşılığı gibi çalışır.

### 16.7 Webhook / Zapier / Make
İleri aşamada kullanıcı notlarını başka sistemlere akıtmak isteyebilir.

### 16.8 OCR
Görsel içindeki yazıları çıkarma özelliği çok değerli olur.
Özellikle ekran görüntüleri için.

### 16.9 Email’e Göndererek Not Alma
Kullanıcıya özel email adresi verilebilir:
- `abc123@notal.app`
Gönderilen içerikler not olarak düşer.

### 16.10 Daily / Weekly Digest
Sistemde biriken notların haftalık özeti çok güzel bir premium özellik olabilir.

---

## 17) Önerilen Teknoloji Stack

### Seçenek A – Hızlı ve Pratik
- Next.js
- PostgreSQL
- Prisma
- Redis
- BullMQ
- S3 storage
- FFmpeg
- OpenAI / DeepL

### Seçenek B – Daha Kurumsal
- NestJS
- PostgreSQL
- Prisma veya TypeORM
- Redis
- BullMQ
- S3 storage
- FFmpeg
- OpenAI / DeepL

Ben olsam bu projeyi başlangıç için şu şekilde kurardım:
- **Frontend + backend aynı repo:** Next.js
- **DB:** PostgreSQL
- **Queue:** Redis + BullMQ
- **Storage:** S3 uyumlu servis
- **ORM:** Prisma

---

## 18) Klasör Yapısı Önerisi

```bash
/apps
  /web
  /worker
/packages
  /ui
  /db
  /config
  /types
```

Daha basit tek repo başlangıcı:

```bash
/src
  /app
  /components
  /lib
  /server
  /jobs
  /providers
  /modules
    /auth
    /notes
    /users
    /settings
    /shares
    /admin
/prisma
/public
```

---

## 19) İlk Sprint Önerisi

### Sprint 1
- Proje kurulumu
- Kullanıcı modeli
- Email login
- SMTP admin ayarı
- Session yapısı
- Basit user dashboard

### Sprint 2
- Not oluşturma
- Not listeleme
- Makale çıkarımı
- Özetleme
- Kategori üretme

### Sprint 3
- User settings
- API key yönetimi
- iPhone shortcut endpoint
- Paylaşım özelliği

### Sprint 4
- Queue sistemi
- Job durum ekranı
- Video pipeline başlangıcı

---

## 20) Sonuç

Bu proje, basit bir “not alma” uygulamasından daha çok, **kişisel içerik toplama ve anlamlandırma platformu** olabilir.

Doğru başlangıç için en kritik öneri:
**İlk sürümde video işleme ile boğulmadan, önce link/makale/metin odaklı sağlam bir MVP çıkarmak.**

En mantıklı sıralama:
1. Login
2. Not kaydetme
3. Makale çıkarımı
4. Özet
5. Çeviri
6. Kategori
7. Paylaşım
8. Video pipeline

---

## 21) Kısa Ürün Cümlesi

**Not Al, mobilde gezerken karşılaştığın içerikleri tek dokunuşla kaydedip; daha sonra özet, çeviri, transkript ve akıllı kategorilerle sana geri sunan kişisel bilgi toplama uygulamasıdır.**

