// Sequential blue ramp, from the shared palette reference (light surface: #fcfcfb, dark surface: #1a1a19).
// Trimmed to steps with enough contrast to stand alone as text (skips the near-surface steps
// meant for heatmap fills), ordered least -> most frequent.
const LIGHT_STEPS = ["#5598e7", "#3987e5", "#2a78d6", "#1c5cab", "#104281"];
const DARK_STEPS = ["#2a78d6", "#3987e5", "#5598e7", "#86b6ef", "#cde2fb"];
const isDarkMode = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;

// Leitner box -> days until next review.
const BOX_INTERVAL_DAYS = { 1: 1, 2: 3, 3: 7, 4: 14, 5: 30 };
const MAX_BOX = 5;

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
const cloudView = document.getElementById("cloudView");
const masteredDetails = document.getElementById("masteredDetails");
const masteredSummary = document.getElementById("masteredSummary");
const masteredList = document.getElementById("masteredList");

const quizIntro = document.getElementById("quizIntro");
const dueText = document.getElementById("dueText");
const startDueBtn = document.getElementById("startDueBtn");
const startAllBtn = document.getElementById("startAllBtn");
const quizCard = document.getElementById("quizCard");
const exitQuizBtn = document.getElementById("exitQuizBtn");
const flashCard = document.getElementById("flashCard");
const quizProgress = document.getElementById("quizProgress");
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

let allWords = []; // [{ key, finnish, english, count, firstSeen, lastSeen, box, nextReview }]
let subView = "list"; // 'list' | 'cloud', within the Words section

// Quiz session state
let quizQueue = [];
let quizPracticeMode = false;
let quizStats = { correct: 0, total: 0 };

// ---------- Icons ----------

function populateIcons() {
  segPractice.innerHTML = `${iconSvg("book", 15)}Practice`;
  segWords.innerHTML = `${iconSvg("list", 15)}Words`;
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

  renderReadyDot();
  renderWordsSection();
  renderMasteredSection();
  renderPracticeIntro();
}

// A quiet dot on the Practice tab — not a number — hinting there's something
// ready without turning it into a countdown/backlog.
function renderReadyDot() {
  const hasReady = getDueWords().length > 0;
  segPractice.innerHTML = `${iconSvg("book", 15)}Practice` + (hasReady ? '<span class="ready-dot"></span>' : "");
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

  if (!hasAny) return;
  if (subView === "list") {
    renderList(filtered);
  } else {
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
  words.forEach((w) => {
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
    const boxBadge = document.createElement("span");
    boxBadge.className = `box-badge box-${boxNum}`;
    boxBadge.textContent = boxNum;
    tdBox.appendChild(boxBadge);

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

function renderPracticeIntro() {
  quizCard.hidden = true;
  quizDone.hidden = true;
  quizIntro.hidden = false;

  // Deliberately no count here — "12 words due" reads like a backlog. Just a
  // yes/no on whether there's something ready.
  const due = getDueWords();
  if (due.length === 0) {
    // Show when the next word will be ready
    const active = getActiveWords();
    if (active.length === 0) {
      dueText.textContent = "Nothing to review right now — nice work.";
    } else {
      const nextReviewDates = active
        .map((w) => new Date(w.nextReview || w.lastSeen || new Date()))
        .filter((d) => d > new Date());
      if (nextReviewDates.length > 0) {
        const earliest = new Date(Math.min(...nextReviewDates.map((d) => d.getTime())));
        const daysUntil = Math.ceil((earliest - new Date()) / (24 * 60 * 60 * 1000));
        if (daysUntil === 0) {
          // Due today but might not have been fetched yet, or due in < 1 hour
          dueText.textContent = "Next word available soon — check back later today.";
        } else if (daysUntil === 1) {
          dueText.textContent = "Next word available tomorrow.";
        } else {
          dueText.textContent = `Next word available in ${daysUntil} days.`;
        }
      } else {
        dueText.textContent = "Nothing to review right now — nice work.";
      }
    }
    startDueBtn.hidden = true;
  } else {
    dueText.textContent = "A few words are ready to review.";
    startDueBtn.hidden = false;
    startDueBtn.innerHTML = `${iconSvg("book", 15)}Start reviewing`;
  }
}

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

function startQuiz(dueOnly) {
  const source = dueOnly ? getDueWords() : getActiveWords();
  if (!source.length) return;
  quizQueue = shuffle(source).map((w) => ({ ...w, requeued: false }));
  quizPracticeMode = !dueOnly;
  quizStats = { correct: 0, total: 0 };

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
  quizProgress.textContent = quizPracticeMode
    ? `Practicing · ${quizQueue.length} left`
    : `${quizQueue.length} left`;
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
  if (quizPracticeMode) {
    quizDoneText.textContent = `Done practicing ${total} word${total === 1 ? "" : "s"}.`;
  } else {
    quizDoneText.textContent = `Session complete — ${correct}/${total} correct.`;
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

searchEl.addEventListener("input", renderWordsSection);
sortByEl.addEventListener("change", renderWordsSection);

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
startDueBtn.addEventListener("click", () => startQuiz(true));
startAllBtn.addEventListener("click", () => startQuiz(false));
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

// ---------- Init ----------

chrome.storage.local.get({ sanojaWords: {} }, ({ sanojaWords }) => {
  const now = new Date();
  const dueCount = Object.values(sanojaWords).filter(
    (w) => !w.mastered && (!w.nextReview || new Date(w.nextReview) <= now)
  ).length;
  setSegment(dueCount > 0 ? "practice" : "words");
  loadWords();
});
