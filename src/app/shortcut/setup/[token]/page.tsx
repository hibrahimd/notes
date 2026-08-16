import { SetupGuide } from "@/components/shortcut/setup-guide";

/**
 * Telefonda acilan, oturum gerektirmeyen kurulum sayfasi. Token adreste
 * oldugu icin masaustunde uretilen link telefonda dogrudan calisiyor.
 *
 * Adimlar panodaki Mobil Kurulum sayfasiyla ayni bileseni kullaniyor.
 * Onceden bu sayfa kendi <html> belgesini ve kendi CSS'ini basiyordu:
 * root layout icinde gecersiz ic ice gecme uretiyor ve gorunumu siteye
 * benzemiyordu.
 */

interface Props {
  params: Promise<{ token: string }>;
}

export default async function ShortcutSetupPage({ params }: Props) {
  const { token } = await params;

  return (
    <main className="min-h-full flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-6">
      <div className="w-full max-w-md">
        <SetupGuide token={token} />
      </div>
    </main>
  );
}
