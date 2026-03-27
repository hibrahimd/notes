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
  const [downloading, setDownloading] = useState(false);

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

  async function downloadShortcut() {
    if (!token && !hasToken) {
      alert("Önce bir token oluşturun");
      return;
    }
    setDownloading(true);
    try {
      const res = await fetch("/api/shortcut/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token || "TOKEN_PLACEHOLDER" }),
      });
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Notlarima-Ekle.shortcut";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Download error:", error);
      alert("İndirme hatası oluştu");
    }
    setDownloading(false);
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

      {/* Token Management - FIRST */}
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

      {/* iPhone Shortcut - SECOND */}
      <Card className="mb-6">
        <div className="flex items-start gap-4">
          <Smartphone size={24} className="text-zinc-400 mt-1 shrink-0" />
          <div className="flex-1">
            <CardTitle>iPhone Kısayolu</CardTitle>
            <CardDescription className="mt-1 mb-3">
              iPhone paylaşım menüsünden içeriklerinizi doğrudan Not Al&apos;a gönderebilirsiniz.
              Herhangi bir uygulamadan paylaş butonuna basıp &quot;Notlarıma Ekle&quot; kısayolunu seçmeniz yeterli.
            </CardDescription>
            {(token || hasToken) && (
              <div className="flex gap-2">
                <Button onClick={downloadShortcut} loading={downloading} size="sm">
                  <Smartphone size={16} /> Kısayolu İndir
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const currentToken = token || "TOKEN_PLACEHOLDER";
                    const shortcutUrl = `${window.location.origin}/api/shortcut/download?token=${encodeURIComponent(currentToken)}`;
                    const whatsappText = `Not Al kısayolunu iPhone'una indir:
${shortcutUrl}

Tıklayarak direkt indirebilirsin!`;
                    window.open(`https://wa.me/?text=${encodeURIComponent(whatsappText)}`, "_blank");
                  }}
                >
                  WhatsApp ile Paylaş
                </Button>
              </div>
            )}
          </div>
        </div>
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

    </>
  );
}
