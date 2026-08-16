"use client";

import { useState } from "react";

/**
 * Kurulum sayfasinin etkilesimli kismi.
 *
 * Onceden sayfa tamamen sunucuda uretiliyor ve dinleyiciler head'e gomulu bir
 * script'ten DOMContentLoaded ile baglaniyordu. Akisla gelen sayfada o olay
 * script calismadan once tetiklenebiliyor ve dokunuslar hicbir sey yapmiyordu.
 * Client bilesende bu zamanlama sorunu yok.
 */

interface Props {
  token: string;
  fileUrl: string;
}

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

export function SetupActions({ token, fileUrl }: Props) {
  const [hint, setHint] = useState("Kopyalamak için dokun");

  function flash(message: string, revert: boolean) {
    setHint(message);
    if (revert) {
      setTimeout(() => setHint("Kopyalamak için dokun"), 2500);
    }
  }

  function copy(quiet: boolean) {
    const done = () =>
      flash(quiet ? "✅ Token panoya kopyalandı" : "✅ Kopyalandı!", !quiet);

    const fallback = () => {
      if (legacyCopy(token)) done();
      else flash("Kopyalanamadı — token'a uzun basıp elle kopyalayın", true);
    };

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(token).then(done, fallback);
      return;
    }
    fallback();
  }

  return (
    <>
      {/* download niteligi yok: Safari'nin dosyayi indirmek yerine
          Kisayollar'a devredebilmesi icin dogrudan gezinmesi gerekiyor.
          Indirmeye giderken token panoya yazilir ki import ekrani
          sordugunda hazir olsun. */}
      <a href={fileUrl} className="btn" onClick={() => copy(true)}>
        Kısayolu İndir
      </a>
      <p className="note">iPhone&apos;dan Safari ile açın.</p>

      <hr className="divider" />

      <div className="copy-hint">{hint}</div>
      <button type="button" className="token-box" onClick={() => copy(false)}>
        {token}
      </button>
    </>
  );
}
