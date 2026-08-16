/**
 * Not Al — Firefox eklentisi arka plan betigi.
 *
 * Sag tik menusunden /api/ingest'e istek atar. Kisayolla ayni uc nokta ve
 * ayni token kullanilir.
 */

// Firefox `browser`, Chrome `chrome` tanimliyor; ikisinde de calissin
const api = globalThis.browser ?? globalThis.chrome;

const BASE_URL = "https://notes.kronomondo.org";
const INGEST_URL = `${BASE_URL}/api/ingest?notify=1`;

/**
 * Menu ogeleri. Tek bir "kaydet" yerine baglama gore ayri ogeler var:
 * kullanici bir linke sag tikladiginda sayfayi degil o linki kaydetmek
 * istiyor, secili metinde de metnin kendisini.
 */
const MENU_ITEMS = [
  { id: "notal-page", title: "Bu sayfayı Notlarıma Ekle", contexts: ["page"] },
  { id: "notal-link", title: "Bu linki Notlarıma Ekle", contexts: ["link"] },
  {
    id: "notal-selection",
    title: "Seçimi Notlarıma Ekle",
    contexts: ["selection"],
  },
  {
    id: "notal-media",
    title: "Bu medyayı Notlarıma Ekle",
    contexts: ["image", "video", "audio"],
  },
];

api.runtime.onInstalled.addListener(() => {
  // Guncellemede eskiler kalmasin, hepsi bastan kurulur
  api.contextMenus.removeAll(() => {
    for (const item of MENU_ITEMS) api.contextMenus.create(item);
  });
});

async function getToken() {
  const stored = await api.storage.sync.get("token");
  return typeof stored.token === "string" ? stored.token.trim() : "";
}

/**
 * Sonucu once sayfanin icinde kucuk bir bildirimle gosterir.
 *
 * Isletim sistemi bildirimi (Windows'ta sag alttan gelen kutu) baglami
 * koparıyor: kullanici sayfada duruyor, cevap baska bir yerde beliriyor.
 * Icerik betigi calistirilamayan sayfalarda (about:, addons.mozilla.org,
 * PDF goruntuleyici) sistem bildirimine dusuluyor.
 */
async function report(tabId, message, ok) {
  if (tabId !== undefined && tabId !== null) {
    try {
      await api.scripting.executeScript({
        target: { tabId },
        func: showToast,
        args: [message, Boolean(ok)],
      });
      return;
    } catch {
      // Sayfaya betik enjekte edilemedi, sisteme dusuyoruz
    }
  }

  api.notifications.create({
    type: "basic",
    iconUrl: api.runtime.getURL("icon.svg"),
    title: "Not Al",
    message,
  });
}

/** Sayfaya enjekte edilen fonksiyon; buradaki kapsam sayfaya ait. */
function showToast(message, ok) {
  const ID = "notal-toast";
  document.getElementById(ID)?.remove();

  const box = document.createElement("div");
  box.id = ID;
  box.textContent = message;
  box.style.cssText = [
    "position:fixed",
    "left:50%",
    "bottom:24px",
    "transform:translateX(-50%)",
    "z-index:2147483647",
    "max-width:min(420px,90vw)",
    "padding:12px 18px",
    "border-radius:12px",
    "background:" + (ok ? "#18181b" : "#7f1d1d"),
    "color:#fff",
    "font:14px/1.4 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif",
    "box-shadow:0 8px 28px rgba(0,0,0,.35)",
    "opacity:0",
    "transition:opacity .18s ease",
    "pointer-events:none",
    "text-align:center",
  ].join(";");

  document.body.appendChild(box);
  requestAnimationFrame(() => (box.style.opacity = "1"));

  setTimeout(() => {
    box.style.opacity = "0";
    setTimeout(() => box.remove(), 250);
  }, 3200);
}

/**
 * Notu gonderir. `?notify=1` sayesinde hatalarda da HTTP 200 ve okunabilir
 * bir `message` doner, yani govdeyi her durumda okuyabiliyoruz.
 */
async function send(payload, tabId) {
  const token = await getToken();

  if (!token) {
    // Istek burada kaybolmasin: token kaydedilince kaldigi yerden devam etsin
    await api.storage.local.set({ pending: payload, pendingTabId: tabId ?? null });
    await report(tabId, "❌ Önce token tanımlayın — ayarlar açılıyor.", false);
    api.runtime.openOptionsPage();
    return;
  }

  try {
    const response = await fetch(INGEST_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ ...payload, source: "firefox" }),
    });

    const data = await response.json().catch(() => ({}));
    const ok = response.ok && data.success !== false;

    await report(
      tabId,
      data.message || (ok ? "✅ Not kaydedildi" : "❌ Kaydedilemedi"),
      ok
    );
  } catch (error) {
    await report(tabId, `❌ Sunucuya ulaşılamadı: ${error.message}`, false);
  }
}

/**
 * Token kaydedildikten sonra bekleyen istegi gonderir.
 * Ayarlar sayfasi kaydedince buraya haber veriyor.
 */
async function flushPending() {
  const stored = await api.storage.local.get(["pending", "pendingTabId"]);
  if (!stored.pending) return;

  await api.storage.local.remove(["pending", "pendingTabId"]);
  await send(stored.pending, stored.pendingTabId ?? undefined);
}

/**
 * Ayarlar sayfasi ve arac cubugu menusu buradan konusuyor.
 *
 * Arac cubugu dugmesi artik dogrudan gondermiyor: kullanici ayarlara gitmek
 * icin tikladiginda sayfayi kaydediyor ve istemeden not olusturuyordu.
 * Yerine kucuk bir menu aciliyor (popup.html) ve gonderme oradan geliyor.
 */
api.runtime.onMessage.addListener(async (message) => {
  if (message?.type === "token-saved") {
    await flushPending();
    return;
  }

  if (message?.type === "save-current-tab") {
    const [tab] = await api.tabs.query({ active: true, currentWindow: true });
    if (tab) await send({ url: tab.url, title: tab.title || null }, tab.id);
  }
});

api.contextMenus.onClicked.addListener((info, tab) => {
  const tabId = tab?.id;

  switch (info.menuItemId) {
    case "notal-link":
      send({ url: info.linkUrl, title: info.linkText || null }, tabId);
      break;

    case "notal-media":
      send({ url: info.srcUrl, title: tab?.title || null }, tabId);
      break;

    case "notal-selection":
      // Secili metinle birlikte sayfa adresi de gonderiliyor ki not
      // nereden geldigini kaybetmesin
      send(
        { text: info.selectionText, url: tab?.url, title: tab?.title || null },
        tabId
      );
      break;

    default:
      send({ url: info.pageUrl || tab?.url, title: tab?.title || null }, tabId);
  }
});
