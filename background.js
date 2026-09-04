// Sanoja background service worker.
//
// The content script used to call fetch() directly against
// translate.googleapis.com. That fetch runs in the context of whatever
// webpage you're on, so it's subject to THAT PAGE's CORS policy — declaring
// host_permissions in the manifest doesn't make a content script's own
// fetch() bypass it. That's very likely why translation was failing on
// every page ("Couldn't translate"), not just occasionally.
//
// The service worker doesn't have that restriction, so it does the actual
// network request here, and the content script just asks it for a result.

chrome.runtime.setUninstallURL("https://sanoja-app.github.io/sanoja-finnish-word-reader/uninstall.html");

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== "sanoja-translate") return false;

  translate(message.text, message.targetLang, message.sourceLang)
    .then((result) => sendResponse({ ok: true, ...result }))
    .catch((err) => sendResponse({ ok: false, error: String((err && err.message) || err) }));

  return true; // keep the message channel open for the async sendResponse above
});

// sourceLang defaults to "auto" (let Google guess). The content script can
// pass an explicit source instead when it has a stronger signal than Google's
// own single-word detection — see the pageLang check in translateBidirectional.
async function translate(text, targetLang, sourceLang) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(
    sourceLang || "auto"
  )}&tl=${encodeURIComponent(
    targetLang
  )}&dt=t&q=${encodeURIComponent(text)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Translate request failed: ${res.status}`);
  const data = await res.json();
  // data[0] is an array of [translatedChunk, originalChunk, ...]; data[2] is the detected source language.
  const translatedText = data[0].map((chunk) => chunk[0]).join("");
  const detectedLang = data[2];
  return { translatedText, detectedLang };
}
