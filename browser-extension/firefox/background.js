/**
 * Not Al — Firefox eklentisi arka plan betigi.
 *
 * Sag tik menusunden ve arac cubugu dugmesinden /api/ingest'e istek atar.
 * Kisayolla ayni uc nokta ve ayni token kullanilir.
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

function notify(message) {
  api.notifications.create({
    type: "basic",
    iconUrl: api.runtime.getURL("icon.svg"),
    title: "Not Al",
    message,
  });
}

/**
 * Notu gonderir. `?notify=1` sayesinde hatalarda da HTTP 200 ve okunabilir
 * bir `message` doner, yani govdeyi her durumda okuyabiliyoruz.
 */
async function send(payload) {
  const token = await getToken();

  if (!token) {
    notify("❌ Token tanımlı değil. Eklenti ayarlarından ekleyin.");
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
    notify(data.message || (response.ok ? "✅ Not kaydedildi" : "❌ Kaydedilemedi"));
  } catch (error) {
    notify(`❌ Sunucuya ulaşılamadı: ${error.message}`);
  }
}

api.contextMenus.onClicked.addListener((info, tab) => {
  switch (info.menuItemId) {
    case "notal-link":
      send({ url: info.linkUrl, title: info.linkText || null });
      break;

    case "notal-media":
      send({ url: info.srcUrl, title: tab?.title || null });
      break;

    case "notal-selection":
      // Secili metinle birlikte sayfa adresi de gonderiliyor ki not
      // nereden geldigini kaybetmesin
      send({ text: info.selectionText, url: tab?.url, title: tab?.title || null });
      break;

    default:
      send({ url: info.pageUrl || tab?.url, title: tab?.title || null });
  }
});

api.action.onClicked.addListener((tab) => {
  send({ url: tab.url, title: tab.title || null });
});
