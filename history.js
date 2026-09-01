// Sequential blue ramp, from the shared palette reference (light surface: #fcfcfb, dark surface: #1a1a19).
// Trimmed to steps with enough contrast to stand alone as text (skips the near-surface steps
// meant for heatmap fills), ordered least -> most frequent.
const LIGHT_STEPS = ["#5598e7", "#3987e5", "#2a78d6", "#1c5cab", "#104281"];
const DARK_STEPS = ["#2a78d6", "#3987e5", "#5598e7", "#86b6ef", "#cde2fb"];
const isDarkMode = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;

// Leitner box -> days until next review.
const BOX_INTERVAL_DAYS = { 1: 1, 2: 3, 3: 7, 4: 14, 5: 30 };
const MAX_BOX = 5;

function boxDescription(boxNum) {
  // "At least" rather than a fixed date — nothing pushes a reminder on that
  // day, it just becomes eligible again then. Someone who doesn't open the
  // app for a week still sees it, just later than the minimum wait.
  const days = BOX_INTERVAL_DAYS[boxNum] || 1;
  const wait = days === 1 ? "a day" : `${days} days`;
  if (boxNum >= MAX_BOX) {
    return `Stage ${boxNum} of ${MAX_BOX} — get it right once more and it moves to your known words. Get it wrong and it drops back to Stage 1.`;
  }
  return `Stage ${boxNum} of ${MAX_BOX} — get it right and it moves to Stage ${boxNum + 1}, so it won't show up again for at least ${wait}. Get it wrong and it drops back to Stage 1.`;
}

const statLine = document.getElementById("statLine");

const segPractice = document.getElementById("segPractice");
const segWords = document.getElementById("segWords");
const practiceSection = document.getElementById("practiceSection");
const wordsSection = document.getElementById("wordsSection");

const searchEl = document.getElementById("search");
const searchIcon = document.getElementById("searchIcon");
const sortByEl = document.getElementById("sortBy");
const subList = document.getElementById("subList");
const subCloud = document.getElementById("subCloud");
const moreBtn = document.getElementById("moreBtn");
const moreMenu = document.getElementById("moreMenu");
const exportBtn = document.getElementById("exportBtn");
const cleanupBtn = document.getElementById("cleanupBtn");
const clearBtn = document.getElementById("clearBtn");
const emptyState = document.getElementById("emptyState");
const listView = document.getElementById("listView");
const listBody = document.getElementById("listBody");
const pagination = document.getElementById("pagination");
const cloudView = document.getElementById("cloudView");
const masteredDetails = document.getElementById("masteredDetails");
const masteredSummary = document.getElementById("masteredSummary");
const masteredList = document.getElementById("masteredList");

const quizIntro = document.getElementById("quizIntro");
const dueText = document.getElementById("dueText");
const startDueBtn = document.getElementById("startDueBtn");
const startAllBtn = document.getElementById("startAllBtn");
const dueModeDesc = document.getElementById("dueModeDesc");
const dueModeTag = document.getElementById("dueModeTag");
const freeModeDesc = document.getElementById("freeModeDesc");
const freeModeTag = document.getElementById("freeModeTag");
const startModeBtn = document.getElementById("startModeBtn");
const quizCard = document.getElementById("quizCard");
const exitQuizBtn = document.getElementById("exitQuizBtn");
const flashCard = document.getElementById("flashCard");
const quizProgress = document.getElementById("quizProgress");
const quizModeBadge = document.getElementById("quizModeBadge");
const quizFinnish = document.getElementById("quizFinnish");
const quizSpeakBtn = document.getElementById("quizSpeakBtn");
const quizAnswerBlock = document.getElementById("quizAnswerBlock");
const quizEnglish = document.getElementById("quizEnglish");
const quizRevealRow = document.getElementById("quizRevealRow");
const showAnswerBtn = document.getElementById("showAnswerBtn");
const quizGradeRow = document.getElementById("quizGradeRow");
const gradeWrongBtn = document.getElementById("gradeWrongBtn");
const gradeRightBtn = document.getElementById("gradeRightBtn");
const quizDone = document.getElementById("quizDone");
const quizDoneText = document.getElementById("quizDoneText");
const quizAgainBtn = document.getElementById("quizAgainBtn");
const practiceMoreBtn = document.getElementById("practiceMoreBtn");

let allWords = []; // [{ key, finnish, english, count, firstSeen, lastSeen, box, nextReview }]
let subView = "list"; // 'list' | 'cloud', within the Words section
// The list view has no limit on how many words someone can save, and
// rendering every row at once turns into one long unbroken scroll once a
// vocabulary gets into the hundreds. Paging it keeps the table itself
// short — actual pages (1, 2, 3…), not an accumulating "load more" that
// just makes that same long list a little at a time. Search and sort still
// operate over the full filtered set, not just the current page.
const LIST_PAGE_SIZE = 50;
let listPage = 1;

// Quiz session state
let quizQueue = [];
let quizPracticeMode = false;
let quizStats = { correct: 0, total: 0 };
// Which mode card is picked on the intro screen — "due" or "free" — before
// Start is pressed. Reselected to a sensible default each time the intro
// re-renders, but a manual pick during that same visit sticks.
let selectedMode = null;
// Both Focused Practice and Free Practice can pull in a large pile —
// due dates cluster (add a bunch of words in one sitting and they all come
// due together), and practice draws from every active word. Thrown at you
// all at once, either reads as a backlog, exactly what the due-queue screen
// deliberately avoids showing as a raw count. Capping a single session and
// letting you start another batch keeps that same spirit instead of dumping
// everything in one sitting.
const PRACTICE_BATCH_SIZE = 20;
let practicePoolSize = 0;

// ---------- Tooltips ----------

// One shared bubble appended to <body>, positioned from each trigger's own
// bounding box on hover/focus. A per-trigger absolutely-positioned bubble
// would get clipped by `.list-view`'s `overflow: hidden` (there to round
// the table's corners) — living outside that container sidesteps it.
const tooltipBubble = document.createElement("div");
tooltipBubble.id = "sharedTooltip";
tooltipBubble.className = "info-tip-bubble";
tooltipBubble.setAttribute("role", "tooltip");
document.body.appendChild(tooltipBubble);

function showTooltip(trigger) {
  const text = trigger.dataset.tip;
  if (!text) return;
  tooltipBubble.textContent = text;
  tooltipBubble.classList.add("visible");
  const rect = trigger.getBoundingClientRect();
  const bubbleRect = tooltipBubble.getBoundingClientRect();
  let left = rect.left + rect.width / 2 - bubbleRect.width / 2;
  left = Math.max(8, Math.min(left, window.innerWidth - bubbleRect.width - 8));
  let top = rect.top - bubbleRect.height - 9;
  if (top < 8) top = rect.bottom + 9; // flip below when there's no room above
  tooltipBubble.style.left = `${left}px`;
  tooltipBubble.style.top = `${top}px`;
}

function hideTooltip() {
  tooltipBubble.classList.remove("visible");
}

// The bubble's position is computed once, on hover/focus — a wheel scroll
// (cursor doesn't move, so mouseleave never fires) would otherwise leave it
// floating over its old coordinates while the trigger moves underneath it.
window.addEventListener("scroll", hideTooltip, true);
window.addEventListener("resize", hideTooltip);

function initTooltip(el, text) {
  if (text) el.dataset.tip = text;
  el.classList.add("info-tip");
  // Every trigger needs to be reachable by keyboard, not just the header's
  // — a mouse-only tooltip on 50 row badges is the same gap the native
  // `title` attribute this replaced already had.
  if (!el.hasAttribute("tabindex")) el.tabIndex = 0;
  el.setAttribute("aria-describedby", "sharedTooltip");
  el.addEventListener("mouseenter", () => showTooltip(el));
  el.addEventListener("mouseleave", hideTooltip);
  el.addEventListener("focus", () => showTooltip(el));
  el.addEventListener("blur", hideTooltip);
}

initTooltip(document.getElementById("stageInfoTip"));

// ---------- Icons ----------

function populateIcons() {
  segPractice.innerHTML = `${iconSvg("book", 15)}Practice`;
  segWords.innerHTML = `${iconSvg("list", 15)}Words`;
  startDueBtn.querySelector(".mode-icon").innerHTML = iconSvg("book", 17);
  startAllBtn.querySelector(".mode-icon").innerHTML = iconSvg("shuffle", 17);
  searchIcon.innerHTML = iconSvg("search", 14);
  subList.innerHTML = iconSvg("list", 15);
  subCloud.innerHTML = iconSvg("cloud", 15);
  moreBtn.innerHTML = iconSvg("more", 16);
  exportBtn.innerHTML = `${iconSvg("download", 15)}Export CSV`;
  cleanupBtn.innerHTML = `${iconSvg("trash", 15)}Clean up sentences`;
  clearBtn.innerHTML = `${iconSvg("trash", 15)}Clear all`;
  quizSpeakBtn.innerHTML = iconSvg("volume", 16);
  exitQuizBtn.innerHTML = iconSvg("x", 14);
  gradeWrongBtn.innerHTML = `${iconSvg("x", 14)}Didn't know it`;
  gradeRightBtn.innerHTML = `${iconSvg("check", 14)}Knew it`;
}
populateIcons();

// ---------- Data ----------

function loadWords() {
  chrome.storage.local.get({ sanojaWords: {} }, ({ sanojaWords }) => {
    let needsMigration = false;
    Object.values(sanojaWords).forEach((w) => {
      if (!w.box) {
        w.box = 1;
        needsMigration = true;
      }
      if (!w.nextReview) {
        w.nextReview = w.firstSeen || new Date().toISOString();
        needsMigration = true;
      }
    });
    allWords = Object.entries(sanojaWords).map(([key, v]) => ({ key, ...v }));

    if (needsMigration) {
      chrome.storage.local.set({ sanojaWords });
    }
    render();
  });
}

function getFiltered() {
  const term = searchEl.value.trim().toLowerCase();
  let list = getActiveWords(); // words you're still learning — mastered ones have their own section
  if (term) {
    list = list.filter(
      (w) => w.finnish.toLowerCase().includes(term) || w.english.toLowerCase().includes(term)
    );
  }
  const sortBy = sortByEl.value;
  list = [...list];
  if (sortBy === "count") {
    list.sort((a, b) => b.count - a.count);
  } else if (sortBy === "az") {
    list.sort((a, b) => a.finnish.localeCompare(b.finnish));
  } else {
    list.sort((a, b) => new Date(b.lastSeen) - new Date(a.lastSeen));
  }
  return list;
}

function getActiveWords() {
  return allWords.filter((w) => !w.mastered);
}

function getMasteredWords() {
  return allWords.filter((w) => w.mastered);
}

function getDueWords() {
  const now = new Date();
  return allWords.filter((w) => !w.mastered && new Date(w.nextReview) <= now);
}

function formatDate(iso) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// ---------- Top-level render ----------

function render() {
  const masteredCount = getMasteredWords().length;
  chrome.storage.local.get({ sanojaStreak: null }, ({ sanojaStreak }) => {
    const streakBadge =
      sanojaStreak && sanojaStreak.count > 0
        ? `<span class="streak">${iconSvg("flame", 13)}${sanojaStreak.count} day streak</span>`
        : "";
    // Leads with what you've learned, not a backlog count — a "3 known" is
    // something to feel good about; a "12 due" just reads as a to-do pile.
    statLine.innerHTML =
      `${allWords.length} word${allWords.length === 1 ? "" : "s"}` +
      (masteredCount > 0 ? ` · ${masteredCount} known` : "") +
      streakBadge;
  });

  const multiWordCount = getMultiWordEntries().length;
  cleanupBtn.hidden = multiWordCount === 0;
  cleanupBtn.innerHTML = `${iconSvg("trash", 15)}Clean up sentences (${multiWordCount})`;

  renderWordsSection();
  renderMasteredSection();
  renderPracticeIntro();
}

function setSegment(segment) {
  segPractice.classList.toggle("active", segment === "practice");
  segWords.classList.toggle("active", segment === "words");
  practiceSection.classList.toggle("active", segment === "practice");
  wordsSection.classList.toggle("active", segment === "words");
}

function renderWordsSection() {
  const filtered = getFiltered();
  const hasAny = allWords.length > 0;
  emptyState.hidden = hasAny;
  listView.hidden = !hasAny || subView !== "list";
  cloudView.hidden = !hasAny || subView !== "cloud";

  if (!hasAny) {
    pagination.hidden = true;
    return;
  }
  if (subView === "list") {
    renderList(filtered);
  } else {
    pagination.hidden = true;
    renderCloud(filtered);
  }
}

// Words that graduated out of the active pool — kept visible but tucked
// behind a collapsed <details> so they don't compete with what's still
// being learned.
function renderMasteredSection() {
  const mastered = getMasteredWords();
  masteredDetails.hidden = mastered.length === 0;
  if (!mastered.length) return;

  masteredSummary.innerHTML =
    `${iconSvg("check", 14)}${mastered.length} word${mastered.length === 1 ? "" : "s"} you know well`;

  masteredList.textContent = "";
  mastered
    .slice()
    .sort((a, b) => new Date(b.masteredAt || b.lastSeen) - new Date(a.masteredAt || a.lastSeen))
    .forEach((w) => {
      const row = document.createElement("div");
      row.className = "mastered-row";

      const text = document.createElement("div");
      text.className = "mastered-word-text";
      const finSpan = document.createElement("span");
      finSpan.className = "mastered-finnish";
      finSpan.textContent = w.finnish;
      const enSpan = document.createElement("span");
      enSpan.className = "mastered-english";
      enSpan.textContent = w.english;
      text.append(finSpan, enSpan);

      const actions = document.createElement("div");
      actions.className = "mastered-actions";

      const practiceBtn = document.createElement("button");
      practiceBtn.className = "icon-btn";
      practiceBtn.innerHTML = iconSvg("book", 14);
      practiceBtn.setAttribute("aria-label", `Practice ${w.finnish} again`);
      practiceBtn.addEventListener("click", () => unmasterWord(w.key));

      const delBtn = document.createElement("button");
      delBtn.className = "delete-btn";
      delBtn.innerHTML = iconSvg("x", 13);
      delBtn.setAttribute("aria-label", `Remove ${w.finnish}`);
      delBtn.addEventListener("click", () => deleteWord(w.key));

      actions.append(practiceBtn, delBtn);
      row.append(text, actions);
      masteredList.appendChild(row);
    });
}

// Puts a mastered word back into active review, starting from box 1 —
// same as getting a card wrong, so it's treated like relearning it.
function unmasterWord(key) {
  chrome.storage.local.get({ sanojaWords: {} }, ({ sanojaWords }) => {
    const entry = sanojaWords[key];
    if (!entry) return;
    entry.mastered = false;
    entry.box = 1;
    entry.nextReview = new Date().toISOString();
    delete entry.masteredAt;
    sanojaWords[key] = entry;
    chrome.storage.local.set({ sanojaWords }, loadWords);
  });
}

function renderList(words) {
  listBody.textContent = "";

  const totalPages = Math.max(1, Math.ceil(words.length / LIST_PAGE_SIZE));
  if (listPage > totalPages) listPage = totalPages; // e.g. after deleting words off the last page
  renderPagination(totalPages);

  const start = (listPage - 1) * LIST_PAGE_SIZE;
  words.slice(start, start + LIST_PAGE_SIZE).forEach((w) => {
    const tr = document.createElement("tr");

    const tdFi = document.createElement("td");
    tdFi.className = "finnish";
    tdFi.textContent = w.finnish;

    const tdEn = document.createElement("td");
    tdEn.textContent = w.english;

    const tdCount = document.createElement("td");
    tdCount.className = "count";
    tdCount.textContent = String(w.count);

    const tdBox = document.createElement("td");
    tdBox.className = "box";
    const boxNum = w.box || 1;
    const boxTip = document.createElement("span");
    const boxBadge = document.createElement("span");
    boxBadge.className = `box-badge box-${boxNum}`;
    boxBadge.textContent = boxNum;
    boxTip.appendChild(boxBadge);
    initTooltip(boxTip, boxDescription(boxNum));
    tdBox.appendChild(boxTip);

    const tdLast = document.createElement("td");
    tdLast.className = "lastseen";
    tdLast.textContent = formatDate(w.lastSeen);

    const tdDel = document.createElement("td");
    const delBtn = document.createElement("button");
    delBtn.className = "delete-btn";
    delBtn.innerHTML = iconSvg("x", 13);
    delBtn.setAttribute("aria-label", `Remove ${w.finnish}`);
    delBtn.addEventListener("click", () => deleteWord(w.key));
    tdDel.appendChild(delBtn);

    tr.append(tdFi, tdEn, tdCount, tdBox, tdLast, tdDel);
    listBody.appendChild(tr);
  });
}

// Numbered page buttons, windowed around the current page (first, last,
// and a couple neighbors) with "…" gaps so a huge word list doesn't turn
// into a huge row of page buttons.
function renderPagination(totalPages) {
  pagination.hidden = totalPages <= 1;
  pagination.textContent = "";
  if (totalPages <= 1) return;

  const goTo = (page) => {
    listPage = page;
    renderWordsSection();
  };

  const addButton = (label, page, { disabled = false, active = false } = {}) => {
    const btn = document.createElement("button");
    btn.className = "page-btn" + (active ? " active" : "");
    btn.textContent = label;
    btn.disabled = disabled;
    if (!disabled && !active) btn.addEventListener("click", () => goTo(page));
    pagination.appendChild(btn);
  };

  addButton("‹", listPage - 1, { disabled: listPage === 1 });

  const shown = new Set([1, totalPages, listPage - 1, listPage, listPage + 1]);
  let lastShown = 0;
  [...shown]
    .filter((p) => p >= 1 && p <= totalPages)
    .sort((a, b) => a - b)
    .forEach((p) => {
      if (lastShown && p - lastShown > 1) {
        const gap = document.createElement("span");
        gap.className = "page-gap";
        gap.textContent = "…";
        pagination.appendChild(gap);
      }
      addButton(String(p), p, { active: p === listPage });
      lastShown = p;
    });

  addButton("›", listPage + 1, { disabled: listPage === totalPages });
}

function renderCloud(words) {
  cloudView.textContent = "";
  const maxCount = Math.max(...words.map((w) => w.count), 1);
  const steps = isDarkMode ? DARK_STEPS : LIGHT_STEPS;

  // Shuffle slightly so the cloud doesn't just read as a sorted list.
  const shuffled = [...words].sort(() => Math.random() - 0.5);

  shuffled.forEach((w) => {
    const ratio = w.count / maxCount;
    const tier = Math.min(steps.length - 1, Math.floor(ratio * steps.length));
    const size = 14 + ratio * 28; // 14px .. 42px

    const span = document.createElement("span");
    span.className = "cloud-word";
    span.textContent = w.finnish;
    span.style.fontSize = `${size.toFixed(1)}px`;
    span.style.color = steps[tier];
    span.title = `${w.english} — seen ${w.count}×`;
    cloudView.appendChild(span);
  });
}

function deleteWord(key) {
  chrome.storage.local.get({ sanojaWords: {} }, ({ sanojaWords }) => {
    delete sanojaWords[key];
    chrome.storage.local.set({ sanojaWords }, loadWords);
  });
}

// Entries saved before the single-word fix may contain whole phrases/sentences.
function getMultiWordEntries() {
  return allWords.filter((w) => /\s/.test(w.finnish.trim()));
}

function cleanupSentences() {
  const bad = getMultiWordEntries();
  if (!bad.length) return;
  const ok = window.confirm(
    `Remove ${bad.length} multi-word entr${bad.length === 1 ? "y" : "ies"} (full phrases or ` +
    `sentences that got saved before this was fixed)? Single words are untouched.`
  );
  if (!ok) return;
  chrome.storage.local.get({ sanojaWords: {} }, ({ sanojaWords }) => {
    bad.forEach((w) => delete sanojaWords[w.key]);
    chrome.storage.local.set({ sanojaWords }, loadWords);
  });
}

function exportCsv() {
  const rows = [["finnish", "english", "count", "first_seen", "last_seen", "box", "next_review"]];
  getFiltered().forEach((w) => {
    rows.push([w.finnish, w.english, w.count, w.firstSeen, w.lastSeen, w.box, w.nextReview]);
  });
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "sanoja-words.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ---------- Practice / Quiz ----------

// Rotated instead of fixed so the intro card doesn't go stale on daily use —
// picked fresh each render (page load, tab switch back from a finished
// session, etc.). Each one is a template so the real due count is still
// front and center, not traded away for the sake of sounding lively.
const DUE_MODE_DESCRIPTIONS = [
  (n) => `Catch ${n === 1 ? "your weakest word" : `your ${n} weakest words`} before ${n === 1 ? "it slips" : "they slip"}.`,
  (n) => `${n} weakest word${n === 1 ? "" : "s"}, ready for a rematch.`,
  (n) => `${n} word${n === 1 ? "" : "s"} to conquer today.`,
];

function renderPracticeIntro() {
  quizCard.hidden = true;
  quizDone.hidden = true;
  quizIntro.hidden = false;
  const due = getDueWords();
  const active = getActiveWords();
  // Both cards already say "Nothing saved yet" when empty — a top line that
  // still says "choose a mode" on top of that is a third way of saying
  // there's nothing here instead of one clear one.
  dueText.textContent =
    due.length === 0 && active.length === 0 ? "Nothing saved yet." : "Choose a mode to practice.";

  if (due.length === 0) {
    startDueBtn.disabled = true;
    dueModeTag.hidden = true;
    if (active.length === 0) {
      dueModeDesc.textContent = "Nothing saved yet.";
    } else {
      const nextReviewDates = active
        .map((w) => new Date(w.nextReview || w.lastSeen || new Date()))
        .filter((d) => d > new Date());
      if (nextReviewDates.length > 0) {
        const earliest = new Date(Math.min(...nextReviewDates.map((d) => d.getTime())));
        const daysUntil = Math.ceil((earliest - new Date()) / (24 * 60 * 60 * 1000));
        // "Next word" undersold this — whatever becomes due on that day
        // could be one word or a whole cluster (same cause as the due-queue
        // batch cap: a bunch of words added together all come due together).
        // Count and, past the cap, say so the same way the "due now" and
        // free-practice descriptions already do.
        const countThen = nextReviewDates.filter(
          (d) => d.toDateString() === earliest.toDateString()
        ).length;
        const when = daysUntil === 0 ? "later today" : daysUntil === 1 ? "tomorrow" : `in ${daysUntil} days`;
        const capNote = countThen > PRACTICE_BATCH_SIZE ? `, in rounds of ${PRACTICE_BATCH_SIZE}` : "";
        dueModeDesc.textContent = `${countThen} word${countThen === 1 ? "" : "s"} ready ${when}${capNote}.`;
      } else {
        dueModeDesc.textContent = "Nothing due right now — nice work.";
      }
    }
  } else {
    startDueBtn.disabled = false;
    dueModeTag.hidden = false;
    // Only spend the description on the batch-cap warning when it's
    // actually true — no reason to bring up rounds of 20 for a 3-word day.
    dueModeDesc.textContent =
      due.length > PRACTICE_BATCH_SIZE
        ? `First ${PRACTICE_BATCH_SIZE} of ${due.length} today — more after.`
        : DUE_MODE_DESCRIPTIONS[Math.floor(Math.random() * DUE_MODE_DESCRIPTIONS.length)](due.length);
  }

  if (active.length === 0) {
    startAllBtn.disabled = true;
    freeModeDesc.textContent = "Nothing saved yet.";
    freeModeTag.hidden = true;
  } else {
    startAllBtn.disabled = false;
    freeModeDesc.textContent =
      active.length > PRACTICE_BATCH_SIZE
        ? `${active.length} saved words, in rounds of ${PRACTICE_BATCH_SIZE}.`
        : `All ${active.length} saved word${active.length === 1 ? "" : "s"}.`;
    freeModeTag.hidden = false;
  }

  // Keep a manual pick if it's still valid (e.g. re-render from an unrelated
  // storage change while the intro is sitting there); otherwise fall back
  // to whichever mode actually has something to do.
  if (selectedMode === "due" && due.length === 0) selectedMode = null;
  if (selectedMode === "free" && active.length === 0) selectedMode = null;
  if (selectedMode === null) {
    selectedMode = due.length > 0 ? "due" : active.length > 0 ? "free" : null;
  }
  applySelection();
}

function applySelection() {
  const dueSelected = selectedMode === "due";
  const freeSelected = selectedMode === "free";
  startDueBtn.classList.toggle("selected", dueSelected);
  startDueBtn.setAttribute("aria-checked", String(dueSelected));
  startAllBtn.classList.toggle("selected", freeSelected);
  startAllBtn.setAttribute("aria-checked", String(freeSelected));

  startModeBtn.disabled = selectedMode === null;
  startModeBtn.textContent =
    selectedMode === "due"
      ? "Start Focused Practice"
      : selectedMode === "free"
      ? "Start Free Practice"
      : "Nothing to practice yet";
}

function selectMode(mode) {
  selectedMode = mode;
  applySelection();
}

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

function startQuiz(dueOnly) {
  const source = dueOnly ? getDueWords() : getActiveWords();
  if (!source.length) return;
  practicePoolSize = source.length;
  const shuffled = shuffle(source);
  const batch = shuffled.slice(0, PRACTICE_BATCH_SIZE);
  quizQueue = batch.map((w) => ({ ...w, requeued: false }));
  quizPracticeMode = !dueOnly;
  quizStats = { correct: 0, total: 0 };

  // The card itself carries the mode for the whole session — set once here
  // rather than per-card, since it can't change until the session restarts.
  flashCard.classList.toggle("graded", !quizPracticeMode);
  quizModeBadge.textContent = quizPracticeMode ? "Free Practice" : "Focused Practice";
  quizModeBadge.className = `mode-badge ${quizPracticeMode ? "practice" : "graded"}`;

  quizIntro.hidden = true;
  quizDone.hidden = true;
  quizCard.hidden = false;
  showCard();
}

function showCard() {
  if (quizQueue.length === 0) {
    finishQuiz();
    return;
  }
  const card = quizQueue[0];
  // The mode badge already names the mode, so this only needs the count.
  quizProgress.textContent = `${quizQueue.length} left`;
  quizFinnish.textContent = card.finnish;
  quizEnglish.textContent = card.english;
  quizAnswerBlock.hidden = true;
  quizRevealRow.hidden = false;
  quizGradeRow.hidden = true;

  // The quiz is a deliberate pronunciation-practice moment, so this speaks
  // every card automatically regardless of the general "Speak automatically"
  // setting (which only covers casual page lookups).
  speakFinnish(card.finnish);
}

function finishQuiz() {
  quizCard.hidden = true;
  quizDone.hidden = false;
  const { correct, total } = quizStats;
  const remaining = practicePoolSize - total;
  practiceMoreBtn.hidden = remaining <= 0;
  if (remaining > 0) {
    practiceMoreBtn.textContent = quizPracticeMode
      ? `Practice another ${Math.min(PRACTICE_BATCH_SIZE, remaining)}`
      : `Review ${Math.min(PRACTICE_BATCH_SIZE, remaining)} more`;
  }
  if (quizPracticeMode) {
    quizDoneText.textContent =
      remaining > 0
        ? `Done practicing ${total} of ${practicePoolSize} words.`
        : `Done practicing ${total} word${total === 1 ? "" : "s"}.`;
  } else {
    quizDoneText.textContent =
      remaining > 0
        ? `${correct}/${total} correct — ${remaining} more due.`
        : `Session complete — ${correct}/${total} correct.`;
    if (total > 0) updateStreak();
  }
  loadWords(); // refresh due counts / list in the background
}

// Leaving mid-session loses nothing: only *graded* cards affect the
// schedule, and those were already written to storage as they were graded.
// Whatever's still sitting in the queue is just dropped.
function exitQuiz() {
  quizQueue = [];
  loadWords(); // refreshes due counts to reflect any cards graded before exiting, then re-renders the intro
}

function gradeCard(known) {
  const card = quizQueue[0];
  flashCard.classList.add("card-exit");

  setTimeout(() => {
    quizQueue.shift();
    quizStats.total += 1;
    if (known) quizStats.correct += 1;

    if (!quizPracticeMode) {
      updateSchedule(card.key, known);
    }

    if (!known && !card.requeued) {
      // Show missed cards again before the session ends.
      card.requeued = true;
      quizQueue.push(card);
    }

    showCard();
    flashCard.classList.remove("card-exit");
  }, 150);
}

function updateSchedule(key, known) {
  chrome.storage.local.get({ sanojaWords: {} }, ({ sanojaWords }) => {
    const entry = sanojaWords[key];
    if (!entry) return;
    const now = new Date();
    const wasAtMaxBox = (entry.box || 1) >= MAX_BOX;

    if (known && wasAtMaxBox) {
      // Correct again after already reaching the top box — this word is
      // learned. Graduate it out of the review pool instead of just
      // rescheduling it further out forever.
      entry.mastered = true;
      entry.masteredAt = now.toISOString();
      sanojaWords[key] = entry;
      chrome.storage.local.set({ sanojaWords });
      return;
    }

    if (known) {
      entry.box = Math.min(MAX_BOX, (entry.box || 1) + 1);
    } else {
      entry.box = 1;
    }
    const days = BOX_INTERVAL_DAYS[entry.box] || 1;
    const next = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    entry.nextReview = next.toISOString();
    sanojaWords[key] = entry;
    chrome.storage.local.set({ sanojaWords });
  });
}

// A day is only "kept" if you finish at least one real (non-practice-all) due
// session on it; skip a calendar day entirely and the streak resets to 1.
function updateStreak() {
  chrome.storage.local.get({ sanojaStreak: null }, ({ sanojaStreak }) => {
    const todayStr = new Date().toISOString().slice(0, 10);
    if (sanojaStreak && sanojaStreak.lastPracticeDate === todayStr) {
      return; // already counted today
    }
    const yesterdayStr = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const next =
      sanojaStreak && sanojaStreak.lastPracticeDate === yesterdayStr
        ? { count: sanojaStreak.count + 1, lastPracticeDate: todayStr }
        : { count: 1, lastPracticeDate: todayStr };
    chrome.storage.local.set({ sanojaStreak: next });
  });
}

// Chrome's voice list loads asynchronously — speaking before it's ready
// means there's nothing to match "fi-FI" against, so the browser falls back
// to a generic default that can sound broken on Finnish text. Waiting for
// the real list once (and caching it) avoids that first-call glitch.
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
    setTimeout(() => {
      window.speechSynthesis.removeEventListener("voiceschanged", onVoicesChanged);
      resolve(window.speechSynthesis.getVoices() || []);
    }, 1000);
  });
  return voicesReadyPromise;
}

// Exact locale match first, then same-language-any-region matched on the
// "fi-" boundary (not a bare startsWith("fi"), which is what previously
// matched Filipino "fil-PH" by mistake).
function pickFinnishVoice(voices) {
  return (
    voices.find((v) => v.lang && v.lang.toLowerCase() === "fi-fi") ||
    voices.find((v) => v.lang && v.lang.toLowerCase().startsWith("fi-")) ||
    voices.find((v) => v.lang && v.lang.toLowerCase() === "fi") ||
    null
  );
}

async function speakFinnish(text) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const voices = await ensureVoicesLoaded();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "fi-FI";
  const voice = pickFinnishVoice(voices);
  if (voice) utterance.voice = voice;
  utterance.rate = 0.92;
  window.speechSynthesis.speak(utterance);
}

// ---------- Wiring ----------

searchEl.addEventListener("input", () => {
  listPage = 1; // a new search is a new list — start back at the top of it
  renderWordsSection();
});
sortByEl.addEventListener("change", () => {
  listPage = 1;
  renderWordsSection();
});

segPractice.addEventListener("click", () => setSegment("practice"));
segWords.addEventListener("click", () => setSegment("words"));

subList.addEventListener("click", () => {
  subView = "list";
  subList.classList.add("active");
  subCloud.classList.remove("active");
  renderWordsSection();
});
subCloud.addEventListener("click", () => {
  subView = "cloud";
  subCloud.classList.add("active");
  subList.classList.remove("active");
  renderWordsSection();
});

moreBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  moreMenu.hidden = !moreMenu.hidden;
});
document.addEventListener("click", (e) => {
  if (!moreMenu.hidden && !moreMenu.contains(e.target) && e.target !== moreBtn) {
    moreMenu.hidden = true;
  }
});

exportBtn.addEventListener("click", () => {
  exportCsv();
  moreMenu.hidden = true;
});
cleanupBtn.addEventListener("click", () => {
  cleanupSentences();
  moreMenu.hidden = true;
});
clearBtn.addEventListener("click", () => {
  moreMenu.hidden = true;
  if (!allWords.length) return;
  const ok = window.confirm(`Delete all ${allWords.length} saved words? This can't be undone.`);
  if (ok) {
    chrome.storage.local.set({ sanojaWords: {} }, loadWords);
  }
});

exitQuizBtn.addEventListener("click", exitQuiz);
startDueBtn.addEventListener("click", () => selectMode("due"));
startAllBtn.addEventListener("click", () => selectMode("free"));
startModeBtn.addEventListener("click", () => {
  if (selectedMode) startQuiz(selectedMode === "due");
});

// role="radio" on two real <button>s implies the native radiogroup
// interaction — arrow keys move the selection, not just Tab+Enter. With
// only two options, any arrow key means "the other one".
document.querySelector(".mode-grid").addEventListener("keydown", (e) => {
  if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
  const other = document.activeElement === startDueBtn ? startAllBtn : startDueBtn;
  if (other.disabled) return;
  e.preventDefault();
  selectMode(other === startDueBtn ? "due" : "free");
  other.focus();
});
showAnswerBtn.addEventListener("click", () => {
  quizAnswerBlock.hidden = false;
  quizRevealRow.hidden = true;
  quizGradeRow.hidden = false;
});
gradeWrongBtn.addEventListener("click", () => gradeCard(false));
gradeRightBtn.addEventListener("click", () => gradeCard(true));
quizSpeakBtn.addEventListener("click", () => speakFinnish(quizFinnish.textContent));
quizAgainBtn.addEventListener("click", () => {
  quizDone.hidden = true;
  renderPracticeIntro();
});

// Continue in whatever mode the session was actually in — a due-review
// session that gets batched should stay graded across batches, not drop
// into ungraded free practice for its later batches.
practiceMoreBtn.addEventListener("click", () => startQuiz(!quizPracticeMode));

// ---------- Init ----------

chrome.storage.local.get({ sanojaWords: {} }, ({ sanojaWords }) => {
  const now = new Date();
  const dueCount = Object.values(sanojaWords).filter(
    (w) => !w.mastered && (!w.nextReview || new Date(w.nextReview) <= now)
  ).length;
  setSegment(dueCount > 0 ? "practice" : "words");
  loadWords();
});
