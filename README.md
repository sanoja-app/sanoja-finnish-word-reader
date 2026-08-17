# Sanoja — English ↔ Finnish word lookup

A tiny Chrome/Edge extension. Select or double-click any word (or short phrase)
on any webpage. If it's English, you'll see it in Finnish; if it's Finnish,
you'll see it in English — detected automatically, no language picker needed.
Click the speaker icon to hear the Finnish word spoken aloud.

## How to install (unpacked, for testing)

1. Unzip this folder somewhere permanent (don't delete it after installing —
   Chrome loads the extension directly from these files).
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select this folder.
5. Pin the extension (puzzle-piece icon in the toolbar → pin "Sanoja") so you
   can quickly open its popup to toggle it on/off or turn on auto-speak.

## How to use

- Double-click a word on any page, or highlight a short phrase, and a card
  pops up labeled with the source language and the translation — English word
  selected shows Finnish, Finnish word selected shows English.
- Click the 🔊 button in the card to hear the Finnish side spoken aloud —
  always Finnish, whether that's the word you selected or its translation,
  since the audio is there to help with Finnish pronunciation specifically.
  It doesn't speak automatically by default — turn that on from the toolbar
  popup if you want it.
- Click anywhere else, scroll, or press Escape to dismiss the card.
- Open the extension's toolbar icon to turn the extension off, or turn
  "Speak automatically" on.
- Every word you look up is saved automatically. Click "Practice" / "Browse
  words" in the toolbar popup to open your word log, which is built around
  two views: **Practice** (the quiz) and **Words** (a list, with a toggle
  for a word-cloud view — bigger word = you've looked it up more often). It
  opens straight into Practice whenever something's ready to review, since
  that's the point of the tool; otherwise it opens on Words. Neither the
  popup nor the word log shows a due-count number anywhere — just a small
  dot on the Practice tab when something's ready, and a plain sentence
  ("A few words are ready to review" / "Nothing to review right now — nice
  work") instead of a "12 due" backlog counter.
- The quiz uses spaced repetition (a Leitner box system): get a word right
  and it comes back in 3 days, then a week, then two weeks, then a month;
  get it wrong and it resets to review again tomorrow — and you'll see it
  again before the current session ends. "Practice all words" runs an
  untimed session through everything you've saved without affecting that
  schedule, for casual review any time nothing's due yet. Finishing a real
  (non-practice-all) session on a new day builds a streak, shown next to the
  word count — skip a day and it resets.
- Get a word right twice in a row once it's reached the top box, and it
  graduates to **known** — it stops coming up for review and moves into a
  collapsed "N words you know well" section at the bottom of the Words view,
  separate from the words you're still actively learning. The header stat
  line reflects this too ("6 words · 2 known" instead of a due count). If
  you want a known word back in rotation, expand that section and hit its
  book icon to send it back to review from the start; the × next to it
  deletes it entirely, same as any other word.
- Search, sort, export, and delete all live in the Words view; less-common
  actions (Export CSV, Clean up sentences, Clear all) are tucked behind the
  "•••" menu instead of sitting on-screen permanently.

## About the voice

There's deliberately no voice picker — Sanoja just tells the browser "speak
this in Finnish" or "speak this in English" and lets your operating system
use its own default voice for that language. Simple and predictable, but it
means voice quality is entirely up to what's installed on your computer.

Two related things that used to happen occasionally and are now fixed:
short, ambiguous words (like "on" — a common English word that's also a very
common Finnish one) could get mis-identified and spoken in the wrong
language; and the very first word spoken on a freshly loaded page could come
out broken/garbled because the browser's voice list hadn't finished loading
yet. Longer, unambiguous words were never affected by the first issue.

If it still sounds robotic or off, that's the OS voice itself, not the
extension, and the fix lives at the OS level:

- **macOS**: System Settings → Accessibility → Spoken Content → System Voice
  → Manage Voices… → search "Finnish" → if an Enhanced or Premium quality
  option is offered, download it. Restart Chrome afterward. This replaces
  the system default, so Sanoja picks it up automatically — no extension
  changes needed.
- **Windows**: Settings → Time & Language → Speech → Manage voices → Add
  voices → Finnish.

If Finnish only has one basic voice available with no higher-quality option
to download, that's a real ceiling on this OS/version — the only way past it
would be switching to a cloud text-to-speech API instead of the browser's
built-in voice, which is a bigger change (needs an API key) and isn't
something this build does.

## Notes / limitations (read before relying on this)

- **Translation source**: this uses Google Translate's public web endpoint
  (the same one translate.google.com's website itself calls) rather than a
  paid API, so there's no API key or cost — but it's an unofficial endpoint
  Google could rate-limit or change without notice. If translations suddenly
  stop working, that's the likely cause.
- **Pronunciation**: uses your browser/OS's built-in text-to-speech
  (`speechSynthesis`) with whichever default voice your system has for
  English or Finnish — no picker, no manual voice selection. Quality depends
  entirely on what's installed on your system; see "About the voice" above.
- **Word log**: saved locally in the browser's extension storage on this
  computer only — it doesn't sync to other devices or upload anywhere.
- **Desktop only, for now**: this is a Chrome extension, and Chrome
  extension APIs don't run in Chrome/Safari on iOS or in Chrome on Android
  the same way — it works on desktop Chrome/Edge/Brave. A mobile version
  would need a different approach (e.g. Kiwi Browser on Android supports
  Chrome extensions, or this could be rebuilt differently for mobile).
- If you haven't published this to the Chrome Web Store yet, this is a
  personal/unpacked install — if you want it on another computer, copy
  this folder over and repeat the install steps. See `PUBLISHING.md` for
  how to put it on the Web Store instead.

## Language pair

Locked to English ↔ Finnish only, on purpose — no language picker, no other
languages. Direction is auto-detected from whatever text you select.

## Privacy

See [`PRIVACY.md`](./PRIVACY.md) for exactly what data this extension
touches (short version: your word list stays on your computer, and the
only network request is the translation lookup itself).

## License

MIT — see [`LICENSE`](./LICENSE).
