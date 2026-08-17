// Sanoja content script
// Select or double-click a word/short phrase: English -> Finnish, or Finnish -> English,
// detected automatically. No other languages.

(() => {
  const MAX_CHARS = 120;

  const LOCALE_MAP = { fi: "fi-FI", en: "en-US" };
  const NAME_MAP = { fi: "Finnish", en: "English" };

  let settings = { enabled: true, autoSpeak: false };
  let popupEl = null;
  let lastText = "";

  function loadSettings(cb) {
    chrome.storage.sync.get(
      { sanojaEnabled: true, sanojaAutoSpeak: false },
      (items) => {
        settings.enabled = items.sanojaEnabled;
        settings.autoSpeak = items.sanojaAutoSpeak;
        if (cb) cb();
      }
    );
  }
  loadSettings();

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.sanojaEnabled) settings.enabled = changes.sanojaEnabled.newValue;
    if (changes.sanojaAutoSpeak) settings.autoSpeak = changes.sanojaAutoSpeak.newValue;
  });

  function isEditableTarget(el) {
    if (!el) return false;
    const tag = el.tagName ? el.tagName.toLowerCase() : "";
    return (
      tag === "input" ||
      tag === "textarea" ||
      el.isContentEditable === true
    );
  }

  function removePopup() {
    if (popupEl) {
      popupEl.remove();
      popupEl = null;
    }
  }

  function createPopup(text, rect) {
    removePopup();

    const el = document.createElement("div");
    el.id = "sanoja-popup";

    const textWrap = document.createElement("div");
    textWrap.className = "sanoja-text";

    const originalLabel = document.createElement("div");
    originalLabel.className = "sanoja-label";
    originalLabel.textContent = " "; // filled in once we know the source language

    const original = document.createElement("div");
    original.className = "sanoja-original";
    original.textContent = text;

    const translatedLabel = document.createElement("div");
    translatedLabel.className = "sanoja-label";
    translatedLabel.textContent = " ";

    const translated = document.createElement("div");
    translated.className = "sanoja-translated sanoja-skeleton";

    textWrap.appendChild(originalLabel);
    textWrap.appendChild(original);
    textWrap.appendChild(translatedLabel);
    textWrap.appendChild(translated);

    const speakBtn = document.createElement("button");
    speakBtn.className = "sanoja-speak";
    speakBtn.setAttribute("aria-label", "Hear pronunciation");
    speakBtn.innerHTML = iconSvg("volume", 15);
    speakBtn.disabled = true;

    el.appendChild(textWrap);
    el.appendChild(speakBtn);

    document.body.appendChild(el);

    // Position near the selection, keeping it on-screen.
    const top = window.scrollY + rect.bottom + 8;
    let left = window.scrollX + rect.left;
    const maxLeft = window.scrollX + document.documentElement.clientWidth - el.offsetWidth - 12;
    left = Math.max(window.scrollX + 8, Math.min(left, maxLeft));
    el.style.top = `${top}px`;
    el.style.left = `${left}px`;

    popupEl = el;

    return { originalLabelEl: originalLabel, translatedLabelEl: translatedLabel, translatedEl: translated, speakBtn };
  }

  // Thrown/rejected whenever the extension has been reloaded or updated
  // (e.g. from chrome://extensions) while this page was already open. The
  // content script injected before the reload is left pointing at a
  // now-dead extension context — nothing short of reloading the page itself
  // can fix that, so we give it its own error type to show a clear message
  // instead of a generic "Couldn't translate".
  class ExtensionReloadedError extends Error {
    constructor() {
      super("Sanoja was updated — reload this page to keep using it.");
      this.name = "ExtensionReloadedError";
    }
  }

  // The actual network request happens in background.js (the service
  // worker), not here — a content script's own fetch() is subject to the
  // CORS policy of whatever page it's running on, which can silently block
  // it. Asking the background worker to do it sidesteps that entirely.
  function callTranslateApi(text, targetLang, sourceLang) {
    return new Promise((resolve, reject) => {
      // chrome.runtime.id disappears once this content script's extension
      // context has been invalidated — check proactively so we can show a
      // clear message instead of letting sendMessage throw a cryptic one.
      if (!chrome.runtime || !chrome.runtime.id) {
        reject(new ExtensionReloadedError());
        return;
      }
      try {
        chrome.runtime.sendMessage(
          { type: "sanoja-translate", text, targetLang, sourceLang },
          (response) => {
            if (chrome.runtime.lastError) {
              const message = chrome.runtime.lastError.message || "";
              if (/context invalidated/i.test(message)) {
                reject(new ExtensionReloadedError());
              } else {
                reject(new Error(message));
              }
              return;
            }
            if (!response || !response.ok) {
              reject(new Error((response && response.error) || "Translate failed"));
              return;
            }
            resolve({ translatedText: response.translatedText, detectedLang: response.detectedLang });
          }
        );
      } catch (err) {
        // Older Chrome versions can throw synchronously (rather than via
        // lastError) once the context is invalidated.
        if (/context invalidated/i.test(String((err && err.message) || err))) {
          reject(new ExtensionReloadedError());
        } else {
          reject(err);
        }
      }
    });
  }

  // Only two directions exist: English -> Finnish, and Finnish -> English.
  // We try Finnish first (the common case); if the selected text turns out to
  // already be Finnish, we make a second call to get the English translation.
  //
  // Google's auto-detection is unreliable on a single isolated SHORT word
  // with no surrounding context — tokens that are valid words in both
  // languages (e.g. "on", a common English preposition that's also the most
  // frequent verb form in Finnish) regularly get misdetected, which is what
  // caused Finnish audio to come out as English on an English page. When
  // that happens AND it disagrees with what the page itself declares
  // (<html lang="...">), the page is a much stronger signal for a token this
  // short, so we re-run the lookup with the source forced instead of
  // trusting auto-detect twice. Restricted to short text on purpose: longer
  // selections are rarely ambiguous between these two languages, and this
  // shouldn't override a real Finnish phrase quoted inside an English page.
  const AMBIGUOUS_LENGTH_THRESHOLD = 4;

  async function translateBidirectional(text) {
    const first = await callTranslateApi(text, "fi");
    let detected = first.detectedLang;

    const pageLang = (document.documentElement.lang || "").toLowerCase().slice(0, 2);
    const isShort = text.trim().length <= AMBIGUOUS_LENGTH_THRESHOLD;
    const detectionIsSuspect =
      isShort &&
      ((detected === "fi" && pageLang === "en") || (detected !== "fi" && pageLang === "fi"));

    if (detectionIsSuspect) {
      if (pageLang === "fi") {
        const forced = await callTranslateApi(text, "en", "fi");
        return {
          sourceLangName: "Finnish",
          translatedText: forced.translatedText,
          translatedLangCode: "en",
          translatedLangName: "English",
        };
      }
      const forced = await callTranslateApi(text, "fi", "en");
      return {
        sourceLangName: "English",
        translatedText: forced.translatedText,
        translatedLangCode: "fi",
        translatedLangName: "Finnish",
      };
    }

    if (detected === "fi") {
      const second = await callTranslateApi(text, "en");
      return {
        sourceLangName: "Finnish",
        translatedText: second.translatedText,
        translatedLangCode: "en",
        translatedLangName: "English",
      };
    }
    return {
      sourceLangName: "English",
      translatedText: first.translatedText,
      translatedLangCode: "fi",
      translatedLangName: "Finnish",
    };
  }

  // Chrome loads its voice list asynchronously — on the very first speech
  // call on a page, getVoices() can come back empty before that list is
  // ready, so the browser has nothing to match "fi-FI" against and falls
  // back to whatever generic default it has, which can sound completely
  // broken on Finnish text. That's why this used to be intermittent: fine
  // once voices had loaded, garbled on the first word after a page loads.
  // Waiting for the real list once (and caching it) fixes that without
  // reintroducing a manual voice picker.
  let voicesReadyPromise = null;
  function ensureVoicesLoaded() {
    if (voicesReadyPromise) return voicesReadyPromise;
    voicesReadyPromise = new Promise((resolve) => {
      const existing = window.speechSynthesis.getVoices();
      if (existing && existing.length > 0) {
        resolve(existing);
        return;
      }
      const onVoicesChanged = () => {
        const voices = window.speechSynthesis.getVoices();
        if (voices && voices.length > 0) {
          window.speechSynthesis.removeEventListener("voiceschanged", onVoicesChanged);
          resolve(voices);
        }
      };
      window.speechSynthesis.addEventListener("voiceschanged", onVoicesChanged);
      // Some browsers never fire voiceschanged — don't hang forever.
      setTimeout(() => {
        window.speechSynthesis.removeEventListener("voiceschanged", onVoicesChanged);
        resolve(window.speechSynthesis.getVoices() || []);
      }, 1000);
    });
    return voicesReadyPromise;
  }

  // Exact locale match first, then same-language-any-region (matched on the
  // "xx-" boundary, not just startsWith — a bare startsWith("fi") is what
  // previously matched Filipino "fil-PH" by mistake). Falls back to null
  // (letting the browser use its own default) if nothing matches at all.
  function pickVoice(voices, langCode) {
    const target = (LOCALE_MAP[langCode] || langCode).toLowerCase();
    const prefix = target.split("-")[0];
    return (
      voices.find((v) => v.lang && v.lang.toLowerCase() === target) ||
      voices.find((v) => v.lang && v.lang.toLowerCase().startsWith(`${prefix}-`)) ||
      voices.find((v) => v.lang && v.lang.toLowerCase() === prefix) ||
      null
    );
  }

  async function speak(text, langCode) {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const voices = await ensureVoicesLoaded();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = LOCALE_MAP[langCode] || langCode;
    const voice = pickVoice(voices, langCode);
    if (voice) utterance.voice = voice;
    utterance.rate = 0.92;
    window.speechSynthesis.speak(utterance);
  }

  // Only single-word selections get logged to the word list — dragging across
  // a whole sentence still shows a translation popup, it just doesn't pollute
  // the saved word log (which is meant for vocabulary, not sentences).
  function isSingleWord(str) {
    const trimmed = str.trim();
    return trimmed.length > 0 && !/\s/.test(trimmed);
  }

  // Strips leading/trailing punctuation (a trailing period from a
  // sentence-ending selection, etc.) without touching internal hyphens or
  // apostrophes, which are legitimate inside a word.
  function stripEdgePunctuation(str) {
    return str.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
  }

  function saveWord(finnish, english) {
    const key = finnish.trim().toLowerCase();
    if (!key) return;
    chrome.storage.local.get({ sanojaWords: {} }, ({ sanojaWords }) => {
      const now = new Date().toISOString();
      const existing = sanojaWords[key];
      sanojaWords[key] = {
        finnish: finnish.trim(),
        english: english.trim(),
        count: existing ? existing.count + 1 : 1,
        firstSeen: existing ? existing.firstSeen : now,
        lastSeen: now,
        // Leitner-style review scheduling, only ever touched by the quiz —
        // just encountering a word again on a page doesn't reset its schedule.
        box: existing && existing.box ? existing.box : 1,
        nextReview: existing && existing.nextReview ? existing.nextReview : now,
      };
      chrome.storage.local.set({ sanojaWords });
    });
  }

  async function handleSelectionText(text, rect) {
    if (!text || text.length > MAX_CHARS) return;
    if (text === lastText && popupEl) return; // already showing this one
    lastText = text;

    const { originalLabelEl, translatedLabelEl, translatedEl, speakBtn } = createPopup(text, rect);

    try {
      const result = await translateBidirectional(text);
      originalLabelEl.textContent = result.sourceLangName;
      translatedLabelEl.textContent = result.translatedLangName;
      translatedEl.textContent = result.translatedText;
      translatedEl.classList.remove("sanoja-skeleton");
      speakBtn.disabled = false;

      // Whichever side is Finnish — the original selection, or the
      // translation — computed once and reused for both saving the word and
      // speaking it.
      const cleanedSource = stripEdgePunctuation(text.trim());
      const cleanedTranslated = stripEdgePunctuation(result.translatedText.trim());
      const finnishText = result.translatedLangCode === "fi" ? cleanedTranslated : cleanedSource;
      const englishText = result.translatedLangCode === "en" ? cleanedTranslated : cleanedSource;

      // Save the word for later review — only when a single word was
      // selected, not a phrase or full sentence.
      if (isSingleWord(text) && finnishText && englishText) {
        saveWord(finnishText, englishText);
      }

      // Always speak the Finnish side, no matter which direction the lookup
      // went. The point of the audio is Finnish pronunciation — speaking the
      // English translation instead (which used to happen for every word on
      // a Finnish-language page, since Finnish was usually the detected
      // *source*, not the "translated" side) wasn't useful and just read as
      // "why does it keep reading English?".
      const speakText = finnishText || result.translatedText;
      speakBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        speak(speakText, "fi");
      });
      // Only auto-speak if the user has turned that on in the popup settings.
      if (settings.autoSpeak) {
        speak(speakText, "fi");
      }
    } catch (err) {
      translatedEl.textContent =
        err && err.name === "ExtensionReloadedError" ? err.message : "Couldn't translate";
      translatedEl.classList.remove("sanoja-skeleton");
      // Logged to the page's console (not shown in the popup, to keep it
      // clean) so a real error is visible via right-click -> Inspect ->
      // Console if this ever happens again.
      console.error("Sanoja translate error:", err);
    }
  }

  function getSelectionRectAndText() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;
    const text = selection.toString().trim();
    if (!text) return null;
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (!rect || (rect.width === 0 && rect.height === 0)) return null;
    return { text, rect };
  }

  document.addEventListener("mouseup", (e) => {
    if (!settings.enabled) return;
    if (popupEl && popupEl.contains(e.target)) return;
    if (isEditableTarget(e.target)) return;

    // Let the browser finish updating the selection first.
    setTimeout(() => {
      const sel = getSelectionRectAndText();
      if (sel) handleSelectionText(sel.text, sel.rect);
    }, 0);
  });

  document.addEventListener("dblclick", (e) => {
    if (!settings.enabled) return;
    if (isEditableTarget(e.target)) return;

    setTimeout(() => {
      const sel = getSelectionRectAndText();
      if (sel) handleSelectionText(sel.text, sel.rect);
    }, 0);
  });

  document.addEventListener("mousedown", (e) => {
    if (popupEl && !popupEl.contains(e.target)) {
      removePopup();
      lastText = "";
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      removePopup();
      lastText = "";
    }
  });

  window.addEventListener("scroll", () => {
    removePopup();
    lastText = "";
  }, { passive: true });
})();
