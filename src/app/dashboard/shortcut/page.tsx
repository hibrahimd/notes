"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle, CardDescription } from "@/components/ui/card";
import { Copy, Check, Smartphone } from "lucide-react";

/**
 * Mobil kurulum.
 *
 * Token kalici bir kimlik: hesaba bir kere baglanir ve sunucu ilk istekte
 * kendiliginden uretir. "Yeniden olustur" bilerek yok — token degisince
 * telefondaki kisayol calismayi birakiyor ve bastan kurulmasi gerekiyor,
 * yani rutin bir islem degil.
 *
 * Token burada ayrica gosterilmiyor: kurulum sayfasi zaten kopyalanabilir
 * halde basiyor ve kullanicinin ihtiyaci oldugu an orasi.
 */
export default function MobileSetupPage() {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/settings/shortcut-token")
      .then((r) => r.json())
      .then((data) => {
        setToken(data.token ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  function copySetupLink(url: string) {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const setupUrl =
    token && typeof window !== "undefined"
      ? `${window.location.origin}/shortcut/setup/${token}`
      : null;

  if (loading) return <div className="text-zinc-400">Yükleniyor...</div>;

  return (
    <>
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">
        Mobil Kurulum
      </h1>

      <Card>
        <div className="flex items-start gap-4">
          <Smartphone size={24} className="text-zinc-400 mt-1 shrink-0" />
          <div className="flex-1 min-w-0">
            <CardTitle>iPhone Kısayolu</CardTitle>
            <CardDescription className="mt-1 mb-4">
              Herhangi bir uygulamada paylaş butonuna basıp &quot;Notlarıma
              Ekle&quot; kısayolunu seçtiğinizde içerik doğrudan buraya düşer.
            </CardDescription>

            {setupUrl ? (
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
                    onClick={() => copySetupLink(setupUrl)}
                  >
                    {copied ? <Check size={16} /> : <Copy size={16} />} Kurulum
                    Linkini Kopyala
                  </Button>
                </div>
                <p className="text-xs text-zinc-400">
                  iPhone&apos;dan Safari ile açın. Kurulum sayfasındaki butona
                  bastığınızda token panoya kopyalanır ve Kısayollar uygulaması
                  açılır; tek yapmanız gereken token alanına yapıştırmak.
                </p>
              </>
            ) : (
              <p className="text-sm text-red-500">
                Token okunamadı. Sayfayı yenileyin; sorun sürerse bana bildirin.
              </p>
            )}
          </div>
        </div>
      </Card>
    </>
  );
}
