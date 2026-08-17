# Chrome Web Store listing copy

Copy-paste these into the corresponding fields in the Developer Dashboard
when you submit (chrome.google.com/webstore/devconsole).

## Extension name
Sanoja - Read Words in Finnish

## Summary (short description, 132 characters max — this one is 117)
Select or double-click any word on the web to translate it between English and Finnish, hear it, and review it later.

## Category
Education

## Language
English

## Detailed description

Sanoja turns the pages you're already reading into Finnish practice.

Select or double-click a word or short phrase on any webpage. If it's
English, you'll see it in Finnish; if it's Finnish, you'll see it in
English — detected automatically, no language picker needed. Click the
speaker icon to hear the Finnish pronunciation.

Every word you look up is saved automatically into a word log, so you can
come back and actually learn it instead of just glancing at a translation
and moving on:

- Spaced-repetition quiz (a Leitner box system) — get a word right and it
  comes back in a few days, then a week, then a couple weeks, then a
  month; get it wrong and it comes back tomorrow.
- Get a word right consistently and it graduates to a "known words"
  section, separate from what you're still actively learning.
- A word list and word-cloud view of everything you've saved, searchable
  and sortable.
- A daily streak for finishing your reviews.

No accounts, no ads, no tracking. Your word list and progress are saved
locally in your browser and never leave your computer — the only network
request Sanoja makes is the translation lookup itself, and only for text
you explicitly select. Full privacy policy:
<PASTE YOUR PRIVACY POLICY URL HERE — see PUBLISHING.md>

Built for one language pair on purpose: English and Finnish, both
directions, nothing else.

## Permission justifications (paste into the relevant CWS review fields)

**storage** — Used to save your looked-up words, review schedule, quiz
history, and the two on/off settings, all locally on your device.

**Host permission for translate.googleapis.com** — Used to send the exact
text you select to Google's translation endpoint and get back a
translation. This is the only network request the extension makes.

**Content script on all pages (`<all_urls>`)** — Needed so the
select-a-word popup can appear on any webpage you're reading, since there's
no way to know in advance which pages you'll want to look up a word on.
The script only activates on text you explicitly select or double-click; it
does not read or transmit page content on its own.

## Single purpose description
Sanoja looks up the translation of a word or phrase you select on any
webpage, between English and Finnish, and helps you review words you've
looked up using spaced repetition.
