# Privacy Policy — Sanoja

_Last updated: August 2026_

Sanoja is a small personal project for learning Finnish vocabulary while
browsing. This page explains exactly what it does and does not do with your
data.

## What Sanoja does

- When you select or double-click a word or short phrase on a webpage,
  that text is sent to Google's public translation service
  (`translate.googleapis.com`) to get a translation. This is the only
  network request Sanoja makes, and it only happens when you actively
  select text — Sanoja never reads or transmits a page's content on its
  own.
- Words you look up, along with your review schedule, quiz history, and
  streak, are saved using Chrome's local extension storage
  (`chrome.storage.local`) on your own computer. This data is never
  uploaded to any server Sanoja controls — there isn't one.
- Your two toggle settings (enabled / speak automatically) are saved using
  `chrome.storage.sync`, which is Chrome's own built-in settings sync (the
  same mechanism used by e.g. your bookmarks, if you have Chrome sync
  turned on). This is handled entirely by Google's Chrome sync
  infrastructure, not by Sanoja.

## What Sanoja does not do

- No analytics, tracking, or telemetry of any kind.
- No accounts, sign-in, or user identifiers.
- No advertising.
- No data is sold, shared, or used for anything beyond showing you a
  translation and saving your word list locally.
- No data collection beyond the word/phrase you explicitly select for
  translation.

## Third-party services

The only third party involved is Google's translation endpoint, used
solely to translate the text you select. Its use is subject to
[Google's own privacy policy](https://policies.google.com/privacy). Sanoja
has no relationship with Google beyond calling this public endpoint.

## Permissions

- **storage** — to save your word list and settings locally, as described
  above.
- **Access to `translate.googleapis.com`** — to perform translations.
- **Content script on all pages** — to detect when you select or
  double-click a word so a translation popup can appear. It only acts on
  text you've explicitly selected.

## Contact

This is an independent personal project, not affiliated with Google or Yle.
For questions, open an issue on the GitHub repository this policy is
published alongside.
