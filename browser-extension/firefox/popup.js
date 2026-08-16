/**
 * Arac cubugu menusu.
 *
 * Dugme onceden dogrudan sayfayi gonderiyordu; ayarlara gitmek isteyen
 * kullanici her tikladiginda istemeden not olusturuyordu.
 */

const api = globalThis.browser ?? globalThis.chrome;

document.getElementById("save").addEventListener("click", () => {
  api.runtime.sendMessage({ type: "save-current-tab" });
  window.close();
});

document.getElementById("options").addEventListener("click", () => {
  api.runtime.openOptionsPage();
  window.close();
});
