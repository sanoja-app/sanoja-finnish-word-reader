const enabledEl = document.getElementById("enabled");
const autoSpeakEl = document.getElementById("autoSpeak");
const reviewBtn = document.getElementById("reviewWords");
const statLine = document.getElementById("statLine");
const feedbackLink = document.getElementById("feedbackLink");

chrome.storage.sync.get(
  { sanojaEnabled: true, sanojaAutoSpeak: false },
  (items) => {
    enabledEl.checked = items.sanojaEnabled;
    autoSpeakEl.checked = items.sanojaAutoSpeak;
  }
);

enabledEl.addEventListener("change", () => {
  chrome.storage.sync.set({ sanojaEnabled: enabledEl.checked });
});

autoSpeakEl.addEventListener("change", () => {
  chrome.storage.sync.set({ sanojaAutoSpeak: autoSpeakEl.checked });
});

reviewBtn.addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("history.html") });
});

feedbackLink.addEventListener("click", (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: "https://sanoja-app.github.io/sanoja-finnish-word-reader/feedback.html" });
});

chrome.storage.local.get({ sanojaWords: {}, sanojaStreak: null }, ({ sanojaWords, sanojaStreak }) => {
  const words = Object.values(sanojaWords);
  const now = new Date();
  const dueCount = words.filter((w) => !w.mastered && (!w.nextReview || new Date(w.nextReview) <= now)).length;
  const masteredCount = words.filter((w) => w.mastered).length;

  // Leads with what's known, not a backlog count — same reasoning as the
  // word-log page: "3 known" feels like progress, "12 due" feels like a chore.
  const streakBadge =
    sanojaStreak && sanojaStreak.count > 0
      ? `<span class="streak">${iconSvg("flame", 12)}${sanojaStreak.count}</span>`
      : "";
  statLine.innerHTML = `${words.length} word${words.length === 1 ? "" : "s"}` +
    (masteredCount > 0 ? ` · ${masteredCount} known` : "") + streakBadge;

  reviewBtn.innerHTML = dueCount > 0
    ? `${iconSvg("book", 16)}Practice (${dueCount})`
    : `${iconSvg("book", 16)}Browse words`;
});
