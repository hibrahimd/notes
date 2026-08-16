# Not Al — Tarayıcı Eklentisi

Sağ tık menüsünden sayfayı, linki, görseli veya seçili metni Not Al'a
kaydeder. Kısayolla aynı uç noktayı (`/api/ingest`) ve aynı token'ı kullanır.

## Klasörler

- `firefox/` — Firefox eklentisi (Manifest V3)

## Yerelde deneme

Firefox'ta `about:debugging#/runtime/this-firefox` → **Geçici Eklenti Yükle**
→ `firefox/manifest.json` dosyasını seç. Firefox kapanınca eklenti kalkar.

Arka plan betiğinin günlüğünü aynı sayfadaki **İncele** düğmesinden görürsün.

## Paketleme

```bash
npm run ext:build
```

`dist/notal-firefox-<sürüm>.zip` üretir. Zip'in **kökünde** `manifest.json`
bulunmalı; AMO klasör içine gömülmüş paketleri reddediyor.

## AMO'ya yükleme

1. https://addons.mozilla.org/developers/addon/submit/distribution
2. Dağıtım: **On this site** (herkese açık) veya **On your own** (yalnızca
   kendin kullanacaksan; imzalı XPI indirip kurarsın, inceleme beklemezsin)
3. Zip'i yükle
4. Kaynak kodu isterse: eklenti derlenmiş/küçültülmüş değil, "hayır" denir
5. Sürüm notu ve gizlilik bilgisi doldurulur

Sürüm yükseltirken `firefox/manifest.json` içindeki `version` artırılmalı;
AMO aynı sürümü ikinci kez kabul etmiyor.

## Token

Eklenti ayarlarında **Oturumdan Al** düğmesi, tarayıcıda Not Al'a giriş
yapılmışsa token'ı kendiliğinden çeker. Yapılmamışsa Mobil Kurulum
sayfasındaki token elle yapıştırılır.

Token `storage.sync` içinde tutulur: Firefox hesabıyla eşitlenen
cihazlarda kurulum bir kez yapılır.
