"use client";

import { useState, useEffect } from "react";
import { SetupGuide } from "@/components/shortcut/setup-guide";

/**
 * Mobil kurulum.
 *
 * Kurulum adimlari dogrudan bu sayfada: onceden burada yalnizca "kur" ve
 * "linki kopyala" butonlari vardi, adimlar ayri bir sayfadaydi. Kullanici
 * zaten telefonundan giriyor, araya bir tiklama koymanin faydasi yoktu.
 *
 * Token kalici bir kimlik: hesaba bir kere baglanir ve sunucu ilk istekte
 * kendiliginden uretir. "Yeniden olustur" bilerek yok — token degisince
 * telefondaki kisayol calismayi birakiyor ve bastan kurulmasi gerekiyor,
 * yani rutin bir islem degil.
 */
export default function MobileSetupPage() {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/settings/shortcut-token")
      .then((r) => r.json())
      .then((data) => {
        setToken(data.token ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <>
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">
        Mobil Kurulum
      </h1>

      {loading ? (
        <p className="text-zinc-400">Yükleniyor...</p>
      ) : token ? (
        <SetupGuide token={token} />
      ) : (
        <p className="text-sm text-red-500">
          Token okunamadı. Sayfayı yenileyin; sorun sürerse bana bildirin.
        </p>
      )}
    </>
  );
}
