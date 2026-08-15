/**
 * Zorunlu ortam degiskenleri burada tek noktadan dogrulanir.
 * Eksik bir sir varsa uygulama sessizce guvensiz bir varsayilana dusmek yerine
 * ilk kullanimda acik bir hata ile durur.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(
      `${name} ortam degiskeni tanimli degil. .env dosyaniza ekleyin (ornek icin .env.example).`
    );
  }
  return value;
}

let warnedAboutDerivedKey = false;

export function getSessionSecret(): string {
  const secret = required("SESSION_SECRET");
  if (secret.length < 32) {
    throw new Error("SESSION_SECRET en az 32 karakter olmalidir.");
  }
  return secret;
}

/**
 * Sifreleme anahtari. Ayri bir ENCRYPTION_KEY tanimlanmadiysa SESSION_SECRET'ten
 * turetilir; bu durumda SESSION_SECRET degistirilirse kayitli API anahtarlari
 * cozulemez hale gelir, o yuzden ayri tanimlanmasi onerilir.
 */
export function getEncryptionSecret(): string {
  const explicit = process.env.ENCRYPTION_KEY;
  if (explicit && explicit.trim()) {
    if (explicit.length < 32) {
      throw new Error("ENCRYPTION_KEY en az 32 karakter olmalidir.");
    }
    return explicit;
  }

  if (!warnedAboutDerivedKey) {
    warnedAboutDerivedKey = true;
    console.warn(
      "[env] ENCRYPTION_KEY tanimli degil, anahtar SESSION_SECRET'ten turetiliyor. " +
        "SESSION_SECRET degistirilirse kayitli API anahtarlari cozulemez."
    );
  }
  return getSessionSecret();
}
