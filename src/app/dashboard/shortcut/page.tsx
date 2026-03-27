"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle, CardDescription } from "@/components/ui/card";
import { Copy, Check, RefreshCw, Trash2, Smartphone, ExternalLink } from "lucide-react";

export default function ShortcutPage() {
  const [token, setToken] = useState<string | null>(null);
  const [hasToken, setHasToken] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        setHasToken(!!data.settings?.shortcutTokenHash);
        setLoading(false);
      });
  }, []);

  async function generateToken() {
    setGenerating(true);
    const res = await fetch("/api/settings/shortcut-token", { method: "POST" });
    const data = await res.json();
    setToken(data.token);
    setHasToken(true);
    setGenerating(false);
  }

  async function deleteToken() {
    if (!confirm("Mevcut token'ı silmek istediğinize emin misiniz? Kısayolunuz çalışmayı durduracaktır.")) return;
    await fetch("/api/settings/shortcut-token", { method: "DELETE" });
    setToken(null);
    setHasToken(false);
  }

  function copyText(text: string, label: string) {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  }

  if (loading) return <div className="text-zinc-400">Yükleniyor...</div>;

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const ingestUrl = `${baseUrl}/api/ingest`;
  const tokenDisplay = token || "TOKEN_BURAYA_YAPISTIRIN";

  const curlExample = `curl -X POST ${ingestUrl} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${tokenDisplay}" \\
  -d '{"url": "https://ornek.com/makale", "source": "iphone-shortcut"}'`;

  return (
    <>
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">Kısayollar</h1>

      <Card className="mb-6">
        <div className="flex items-start gap-4">
          <Smartphone size={24} className="text-zinc-400 mt-1 shrink-0" />
          <div>
            <CardTitle>iPhone Kısayolu</CardTitle>
            <CardDescription className="mt-1">
              iPhone paylaşım menüsünden içeriklerinizi doğrudan Not Al&apos;a gönderebilirsiniz.
              Herhangi bir uygulamadan paylaş butonuna basıp &quot;Notlarıma Ekle&quot; kısayolunu seçmeniz yeterli.
            </CardDescription>
          </div>
        </div>
      </Card>

      {/* Token Management */}
      <Card className="mb-6">
        <CardTitle>API Token</CardTitle>
        <p className="text-sm text-zinc-500 mt-1 mb-4">
          Kısayolunuzun sisteme erişebilmesi için bir token gereklidir. Token oluşturup kısayolunuza yapıştırın.
        </p>

        {token && (
          <div className="mb-4 p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
            <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium mb-2">
              Token oluşturuldu! Bu token&apos;ı kaydedin, tekrar gösterilmeyecektir.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-sm bg-white dark:bg-zinc-800 px-3 py-2 rounded-lg text-zinc-800 dark:text-zinc-200 break-all">
                {token}
              </code>
              <Button variant="outline" size="sm" onClick={() => copyText(token, "token")}>
                {copied === "token" ? <Check size={16} /> : <Copy size={16} />}
              </Button>
            </div>
          </div>
        )}

        <div className="flex gap-3">
          {hasToken ? (
            <>
              <Button variant="outline" onClick={generateToken} loading={generating}>
                <RefreshCw size={16} /> Yeniden Oluştur
              </Button>
              <Button variant="danger" onClick={deleteToken}>
                <Trash2 size={16} /> Token Sil
              </Button>
            </>
          ) : (
            <Button onClick={generateToken} loading={generating}>
              Token Oluştur
            </Button>
          )}
        </div>
      </Card>

      {/* iOS Shortcut Setup */}
      <Card className="mb-6">
        <CardTitle>iOS Kısayol Kurulumu</CardTitle>
        <p className="text-sm text-zinc-500 mt-2 mb-4">
          Aşağıdaki adımları iPhone&apos;unuzdaki <strong>Kısayollar</strong> uygulamasında uygulayın.
        </p>
        <ol className="space-y-5 text-sm text-zinc-700 dark:text-zinc-300">
          <li className="flex gap-3">
            <span className="w-6 h-6 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">1</span>
            <div>
              <strong>Yeni kısayol oluşturun</strong> ve adını <code className="bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-xs">Notlarıma Ekle</code> yapın.
              Kısayol ayarlarından <strong>&quot;Paylaşım Sayfasında Göster&quot;</strong> seçeneğini aktifleştirin.
            </div>
          </li>
          <li className="flex gap-3">
            <span className="w-6 h-6 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">2</span>
            <div>
              <strong>&quot;Kestirme Girişi&quot;</strong> aksiyonu ekleyin → Girişten <strong>URL&apos;leri al</strong> seçin.
            </div>
          </li>
          <li className="flex gap-3">
            <span className="w-6 h-6 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">3</span>
            <div>
              <strong>&quot;Liste&quot;</strong> aksiyonu ekleyin. Öğe olarak şunları girin:
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded text-xs font-medium">Oku</span>
                <span className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded text-xs font-medium">İncele</span>
                <span className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded text-xs font-medium">İzle</span>
              </div>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="w-6 h-6 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">4</span>
            <div>
              <strong>&quot;Listeden Seç&quot;</strong> aksiyonu ekleyin → Girişi <strong>Liste</strong> olarak ayarlayın.
            </div>
          </li>
          <li className="flex gap-3">
            <span className="w-6 h-6 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">5</span>
            <div>
              <strong>&quot;URL İçeriğini Al&quot;</strong> aksiyonu ekleyin ve şu ayarları yapın:
              <div className="mt-2 space-y-2 bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500">URL:</span>
                  <div className="flex items-center gap-1">
                    <code className="text-xs bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded break-all">{ingestUrl}</code>
                    <Button variant="ghost" size="sm" onClick={() => copyText(ingestUrl, "url")} className="shrink-0">
                      {copied === "url" ? <Check size={14} /> : <Copy size={14} />}
                    </Button>
                  </div>
                </div>
                <div className="flex justify-between"><span className="text-zinc-500">Yöntem:</span><code className="text-xs">POST</code></div>
                <div className="flex justify-between"><span className="text-zinc-500">Gövde:</span><code className="text-xs">JSON</code></div>
                <div className="border-t border-zinc-200 dark:border-zinc-700 pt-2 mt-2">
                  <p className="text-xs text-zinc-500 mb-1 font-medium">Başlık Ekle:</p>
                  <div className="flex justify-between items-center">
                    <code className="text-xs">Authorization</code>
                    <div className="flex items-center gap-1">
                      <code className="text-xs bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded">Bearer {token ? token.slice(0, 8) + "..." : "TOKEN"}</code>
                      {token && (
                        <Button variant="ghost" size="sm" onClick={() => copyText(`Bearer ${token}`, "bearer")} className="shrink-0">
                          {copied === "bearer" ? <Check size={14} /> : <Copy size={14} />}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="border-t border-zinc-200 dark:border-zinc-700 pt-2 mt-2">
                  <p className="text-xs text-zinc-500 mb-1 font-medium">JSON Gövdesi:</p>
                  <div className="space-y-1">
                    <div className="flex justify-between"><code className="text-xs">url</code><code className="text-xs text-blue-500">Kestirme Girişi</code></div>
                    <div className="flex justify-between"><code className="text-xs">source</code><code className="text-xs text-blue-500">Seçilen Öğe</code></div>
                  </div>
                </div>
              </div>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="w-6 h-6 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">6</span>
            <div>
              <strong>&quot;Eğer&quot;</strong> aksiyonu ekleyin → API Sonucu girişindeki <code className="bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-xs">success</code> değerini kontrol edin.
              <ul className="mt-1 ml-4 space-y-1 list-disc text-zinc-500">
                <li><strong>Eğer başarılı:</strong> Bildirim göster → &quot;Merhaba dünya!&quot; (veya &quot;Not kaydedildi!&quot;)</li>
                <li><strong>Aksi halde:</strong> Bildirim göster → Hata mesajını göster</li>
              </ul>
            </div>
          </li>
        </ol>
      </Card>

      {/* API Test */}
      <Card className="mb-6">
        <CardTitle>API Testi (curl)</CardTitle>
        <p className="text-sm text-zinc-500 mt-1 mb-3">
          Terminal&apos;den test etmek için aşağıdaki komutu kullanabilirsiniz:
        </p>
        <div className="relative">
          <pre className="text-xs bg-zinc-100 dark:bg-zinc-800 px-4 py-3 rounded-lg overflow-x-auto text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap break-all">
            {curlExample}
          </pre>
          <Button
            variant="ghost"
            size="sm"
            className="absolute top-2 right-2"
            onClick={() => copyText(curlExample, "curl")}
          >
            {copied === "curl" ? <Check size={14} /> : <Copy size={14} />}
          </Button>
        </div>
      </Card>

      {/* Help */}
      <Card>
        <CardTitle>Yardım</CardTitle>
        <div className="mt-3 text-sm text-zinc-600 dark:text-zinc-400 space-y-2">
          <p>
            <strong>API Anahtarları</strong> sayfasından oluşturulan anahtarlar da bu API ile çalışır.
            Kısayol token&apos;ı yalnızca iOS kısayolları için önerilir.
          </p>
          <p>
            Kısayolunuz çalışmıyorsa token&apos;ı yeniden oluşturup kısayola yapıştırın.
          </p>
          <a
            href="https://support.apple.com/tr-tr/guide/shortcuts/apd735880972/ios"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline"
          >
            <ExternalLink size={14} /> Apple Kısayollar Rehberi
          </a>
        </div>
      </Card>
    </>
  );
}
