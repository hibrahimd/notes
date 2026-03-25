"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle, CardDescription } from "@/components/ui/card";
import { Copy, Check, RefreshCw, Trash2, Smartphone } from "lucide-react";

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

  const shortcutScript = `{
  "url": "${ingestUrl}",
  "method": "POST",
  "headers": {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_TOKEN_HERE"
  },
  "body": {
    "url": "[Shortcut Input URL]",
    "text": "[Shortcut Input Text]",
    "title": "[Shortcut Input Title]",
    "source": "iphone-shortcut"
  }
}`;

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
            </CardDescription>
          </div>
        </div>
      </Card>

      {/* Token Management */}
      <Card className="mb-6">
        <CardTitle>API Token</CardTitle>
        <p className="text-sm text-zinc-500 mt-1 mb-4">
          Kısayolunuzun sisteme erişebilmesi için bir token gereklidir.
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

      {/* Setup Instructions */}
      <Card className="mb-6">
        <CardTitle>Kurulum Adımları</CardTitle>
        <ol className="mt-4 space-y-4 text-sm text-zinc-700 dark:text-zinc-300">
          <li className="flex gap-3">
            <span className="w-6 h-6 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-full flex items-center justify-center text-xs font-bold shrink-0">1</span>
            <span>Yukarıdan bir API token oluşturun ve kaydedin.</span>
          </li>
          <li className="flex gap-3">
            <span className="w-6 h-6 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-full flex items-center justify-center text-xs font-bold shrink-0">2</span>
            <span>iPhone&apos;da <strong>Kısayollar</strong> uygulamasını açın.</span>
          </li>
          <li className="flex gap-3">
            <span className="w-6 h-6 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-full flex items-center justify-center text-xs font-bold shrink-0">3</span>
            <span>Yeni bir kısayol oluşturun ve &quot;Paylaşım Sayfasında Göster&quot; seçeneğini aktifleştirin.</span>
          </li>
          <li className="flex gap-3">
            <span className="w-6 h-6 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-full flex items-center justify-center text-xs font-bold shrink-0">4</span>
            <span>&quot;URL İçeriğini Al&quot; aksiyonu ekleyin ve aşağıdaki ayarları yapın:</span>
          </li>
        </ol>
      </Card>

      {/* API Endpoint Info */}
      <Card className="mb-6">
        <CardTitle>API Bilgileri</CardTitle>
        <div className="mt-4 space-y-3">
          <div>
            <p className="text-xs font-medium text-zinc-500 uppercase mb-1">Endpoint</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-sm bg-zinc-100 dark:bg-zinc-800 px-3 py-2 rounded-lg">{ingestUrl}</code>
              <Button variant="outline" size="sm" onClick={() => copyText(ingestUrl, "url")}>
                {copied === "url" ? <Check size={16} /> : <Copy size={16} />}
              </Button>
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-zinc-500 uppercase mb-1">İstek Yapısı</p>
            <div className="relative">
              <pre className="text-sm bg-zinc-100 dark:bg-zinc-800 px-4 py-3 rounded-lg overflow-x-auto text-zinc-700 dark:text-zinc-300">
                {shortcutScript}
              </pre>
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-2 right-2"
                onClick={() => copyText(shortcutScript, "script")}
              >
                {copied === "script" ? <Check size={16} /> : <Copy size={16} />}
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </>
  );
}
