# Arabic

A personal flashcard app for learning Modern Standard Arabic, starting with 100 core words (no particles or conjunctions yet).
Every word comes with full diacritics, transliteration, gender/plural or present-tense form, its root, and a sample sentence with a word-by-word breakdown.

## Use it

Download or clone the repo and open `index.html` in your browser. There is no server, account or build step.

- **Dashboard**: words learned, cards due today, streak, accuracy, progress per theme, trickiest words, settings and backup.
- **Study**: spaced-repetition flashcards that mix Arabic → English and English → Arabic.
  A new word is first shown Arabic → English; once you pass it, the English → Arabic card joins the deck.
  Rate each card *Again / Hard / Good / Easy* and the app schedules the next review.
- **Words**: all 100 words by theme, searchable; click one for its full card.

Keyboard: `Space` reveal · `1`–`4` rate · `P` listen · `T` transliteration (Arabic → English cards).

Top bar: **Show diacritics** hides or shows the vowel marks everywhere; the swatches change their colour.

## Progress

Progress is saved automatically in the browser you use (localStorage). It stays in that browser only,
so use **Export backup** on the dashboard now and then, and **Import** to restore it or move it to another device.
Clearing the browser’s site data erases it.

## Audio

“Listen” uses the browser’s built-in Arabic voice. macOS and iOS include one; on Windows, add Arabic under
Settings → Time & language → Speech if there is none.

## Files

- `index.html`, `styles.css` — page and look
- `js/words.js` — the 100 words, sentences and breakdowns (add new decks here)
- `js/app.js` — dashboard, study session, scheduling, storage

The diacritics are coloured by drawing two layers: the vowelled text in colour and the bare letters in black on top,
because browsers otherwise paint a mark in the same colour as its letter.
