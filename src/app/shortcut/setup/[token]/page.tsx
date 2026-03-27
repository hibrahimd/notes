import { headers } from "next/headers";
import { redirect } from "next/navigation";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function ShortcutSetupPage({ params }: Props) {
  const { token } = await params;
  const headersList = await headers();
  const host = headersList.get("host") || "notes.kronomondo.org";
  const protocol = host.includes("localhost") ? "http" : "https";

  const downloadUrl = `${protocol}://${host}/api/shortcut/${token}`;
  const importUrl = `shortcuts://import-shortcut?url=${encodeURIComponent(downloadUrl)}&name=Notlarima-Ekle`;

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
            padding: 40px 32px;
            max-width: 400px;
            width: 100%;
            text-align: center;
            box-shadow: 0 4px 24px rgba(0,0,0,0.08);
          }
          .icon {
            font-size: 64px;
            margin-bottom: 20px;
            display: block;
          }
          h1 {
            font-size: 24px;
            font-weight: 700;
            color: #1d1d1f;
            margin-bottom: 12px;
          }
          p {
            font-size: 15px;
            color: #6e6e73;
            line-height: 1.5;
            margin-bottom: 32px;
          }
          .btn {
            display: inline-block;
            background: #0071e3;
            color: white;
            font-size: 17px;
            font-weight: 600;
            text-decoration: none;
            padding: 16px 32px;
            border-radius: 14px;
            width: 100%;
            transition: background 0.2s;
          }
          .btn:hover { background: #0077ed; }
          .note {
            font-size: 13px;
            color: #aeaeb2;
            margin-top: 20px;
            margin-bottom: 0;
          }
        `}</style>
      </head>
      <body>
        <div className="card">
          <span className="icon">📋</span>
          <h1>Notlarıma Ekle</h1>
          <p>
            iPhone paylaşım menüsünden istediğiniz içeriği Not Al&apos;a
            göndermek için bu kısayolu kurun.
          </p>
          <a href={importUrl} className="btn">
            Kısayolu Kur
          </a>
          <p className="note">
            Butona iPhone&apos;dan Safari ile tıklayın.
            <br />
            Kısayollar uygulaması açılacaktır.
          </p>
        </div>
      </body>
    </html>
  );
}
