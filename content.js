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

    const row = document.createElement("div");
    row.className = "sanoja-row";

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

    row.appendChild(textWrap);
    row.appendChild(speakBtn);
    el.appendChild(row);

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
  // Google's auto-detection is unreliable on a single isolated word with no
  // surrounding context. Two distinct failure modes showed up in testing:
  //
  // 1. Cognates that are valid words in both languages (e.g. "on", a common
  //    English preposition that's also the most frequent Finnish verb form)
  //    regularly get misdetected as English even on a Finnish page.
  // 2. Ordinary Finnish vocabulary — "talo" (house), "kirja" (book), "vesi"
  //    (water) — regularly gets misdetected as an unrelated third language
  //    (Somali, Estonian, ...) rather than "fi", which then poisons the
  //    translation ("talo" -> "neuvoja" instead of "house"). This isn't
  //    limited to short words, so it can't be fixed with a length cutoff.
  //
  // For (1), the page's declared language (<html lang="...">) is a stronger
  // signal than Google's single-word guess, so we re-run the lookup with the
  // source forced when they disagree. For (2), Google naming some third
  // language isn't a usable answer for a tool that only ever deals in
  // English and Finnish — instead we settle it with a round-trip: force the
  // word through as Finnish, then translate that result back. Landing back
  // on the original word means it really was Finnish, regardless of what the
  // page around it happens to be written in.
  function normalizeForCompare(str) {
    return stripEdgePunctuation((str || "").trim()).toLowerCase();
  }

  // Exact match is too strict for a round-trip check on Finnish: the same
  // word in a different grammatical case (e.g. "sikaruttoa", partitive, vs.
  // "sikarutto", nominative) is a correct round-trip but not an equal
  // string. Comparing shared prefixes tolerates case-ending drift without
  // treating unrelated words as a match.
  function roundTripStemsMatch(a, b) {
    a = normalizeForCompare(a);
    b = normalizeForCompare(b);
    if (!a || !b) return false;
    if (a === b) return true;
    const minLen = Math.min(a.length, b.length);
    if (minLen < 4) return false;
    const prefixLen = Math.max(4, minLen - 2);
    return a.slice(0, prefixLen) === b.slice(0, prefixLen);
  }

  async function translateBidirectional(text) {
    const first = await callTranslateApi(text, "fi");
    const detected = first.detectedLang;

    if (detected === "fi") {
      const second = await callTranslateApi(text, "en");
      return {
        sourceLangName: "Finnish",
        translatedText: second.translatedText,
        translatedLangCode: "en",
        translatedLangName: "English",
      };
    }

    const pageLang = (document.documentElement.lang || "").toLowerCase().slice(0, 2);

    if (detected === "en" && pageLang === "fi") {
      const forced = await callTranslateApi(text, "en", "fi");
      return {
        sourceLangName: "Finnish",
        translatedText: forced.translatedText,
        translatedLangCode: "en",
        translatedLangName: "English",
      };
    }

    // Google named "en" without the page backing it up, or named some third
    // language entirely — neither is trustworthy for a two-language tool.
    // Force the text through as Finnish and check whether translating that
    // result back lands on the original word.
    const asFinnish = await callTranslateApi(text, "en", "fi");
    const roundTrip = await callTranslateApi(asFinnish.translatedText, "fi", "en");
    const roundTripMatches = roundTripStemsMatch(roundTrip.translatedText, text);

    if (roundTripMatches || pageLang === "fi") {
      return {
        sourceLangName: "Finnish",
        translatedText: asFinnish.translatedText,
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
  // Also filters out pure numbers and URLs which aren't useful vocabulary.
  function isSingleWord(str) {
    const trimmed = str.trim();
    // Must be a single word (no whitespace)
    if (trimmed.length === 0 || /\s/.test(trimmed)) return false;
    // Must contain at least one letter (not just numbers or symbols)
    if (!/\p{L}/u.test(trimmed)) return false;
    // Must not contain numbers (vocabulary shouldn't have digits mixed in)
    if (/\p{N}/u.test(trimmed)) return false;
    // Must not be a URL
    if (/^https?:\/\/|^www\./i.test(trimmed)) return false;
    return true;
  }

  // Strips leading/trailing punctuation (a trailing period from a
  // sentence-ending selection, etc.) without touching internal hyphens or
  // apostrophes, which are legitimate inside a word.
  function stripEdgePunctuation(str) {
    return str.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
  }

  // Shown once, ever, the first time a word is actually saved — not on
  // install or on every new device, since that pattern (extensions
  // reopening a tab or nagging every time Chrome Sync adds them to a fresh
  // browser) is exactly what this is meant to avoid. Stored in sync storage
  // so once it's been seen on any one device, it stays dismissed everywhere.
  function maybeShowSaveHint(popupElAtSaveTime) {
    chrome.storage.sync.get({ sanojaSeenSaveHint: false }, ({ sanojaSeenSaveHint }) => {
      if (sanojaSeenSaveHint) return;
      chrome.storage.sync.set({ sanojaSeenSaveHint: true });
      // The word card may have already been dismissed by the time this
      // storage round-trip resolves — only attach the hint if it's still
      // the same popup that's on screen.
      if (popupEl !== popupElAtSaveTime || !popupEl) return;

      const hint = document.createElement("div");
      hint.className = "sanoja-hint";
      hint.textContent =
        "Saved for later. Open the Sanoja icon in your toolbar to review it.";
      popupEl.appendChild(hint);
    });
  }

  function saveWord(finnish, english, context) {
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
        // The sentence the word was first captured from — kept from that
        // first save (like firstSeen) rather than replaced on later re-saves,
        // since "why did I save this" is about the original moment, not
        // whichever page happened to trigger the most recent lookup.
        context: existing && existing.context ? existing.context : context || "",
      };
      chrome.storage.local.set({ sanojaWords });
    });
  }

  // Longest a stored sentence gets to be — capped so a selection inside a
  // giant unbroken block (a whole <article>, a wall-of-text <div>) doesn't
  // turn "context" into "the entire page".
  const MAX_CONTEXT_CHARS = 240;

  // Finds the sentence the current selection sits inside, by walking up to
  // a block-level ancestor and splitting its text on sentence punctuation.
  // Falls back to the block's own text (capped) when no sentence boundary
  // contains the selection, which is common in short UI strings — button
  // labels, nav items, list bullets — that were never full sentences.
  function getSelectionContext(selection) {
    if (!selection || selection.rangeCount === 0) return "";
    const range = selection.getRangeAt(0);
    let container = range.commonAncestorContainer;
    if (container.nodeType === Node.TEXT_NODE) container = container.parentElement;
    if (!container || !container.closest) return "";

    let el = container;
    for (let i = 0; i < 4 && el.parentElement; i++) {
      const display = window.getComputedStyle(el).display;
      if (display !== "inline" && display !== "inline-block") break;
      el = el.parentElement;
    }

    const blockText = (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim();
    if (!blockText) return "";

    const selectedText = selection.toString().trim().toLowerCase();
    const sentences = blockText.match(/[^.!?]+[.!?]*/g) || [blockText];
    const match = sentences.find((s) => s.toLowerCase().includes(selectedText));
    let context = (match || blockText).trim();

    // A "sentence" that's really just the selected word itself (no
    // surrounding text found) isn't context worth storing.
    if (context.length <= selectedText.length + 2) return "";

    if (context.length > MAX_CONTEXT_CHARS) {
      context = `${context.slice(0, MAX_CONTEXT_CHARS - 1).trim()}…`;
    }
    return context;
  }

  async function handleSelectionText(text, rect, context) {
    if (!text || text.length > MAX_CHARS) return;
    if (text === lastText && popupEl) return; // already showing this one
    lastText = text;

    const { originalLabelEl, translatedLabelEl, translatedEl, speakBtn } = createPopup(text, rect);

    try {
      const result = await translateBidirectional(text);
      originalLabelEl.textContent = result.sourceLangName;

      // Proper nouns (names like "Kupiainen") and true cross-language
      // cognates come back from Google unchanged — same word on both sides.
      // Presenting that as a normal translation just reads as "it didn't
      // translate", so call it out instead of silently repeating the word.
      const untranslated = normalizeForCompare(result.translatedText) === normalizeForCompare(text);
      if (untranslated) {
        translatedLabelEl.textContent = "Note";
        translatedEl.textContent = "Same in both languages (likely a name)";
      } else {
        translatedLabelEl.textContent = result.translatedLangName;
        translatedEl.textContent = result.translatedText;
      }
      translatedEl.classList.remove("sanoja-skeleton");
      speakBtn.disabled = false;

      // Whichever side is Finnish — the original selection, or the
      // translation — computed once and reused for both saving the word and
      // speaking it.
      const cleanedSource = stripEdgePunctuation(text.trim());
      const cleanedTranslated = stripEdgePunctuation((result.translatedText || "").trim());
      const finnishText = result.translatedLangCode === "fi" ? cleanedTranslated : cleanedSource;
      const englishText = result.translatedLangCode === "en" ? cleanedTranslated : cleanedSource;

      // Save the word for later review — only when a single word was
      // selected, not a phrase or full sentence, and it actually translated
      // to something (an untranslated proper noun isn't useful vocabulary).
      // Also validate the cleaned versions to ensure the translation didn't
      // introduce unwanted content.
      if (!untranslated && isSingleWord(text) && isSingleWord(finnishText) && isSingleWord(englishText)) {
        saveWord(finnishText, englishText, context);
        maybeShowSaveHint(popupEl);
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

  // On pages built from web components (e.g. tori.fi), a selection whose
  // text lives inside a shadow root gets a Range that Chrome reports as
  // collapsed to 0x0 at the origin, even though selection.toString() still
  // returns the right text — the main-document Range/Selection API can't
  // expose real geometry for something anchored inside a shadow tree. That
  // 0x0 rect used to make us bail out entirely, so the popup silently never
  // appeared on such sites. Falling back to the click coordinates (always
  // valid, shadow DOM or not) keeps the popup working there too.
  function getSelectionRectAndText(fallbackPoint) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;
    const text = selection.toString().trim();
    if (!text) return null;
    const range = selection.getRangeAt(0);
    let rect = range.getBoundingClientRect();
    const rectIsEmpty = !rect || (rect.width === 0 && rect.height === 0);
    if (rectIsEmpty) {
      if (!fallbackPoint) return null;
      rect = {
        top: fallbackPoint.y,
        bottom: fallbackPoint.y,
        left: fallbackPoint.x,
        right: fallbackPoint.x,
        width: 0,
        height: 0,
      };
    }
    return { text, rect, context: getSelectionContext(selection) };
  }

  document.addEventListener("mouseup", (e) => {
    if (!settings.enabled) return;
    if (popupEl && popupEl.contains(e.target)) return;
    if (isEditableTarget(e.target)) return;

    const fallbackPoint = { x: e.clientX, y: e.clientY };
    // Let the browser finish updating the selection first.
    setTimeout(() => {
      const sel = getSelectionRectAndText(fallbackPoint);
      if (sel) handleSelectionText(sel.text, sel.rect, sel.context);
    }, 0);
  });

  document.addEventListener("dblclick", (e) => {
    if (!settings.enabled) return;
    if (isEditableTarget(e.target)) return;

    const fallbackPoint = { x: e.clientX, y: e.clientY };
    setTimeout(() => {
      const sel = getSelectionRectAndText(fallbackPoint);
      if (sel) handleSelectionText(sel.text, sel.rect, sel.context);
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
