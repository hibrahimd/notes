interface Props {
  params: Promise<{ token: string }>;
}

// Imzali kisayol /public/shortcut.shortcut altinda durur.
// Yeniden uretmek icin:
//   shortcuts sign -i public/shortcut-template.shortcut -o public/shortcut.shortcut -m anyone
//
// iOS 15'ten beri "Guvenilmeyen Kisayollara Izin Ver" ayari yok ve ice
// aktarilan kisayolun imzali olmasi zorunlu; imzasiz dosya kurulamaz.
const SHORTCUT_FILE_URL = "https://notes.kronomondo.org/shortcut.shortcut";

// url parametresi yuzde kodlanmali; kodlanmadan yazildiginda icindeki "://"
// yuzunden iOS "Girilen kestirme URL'si gecersiz" diyor.
const SHORTCUT_INSTALL_URL =
  "shortcuts://import-shortcut?url=" +
  encodeURIComponent(SHORTCUT_FILE_URL) +
  "&name=" +
  encodeURIComponent("Notlarima-Ekle");

export default async function ShortcutSetupPage({ params }: Props) {
  const { token } = await params;

  return (
    <html lang="tr">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Notlarıma Ekle — Kısayol Kurulumu</title>
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            background: #f5f5f7;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
          }
          .card {
            background: white;
            border-radius: 20px;
            padding: 36px 28px;
            max-width: 420px;
            width: 100%;
            box-shadow: 0 4px 24px rgba(0,0,0,0.08);
          }
          .icon { font-size: 52px; display: block; text-align: center; margin-bottom: 16px; }
          h1 {
            font-size: 22px;
            font-weight: 700;
            color: #1d1d1f;
            margin-bottom: 6px;
            text-align: center;
          }
          .subtitle {
            font-size: 14px;
            color: #6e6e73;
            text-align: center;
            margin-bottom: 28px;
          }
          .step {
            display: flex;
            gap: 14px;
            align-items: flex-start;
            margin-bottom: 20px;
          }
          .step-num {
            background: #0071e3;
            color: white;
            font-size: 13px;
            font-weight: 700;
            width: 26px;
            height: 26px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            margin-top: 2px;
          }
          .step-body { flex: 1; }
          .step-title { font-size: 15px; font-weight: 600; color: #1d1d1f; margin-bottom: 4px; }
          .step-desc { font-size: 13px; color: #6e6e73; line-height: 1.5; }
          .token-box {
            background: #f5f5f7;
            border: 1px solid #e5e5ea;
            border-radius: 10px;
            padding: 10px 14px;
            font-family: monospace;
            font-size: 13px;
            color: #1d1d1f;
            word-break: break-all;
            margin-top: 8px;
            cursor: pointer;
            position: relative;
          }
          .token-box:active { background: #e8e8ed; }
          .copy-hint { font-size: 11px; color: #aeaeb2; margin-top: 4px; }
          .divider { border: none; border-top: 1px solid #f0f0f0; margin: 20px 0; }
          .btn {
            display: block;
            background: #0071e3;
            color: white;
            font-size: 17px;
            font-weight: 600;
            text-decoration: none;
            padding: 15px;
            border-radius: 14px;
            text-align: center;
            margin-top: 8px;
          }
          .btn:hover { background: #0077ed; }
          .note { font-size: 12px; color: #aeaeb2; text-align: center; margin-top: 12px; line-height: 1.5; }
        `}</style>
        <script dangerouslySetInnerHTML={{ __html: `
          var TOKEN = ${JSON.stringify(token)};
          var INSTALL_URL = ${JSON.stringify(SHORTCUT_INSTALL_URL)};

          function copyToken() {
            return navigator.clipboard.writeText(TOKEN).then(function() {
              var el = document.getElementById('copy-hint');
              el.textContent = '\u2705 Kopyaland\u0131!';
              setTimeout(function() { el.textContent = 'Kopyalamak i\u00e7in dokun'; }, 2000);
            });
          }

          // Indirme baslamadan once token panoya yazilir; import ekrani
          // sordugunda hazir olsun. Indirmeyi engellemeyiz, sadece isaretleriz.
          function markCopied() {
            var el = document.getElementById('copy-hint');
            el.textContent = '✅ Token panoya kopyalandı';
          }

          function onDownload() {
            if (navigator.clipboard) {
              navigator.clipboard.writeText(TOKEN).then(markCopied, function(){});
            }
          }

          function openInShortcuts(e) {
            e.preventDefault();
            var go = function() { window.location.href = INSTALL_URL; };
            if (navigator.clipboard) {
              navigator.clipboard.writeText(TOKEN).then(function() { markCopied(); go(); }, go);
            } else {
              go();
            }
          }

          document.addEventListener('DOMContentLoaded', function() {
            document.getElementById('token-box').addEventListener('click', copyToken);
            document.getElementById('download-btn').addEventListener('click', onDownload);
            document.getElementById('install-btn').addEventListener('click', openInShortcuts);
          });
        `}} />
      </head>
      <body>
        <div className="card">
          <span className="icon">📋</span>
          <h1>Notlarıma Ekle</h1>
          <p className="subtitle">iPhone paylaşım menüsünden Not Al&apos;a not gönderin</p>

          <div className="step">
            <div className="step-num">1</div>
            <div className="step-body">
              <div className="step-title">Kısayolu indirin</div>
              <div className="step-desc">
                Aşağıdaki butona basın. Safari dosyayı indirir ve token&apos;ınız
                aynı anda panoya kopyalanır.
              </div>
            </div>
          </div>

          <div className="step">
            <div className="step-num">2</div>
            <div className="step-body">
              <div className="step-title">İndirilen dosyaya dokunun</div>
              <div className="step-desc">
                Safari&apos;de sağ üstteki <b>indirmeler</b> simgesine basıp
                <b> Notlarima-Ekle.shortcut</b> dosyasına dokunun. Kısayollar
                uygulaması açılacak.
              </div>
            </div>
          </div>

          <div className="step">
            <div className="step-num">3</div>
            <div className="step-body">
              <div className="step-title">Token&apos;ı yapıştırın</div>
              <div className="step-desc">
                &quot;API Token&apos;ınızı girin&quot; alanına uzun basıp
                <b> Yapıştır</b> deyin, sonra <b>Kısayolu Ekle</b>.
              </div>
            </div>
          </div>

          <a href={SHORTCUT_FILE_URL} className="btn" id="download-btn" download>
            Kısayolu İndir
          </a>
          <p className="note">iPhone&apos;dan Safari ile açın.</p>

          <hr className="divider" />

          <div className="step-desc" style={{ marginBottom: 10 }}>
            Alternatif: Kısayollar uygulamasını doğrudan açmayı deneyin.
          </div>
          <a href={SHORTCUT_INSTALL_URL} className="btn" id="install-btn" style={{ background: "#6e6e73" }}>
            Kısayollar&apos;da Aç
          </a>

          <div className="copy-hint" id="copy-hint" style={{ marginTop: 14 }}>Kopyalamak için dokun</div>
          <div className="token-box" id="token-box">{token}</div>
        </div>
      </body>
    </html>
  );
}
