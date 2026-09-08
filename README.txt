WATCH DIARY — installable web app
==================================

What's inside
--------------
index.html, app.js, data.js, manifest.json, sw.js, icon files.
Your existing diary (2,976 logged episodes) and show list (224 shows)
from Diary.xlsm are pre-loaded as the starting data.

All data lives in the browser's local storage on your phone — nothing
is sent anywhere. Use "Backup & data" inside the app (bottom of the
Stats tab) to export a .json backup occasionally, since clearing your
browser's data would clear the diary too.

To install it on your Android phone (2 minutes)
--------------------------------------------------
A Play Store app needs a paid developer account and a compiled build,
which isn't available in this environment — this is a "web app" you
install straight from Chrome instead, and it behaves the same way:
own icon, opens full-screen, works offline.

1. Put these files somewhere they can be opened over the web. Easiest
   free options, pick one:
     - GitHub Pages: create a new GitHub repo, upload this folder's
       contents to it, turn on Pages in the repo settings, then open
       the Pages URL on your phone.
     - Netlify Drop (app.netlify.com/drop): drag this folder in from
       a computer, it gives you a URL instantly, no account needed.
     - Any static host / your own server works too.
2. Open that URL in Chrome on your Android phone.
3. Tap the Chrome menu (⋮) → "Add to Home screen" → Install.
4. Open it from your home screen — it now runs like a normal app,
   works offline after the first load, and keeps your data locally.

Quick local test on this computer
-----------------------------------
From this folder: python3 -m http.server 8000, then open
http://localhost:8000 in a browser. (Add-to-home-screen won't trigger
on localhost from a phone, but a real host in step 1 above will.)
