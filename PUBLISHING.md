# Publishing Sanoja

Two separate things, in the order that makes the second one easier: push
the code to GitHub first, then submit to the Chrome Web Store (it wants a
privacy policy URL, and the GitHub repo gives you one for free).

## 1. Push to GitHub

You have git installed already (checked: git 2.34.1). No `gh` CLI, so
we'll create the repo on github.com and push from Terminal.

**Create the repo:**

1. Go to https://github.com/new
2. Repository name: `sanoja-finnish-word-reader` (or whatever you prefer)
3. Visibility: **Public**
4. Do **not** check "Add a README" / .gitignore / license — this folder
   already has all of that. Click **Create repository**.
5. GitHub will show you a repo URL like
   `https://github.com/<your-username>/sanoja-finnish-word-reader.git` —
   copy it.

**Push from Terminal:**

```bash
cd ~/Desktop/sanoja-finnish-word-reader

# Optional but recommended — set your identity for this repo specifically
# (use your GitHub "noreply" email if you'd rather not expose your real
# one publicly — Settings → Emails on github.com has it):
git config user.name "Your Name"
git config user.email "you@example.com"

git init
git add -A
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<your-username>/sanoja-finnish-word-reader.git
git push -u origin main
```

That's it — refresh the GitHub page and your code, README, and screenshots
should all be there.

Your privacy policy is now live at:
`https://github.com/<your-username>/sanoja-finnish-word-reader/blob/main/PRIVACY.md`
— GitHub renders it as a normal readable page. You'll need this URL for
the Chrome Web Store submission below.

## 2. Publish to the Chrome Web Store

### Register as a developer (one-time)

1. Go to https://chrome.google.com/webstore/devconsole
2. Sign in with the Google account you want to publish under.
3. Pay the one-time $5 registration fee (only you can do this step).
4. Accept the developer agreement.

### Submit the extension

1. In the dashboard, click **New Item**.
2. Upload `sanoja-cws-submission.zip` (in this folder — it's the lean
   extension package, without the docs/screenshots/license that are in
   the full folder for GitHub).
3. Fill in the store listing using the copy already written for you in
   `store-assets/STORE_LISTING.md` — name, summary, description,
   category. Just copy-paste each field.
4. Upload the four images in `store-assets/` as your screenshots.
5. **Privacy practices tab**: paste your GitHub privacy policy URL from
   step 1 above. Use the permission justification text from
   `store-assets/STORE_LISTING.md` for the storage / host permission /
   content script fields it asks you to justify.
6. **Distribution**: choose Public (or Unlisted, if you'd rather it only
   be reachable by direct link — either works, your call).
7. Click **Submit for review**.

Review typically takes anywhere from a few hours to a few days for a
straightforward extension like this one. You'll get an email when it's
approved (or if they need something changed — permission justifications
are the most common thing reviewers ask about, which is why they're
already written out for you above).

### After it's approved

Once it's live, you can update `README.md`'s install section with a link
to the actual Chrome Web Store listing instead of the "load unpacked"
instructions, if you want people to install it the easy way.
