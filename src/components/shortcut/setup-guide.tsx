"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle, CardDescription } from "@/components/ui/card";
import { Smartphone, Copy, Check } from "lucide-react";

/**
 * iPhone kisayolu kurulum adimlari.
 *
 * Hem panodaki "Mobil Kurulum" sayfasi hem de telefonda acilan tokenli
 * kurulum sayfasi bunu kullaniyor. Onceden tokenli sayfa kendi <html>
 * belgesini ve kendi CSS'ini basiyordu: hem root layout icinde gecersiz
 * ic ice gecme uretiyordu hem de gorunumu siteye benzemiyordu.
 */

// Imzali kisayol /public altinda durur. Yeniden uretmek icin:
//   shortcuts sign -i public/shortcut-template.shortcut -o public/Notlarima-Ekle.shortcut -m anyone
//
// iOS 15'ten beri "Guvenilmeyen Kisayollara Izin Ver" ayari yok ve ice
// aktarilan kisayolun imzali olmasi zorunlu; imzasiz dosya kurulamaz.
// Not: shortcuts://import-shortcut?url=... kullanilmiyor. Kisayollar
// uygulamasi kendi barindirdigimiz dosyayi (URL dogru kodlanmis olsa bile)
// "Girilen kestirme URL'si gecersiz" diyerek reddediyor; bu sema pratikte
// yalnizca iCloud baglantilarini kabul ediyor. Kurulum dogrudan indirme ile
// yapiliyor.
// Dosya adi onemli: iOS ice aktarirken kisayolun adini dosya adindan aliyor,
// plist icindeki WFWorkflowName'den degil.
export const SHORTCUT_FILE_NAME = "Notlarima-Ekle.shortcut";
export const SHORTCUT_FILE_URL = `/${SHORTCUT_FILE_NAME}`;

const STEPS = [
  {
    title: "Kısayolu indirin",
    body: (
      <>
        Aşağıdaki butona basın. Safari dosyayı indirir ve token&apos;ınız aynı
        anda panoya kopyalanır.
      </>
    ),
  },
  {
    title: "İndirilen dosyaya dokunun",
    body: (
      <>
        Safari&apos;de sağ üstteki <b>indirmeler</b> simgesine basıp{" "}
        <b>{SHORTCUT_FILE_NAME}</b> dosyasına dokunun. Kısayollar uygulaması
        açılacak.
      </>
    ),
  },
  {
    title: "Token'ı yapıştırın",
    body: (
      <>
        &quot;API Token&apos;ınızı girin&quot; alanına uzun basıp{" "}
        <b>Yapıştır</b> deyin, sonra <b>Kısayolu Ekle</b>.
      </>
    ),
  },
];

/**
 * navigator.clipboard iOS'ta sayfa odakta degilse veya izin verilmediginde
 * reddediyor. Secim + execCommand eski bir yontem ama Safari'de hala
 * calisiyor ve tek yedegimiz.
 */
function legacyCopy(text: string): boolean {
  const field = document.createElement("textarea");
  field.value = text;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.top = "0";
  field.style.opacity = "0";
  document.body.appendChild(field);

  field.focus();
  field.select();
  // iOS'ta select() tek basina yetmiyor, araligi acikca vermek gerekiyor
  field.setSelectionRange?.(0, text.length);

  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }

  document.body.removeChild(field);
  return ok;
}

interface Props {
  token: string;
}

export function SetupGuide({ token }: Props) {
  const [hint, setHint] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function copy(quiet: boolean) {
    const done = () => {
      setCopied(true);
      setHint(quiet ? "Token panoya kopyalandı" : "Kopyalandı");
      setTimeout(() => {
        setCopied(false);
        setHint(null);
      }, 2500);
    };

    const fallback = () => {
      if (legacyCopy(token)) done();
      else setHint("Kopyalanamadı — token'a uzun basıp elle kopyalayın");
    };

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(token).then(done, fallback);
      return;
    }
    fallback();
  }

  return (
    <Card>
      <div className="flex items-start gap-4">
        <Smartphone size={24} className="text-zinc-400 mt-1 shrink-0" />
        <div className="flex-1 min-w-0">
          <CardTitle>Notlarıma Ekle</CardTitle>
          <CardDescription className="mt-1">
            Herhangi bir uygulamada paylaş butonuna basıp bu kısayolu
            seçtiğinizde içerik doğrudan buraya düşer.
          </CardDescription>
        </div>
      </div>

      <ol className="mt-6 space-y-5">
        {STEPS.map((step, index) => (
          <li key={step.title} className="flex items-start gap-3">
            <span className="flex items-center justify-center w-6 h-6 shrink-0 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-xs font-bold mt-0.5">
              {index + 1}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {step.title}
              </p>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                {step.body}
              </p>
            </div>
          </li>
        ))}
      </ol>

      {/* download niteligi yok: Safari'nin dosyayi indirmek yerine
          Kisayollar'a devredebilmesi icin dogrudan gezinmesi gerekiyor.
          Indirmeye giderken token panoya yazilir ki import ekrani
          sordugunda hazir olsun. */}
      <div className="flex items-center gap-3 flex-wrap mt-6">
        <a href={SHORTCUT_FILE_URL} onClick={() => copy(true)}>
          <Button size="sm">
            <Smartphone size={16} /> Kısayolu İndir
          </Button>
        </a>
        <span className="text-xs text-zinc-400">
          iPhone&apos;dan Safari ile açın.
        </span>
      </div>

      <div className="mt-6 pt-5 border-t border-zinc-100 dark:border-zinc-800">
        <p className="text-xs text-zinc-400 mb-2">
          {hint || "Token — kopyalamak için dokun"}
        </p>
        <button
          type="button"
          onClick={() => copy(false)}
          className="flex w-full items-center gap-3 text-left rounded-lg bg-zinc-100 dark:bg-zinc-800 px-3 py-2.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 cursor-pointer"
        >
          <code className="flex-1 min-w-0 font-mono text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 break-all">
            {token}
          </code>
          {copied ? (
            <Check size={16} className="shrink-0 text-emerald-500" />
          ) : (
            <Copy size={16} className="shrink-0 text-zinc-400" />
          )}
        </button>
      </div>
    </Card>
  );
}
