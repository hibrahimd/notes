"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle, CardDescription } from "@/components/ui/card";
import { Copy, Check, RefreshCw, Trash2, Smartphone } from "lucide-react";

export default function ShortcutPage() {
  const [token, setToken] = useState<string | null>(null);
  const [hasToken, setHasToken] = useState(false);
  const [needsRegenerate, setNeedsRegenerate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  // Token sunucudan okunur; boylece kurulumu hangi cihazdan yaparsaniz yapin
  // butonlar calisir
  useEffect(() => {
    fetch("/api/settings/shortcut-token")
      .then((r) => r.json())
      .then((data) => {
        setToken(data.token ?? null);
        setHasToken(Boolean(data.hasToken));
        setNeedsRegenerate(Boolean(data.needsRegenerate));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function generateToken() {
    setGenerating(true);
    const res = await fetch("/api/settings/shortcut-token", { method: "POST" });
    const data = await res.json();
    setToken(data.token);
    setHasToken(true);
    setNeedsRegenerate(false);
    setGenerating(false);
  }

  async function deleteToken() {
    if (!confirm("Mevcut token'ı silmek istediğinize emin misiniz? Kısayolunuz çalışmayı durduracaktır.")) return;
    await fetch("/api/settings/shortcut-token", { method: "DELETE" });
    setToken(null);
    setHasToken(false);
    setNeedsRegenerate(false);
  }

  function copyText(text: string, label: string) {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  }

  const setupUrl =
    token && typeof window !== "undefined"
      ? `${window.location.origin}/shortcut/setup/${token}`
      : null;

  if (loading) return <div className="text-zinc-400">Yükleniyor...</div>;

  return (
    <>
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">Mobil Kurulum</h1>

      {/* iPhone Kisayolu - once kurulum */}
      <Card className="mb-6">
        <div className="flex items-start gap-4">
          <Smartphone size={24} className="text-zinc-400 mt-1 shrink-0" />
          <div className="flex-1">
            <CardTitle>iPhone Kısayolu</CardTitle>
            <CardDescription className="mt-1 mb-3">
              iPhone paylaşım menüsünden içeriklerinizi doğrudan Not Al&apos;a
              gönderebilirsiniz. Herhangi bir uygulamada paylaş butonuna basıp
              &quot;Notlarıma Ekle&quot; kısayolunu seçmeniz yeterli.
            </CardDescription>

            {!hasToken && (
              <>
                <p className="text-sm text-zinc-500 mb-3">
                  Başlamak için bir token oluşturun.
                </p>
                <Button onClick={generateToken} loading={generating}>
                  Token Oluştur ve Kuruluma Başla
                </Button>
              </>
            )}

            {hasToken && needsRegenerate && (
              <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20 p-3">
                <p className="text-sm text-amber-700 dark:text-amber-400 mb-3">
                  Mevcut token&apos;ınız eski biçimde saklandığı için tekrar
                  gösterilemiyor. Yeniden oluşturun; kurulum tek dokunuşa iner.
                </p>
                <Button onClick={generateToken} loading={generating} size="sm">
                  <RefreshCw size={16} /> Token&apos;ı Yenile
                </Button>
              </div>
            )}

            {setupUrl && (
              <>
                <div className="flex flex-wrap gap-2 mb-3">
                  <a href={setupUrl}>
                    <Button size="sm">
                      <Smartphone size={16} /> iPhone&apos;a Kur
                    </Button>
                  </a>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyText(setupUrl, "link")}
                  >
                    {copied === "link" ? <Check size={16} /> : <Copy size={16} />} Kurulum
                    Linkini Kopyala
                  </Button>
                </div>
                <p className="text-xs text-zinc-400">
                  iPhone&apos;dan Safari ile açın. Butona bastığınızda token
                  otomatik kopyalanır ve Kısayollar uygulaması açılır; tek
                  yapmanız gereken token alanına yapıştırmak.
                </p>
              </>
            )}
          </div>
        </div>
      </Card>

      {/* Token yonetimi */}
      {hasToken && (
        <Card className="mb-6">
          <CardTitle>API Token</CardTitle>
          <p className="text-sm text-zinc-500 mt-1 mb-4">
            Kısayolunuzun sisteme erişmesini bu token sağlar. Yenilerseniz eski
            kısayolunuz çalışmayı durdurur ve yeniden kurmanız gerekir.
          </p>

          {token && (
            <div className="flex items-center gap-2 mb-4">
              <code className="flex-1 text-sm bg-zinc-100 dark:bg-zinc-800 px-3 py-2 rounded-lg text-zinc-700 dark:text-zinc-300 break-all">
                {token}
              </code>
              <Button variant="outline" size="sm" onClick={() => copyText(token, "token")}>
                {copied === "token" ? <Check size={16} /> : <Copy size={16} />}
              </Button>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={generateToken} loading={generating}>
              <RefreshCw size={16} /> Yeniden Oluştur
            </Button>
            <Button variant="danger" onClick={deleteToken}>
              <Trash2 size={16} /> Token Sil
            </Button>
          </div>
        </Card>
      )}
    </>
  );
}
