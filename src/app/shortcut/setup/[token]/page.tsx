interface Props {
  params: Promise<{ token: string }>;
}

// Signed shortcut served from /public/shortcut.shortcut
// To regenerate: shortcuts sign -i public/shortcut-template.shortcut -o public/shortcut.shortcut -m anyone
const SHORTCUT_INSTALL_URL =
  "shortcuts://import-shortcut?url=https://notes.kronomondo.org/shortcut.shortcut&name=Notlarima-Ekle";

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

          // Kurulum tek dokunus: once token panoya yazilir, sonra Kisayollar
          // acilir. Import ekraninda tek yapmasi gereken yapistirmak.
          function installShortcut(e) {
            e.preventDefault();
            var btn = document.getElementById('install-btn');
            btn.textContent = 'Token kopyalandi, aciliyor...';
            var go = function() { window.location.href = INSTALL_URL; };
            if (navigator.clipboard) {
              navigator.clipboard.writeText(TOKEN).then(go, go);
            } else {
              go();
            }
          }

          // Token gomulu (imzasiz) surum: yapistirma adimi yok
          function directInstall(e) {
            e.preventDefault();
            var url = window.location.origin + '/api/shortcut/' + encodeURIComponent(TOKEN);
            window.location.href = 'shortcuts://import-shortcut?url=' +
              encodeURIComponent(url) + '&name=Notlarima-Ekle';
          }

          document.addEventListener('DOMContentLoaded', function() {
            document.getElementById('token-box').addEventListener('click', copyToken);
            document.getElementById('install-btn').addEventListener('click', installShortcut);
            document.getElementById('direct-install-btn').addEventListener('click', directInstall);
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
              <div className="step-title">Bir kez ayarı açın</div>
              <div className="step-desc">
                <b>Ayarlar → Kısayollar → Güvenilmeyen Kısayollara İzin Ver</b>.
                Bu açık değilse iPhone token&apos;ı gömülü kısayolu reddeder.
              </div>
            </div>
          </div>

          <div className="step">
            <div className="step-num">2</div>
            <div className="step-body">
              <div className="step-title">Butona basın, bitti</div>
              <div className="step-desc">
                Token kısayolun içine gömülüdür; hiçbir şey yapıştırmanız
                gerekmez. Kısayollar açılır, <b>Kısayolu Ekle</b> deyip çıkarsınız.
              </div>
            </div>
          </div>

          <a href="#" className="btn" id="direct-install-btn">
            Tek Dokunuşla Kur
          </a>
          <p className="note">iPhone&apos;dan Safari ile açın.</p>

          <hr className="divider" />

          <div className="step-title" style={{ fontSize: 14 }}>Çalışmazsa: imzalı sürüm</div>
          <div className="step-desc" style={{ marginBottom: 10 }}>
            Yukarıdaki ayarı açmak istemiyorsanız bu sürümü kullanın. Butona
            bastığınızda token panoya kopyalanır; Kısayollar sorduğunda alana
            uzun basıp <b>Yapıştır</b> deyin.
          </div>
          <a href={SHORTCUT_INSTALL_URL} className="btn" id="install-btn" style={{ background: "#6e6e73" }}>
            İmzalı Sürümü Kur
          </a>

          <div className="copy-hint" id="copy-hint" style={{ marginTop: 14 }}>Kopyalamak için dokun</div>
          <div className="token-box" id="token-box">{token}</div>
        </div>
      </body>
    </html>
  );
}
