/**
 * Ayarlar sayfasi: token'i kaydeder, oturumdan ceker ve baglantiyi sinar.
 */

const api = globalThis.browser ?? globalThis.chrome;

const BASE_URL = "https://notes.kronomondo.org";

const tokenInput = document.getElementById("token");
const statusEl = document.getElementById("status");

function setStatus(message, ok) {
  statusEl.textContent = message;
  statusEl.className = `status ${ok ? "ok" : "err"}`;
}

api.storage.sync.get("token").then((stored) => {
  if (typeof stored.token === "string") tokenInput.value = stored.token;
});

document.getElementById("save").addEventListener("click", async () => {
  const token = tokenInput.value.trim();

  if (!token) {
    setStatus("Token boş olamaz.", false);
    return;
  }

  await api.storage.sync.set({ token });
  setStatus("✅ Kaydedildi.", true);
});

/**
 * Token'i oturumdan ceker.
 *
 * Kullanici zaten bu tarayicida Not Al'a giris yapmis oluyor; elle kopyalayip
 * yapistirmasina gerek yok. Istek cerezlerle gidiyor, bu yuzden manifest'teki
 * host izni sart.
 */
document.getElementById("fetch").addEventListener("click", async () => {
  setStatus("Oturum kontrol ediliyor...", true);

  try {
    const response = await fetch(`${BASE_URL}/api/settings/shortcut-token`, {
      credentials: "include",
    });

    if (response.status === 401) {
      setStatus("Önce bu tarayıcıda Not Al'a giriş yapın.", false);
      return;
    }

    const data = await response.json();

    if (!data.token) {
      setStatus("Token alınamadı.", false);
      return;
    }

    tokenInput.value = data.token;
    await api.storage.sync.set({ token: data.token });
    setStatus("✅ Token alındı ve kaydedildi.", true);
  } catch (error) {
    setStatus(`Bağlanılamadı: ${error.message}`, false);
  }
});

/**
 * Gercek bir not olusturmadan token'i dogrular: govdesiz istek 400 doner
 * ama token gecersizse 401 gelir. Ayrimi bu sekilde yapiyoruz.
 */
document.getElementById("test").addEventListener("click", async () => {
  const token = tokenInput.value.trim();

  if (!token) {
    setStatus("Önce token girin.", false);
    return;
  }

  setStatus("Sınanıyor...", true);

  try {
    const response = await fetch(`${BASE_URL}/api/ingest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    });

    if (response.status === 401) {
      setStatus("❌ Token geçersiz.", false);
      return;
    }

    setStatus("✅ Token çalışıyor.", true);
  } catch (error) {
    setStatus(`Bağlanılamadı: ${error.message}`, false);
  }
});
