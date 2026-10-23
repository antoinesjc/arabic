/* Arabic — personal flashcard app. Plain JS, no build step.
   Progress is saved in this browser (localStorage); use Export/Import on the dashboard to back it up. */
(function () {
  'use strict';

  // ─────────────────────────── Constants ───────────────────────────
  var STORE_KEY = 'arabic-app-v1';
  var DAY = 86400000;
  var COLORS = [
    { id: 'green', hex: '#2fa35a', name: 'Green' },
    { id: 'blue', hex: '#1f6feb', name: 'Blue' },
    { id: 'orange', hex: '#d9480f', name: 'Orange' },
    { id: 'purple', hex: '#8b3fd9', name: 'Purple' },
    { id: 'grey', hex: '#8a8a8a', name: 'Grey' }
  ];
  // Arabic combining marks: harakat, tanwin, shadda, sukun, superscript alef, Quranic marks
  var MARK = /[ؐ-ًؚ-ٰٟۖ-ۭ]/;
  var LEARNED_DAYS = 3; // a card counts as learned once its interval reaches this

  var WORDS = window.WORDS;
  var THEMES = window.THEMES;
  var BY_ID = {};
  WORDS.forEach(function (w) { BY_ID[w.id] = w; });

  // ─────────────────────────── State ───────────────────────────
  var DEFAULT_STATE = {
    version: 1,
    settings: { showH: true, color: 'green', direction: 'mixed', newPerDay: 10 },
    cards: {},      // "wordId:ar" | "wordId:en" → { reps, interval, ease, due, lapses, last }
    log: {},        // "YYYY-MM-DD" → { n, ok }
    introduced: {}  // "YYYY-MM-DD" → number of new words started that day
  };

  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return clone(DEFAULT_STATE);
      return normalise(JSON.parse(raw));
    } catch (e) {
      return clone(DEFAULT_STATE);
    }
  }
  function normalise(s) {
    var base = clone(DEFAULT_STATE);
    if (!s || typeof s !== 'object') return base;
    base.settings = Object.assign(base.settings, s.settings || {});
    base.cards = s.cards && typeof s.cards === 'object' ? s.cards : {};
    base.log = s.log && typeof s.log === 'object' ? s.log : {};
    base.introduced = s.introduced && typeof s.introduced === 'object' ? s.introduced : {};
    return base;
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
    catch (e) { toast('Could not save progress in this browser.'); }
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  var state = load();

  // ─────────────────────────── Helpers ───────────────────────────
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function strip(s) { return String(s).replace(new RegExp(MARK.source, 'g'), ''); }

  // Arabic text → HTML with coloured diacritics.
  // Browsers (Chrome especially) paint a mark in the same colour as its letter, even when the mark
  // is wrapped in its own coloured span. So we draw two layers instead: the full vowelled text in the
  // diacritic colour, and on top of it the same text without marks in black. Marks take no width,
  // so the letters line up exactly and only the marks show through in colour.
  function ar(text) {
    var bare = strip(text);
    if (!state.settings.showH || bare === text) return esc(bare);
    return '<span class="arx">' + esc(text) + '<span class="arx-top" aria-hidden="true">' + esc(bare) + '</span></span>';
  }

  function dayKey(t) {
    var d = new Date(t == null ? Date.now() : t);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function startOfDay(t) { var d = new Date(t == null ? Date.now() : t); d.setHours(0, 0, 0, 0); return d.getTime(); }
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  var toastTimer;
  function toast(msg) {
    var el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2600);
  }

  // ─────────────────────────── Audio (browser voice) ───────────────────────────
  var arVoice = null;
  function pickVoice() {
    if (!('speechSynthesis' in window)) return;
    var voices = speechSynthesis.getVoices();
    arVoice = voices.find(function (v) { return /^ar(-|_|$)/i.test(v.lang); }) || null;
  }
  if ('speechSynthesis' in window) {
    pickVoice();
    speechSynthesis.onvoiceschanged = pickVoice;
  }
  function speak(text) {
    if (!('speechSynthesis' in window)) { toast('This browser has no speech support.'); return; }
    if (!arVoice) pickVoice();
    if (!arVoice) { toast('No Arabic voice found on this device. Install one in your system’s speech settings.'); return; }
    speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(text);
    u.voice = arVoice;
    u.lang = arVoice.lang;
    u.rate = 0.85;
    speechSynthesis.speak(u);
  }

  // ─────────────────────────── Spaced repetition ───────────────────────────
  // Ratings: 1 Again · 2 Hard · 3 Good · 4 Easy. Intervals in days; 0 = still learning (seen again this session).
  function nextCard(card, rating) {
    var c = card ? Object.assign({}, card) : { reps: 0, interval: 0, ease: 2.5, lapses: 0 };
    var now = Date.now();
    var learning = !c.interval;
    if (rating === 1) {
      if (!learning) c.lapses = (c.lapses || 0) + 1;
      if (c.reps > 0) c.ease = Math.max(1.3, c.ease - 0.2);
      c.interval = 0;
    } else if (rating === 2) {
      c.ease = Math.max(1.3, c.ease - 0.15);
      c.interval = learning ? (c.reps > 0 ? 1 : 0) : Math.max(1, Math.round(c.interval * 1.2));
    } else if (rating === 3) {
      c.interval = learning ? 1 : Math.max(c.interval + 1, Math.round(c.interval * c.ease));
    } else {
      c.ease = c.ease + 0.15;
      c.interval = learning ? 4 : Math.max(c.interval + 2, Math.round(c.interval * c.ease * 1.3));
    }
    c.reps += 1;
    c.last = now;
    c.due = c.interval === 0 ? now : startOfDay(now) + c.interval * DAY;
    return c;
  }
  function intervalLabel(card, rating) {
    var d = nextCard(card, rating).interval;
    if (d === 0) return rating === 1 ? '< 1 min' : '< 10 min';
    if (d === 1) return '1 day';
    if (d < 30) return d + ' days';
    var m = Math.round(d / 30);
    return m === 1 ? '1 month' : m + ' months';
  }

  // New words come in theme order, interleaved, so each day mixes nouns, verbs and adjectives.
  var NEW_ORDER = (function () {
    var lists = THEMES.map(function (t) { return WORDS.filter(function (w) { return w.theme === t.id; }); });
    var out = [], i = 0, more = true;
    while (more) {
      more = false;
      lists.forEach(function (l) { if (l[i]) { out.push(l[i]); more = true; } });
      i++;
    }
    return out;
  })();

  function wordStatus(w) {
    var a = state.cards[w.id + ':ar'], e = state.cards[w.id + ':en'];
    if (!a && !e) return 'new';
    var dir = state.settings.direction;
    var need = dir === 'ar' ? [a] : dir === 'en' ? [e] : [a, e];
    var learned = need.every(function (c) { return c && c.interval >= LEARNED_DAYS; });
    return learned ? 'learned' : 'learning';
  }
  function isStarted(w) { return !!(state.cards[w.id + ':ar'] || state.cards[w.id + ':en']); }

  function introducedToday() { return state.introduced[dayKey()] || 0; }

  // Build a study queue: due reviews + up to N new words.
  function buildQueue(opts) {
    opts = opts || {};
    var dir = state.settings.direction;
    var now = Date.now();
    var pool = opts.theme ? WORDS.filter(function (w) { return w.theme === opts.theme; }) : WORDS;
    var due = [];
    pool.forEach(function (w) {
      ['ar', 'en'].forEach(function (d) {
        if (dir !== 'mixed' && dir !== d) return;
        var key = w.id + ':' + d, c = state.cards[key];
        if (c && c.due <= now) due.push(key);
        // English→Arabic opens up once the Arabic→English side has been seen once
        if (!c && d === 'en' && dir === 'mixed' && state.cards[w.id + ':ar']) due.push(key);
      });
    });
    var newLimit = opts.extraNew != null ? opts.extraNew : Math.max(0, state.settings.newPerDay - introducedToday());
    var order = opts.theme ? pool : NEW_ORDER;
    var fresh = order.filter(function (w) { return !isStarted(w); }).slice(0, newLimit);
    var newKeys = fresh.map(function (w) { return w.id + ':' + (dir === 'en' ? 'en' : 'ar'); });
    // reviews first (shuffled), new words spread through the second half
    var q = shuffle(due);
    newKeys.forEach(function (k, i) {
      var pos = Math.min(q.length, Math.floor(q.length / 2) + i * 2);
      q.splice(pos, 0, k);
    });
    return q;
  }

  function countDueToday() {
    var dir = state.settings.direction;
    var end = startOfDay() + DAY;
    var n = 0;
    Object.keys(state.cards).forEach(function (k) {
      var d = k.split(':')[1];
      if (dir !== 'mixed' && dir !== d) return;
      if (state.cards[k].due < end) n++;
    });
    if (dir === 'mixed') {
      WORDS.forEach(function (w) { if (state.cards[w.id + ':ar'] && !state.cards[w.id + ':en']) n++; });
    }
    return n;
  }

  function logReview(ok) {
    var k = dayKey();
    var e = state.log[k] || { n: 0, ok: 0 };
    e.n++; if (ok) e.ok++;
    state.log[k] = e;
  }
  function streak() {
    var t = Date.now(), n = 0;
    if (!state.log[dayKey(t)]) t -= DAY; // today not done yet: count from yesterday
    while (state.log[dayKey(t)] && state.log[dayKey(t)].n > 0) { n++; t -= DAY; }
    return n;
  }
  function accuracy7() {
    var n = 0, ok = 0;
    for (var i = 0; i < 7; i++) {
      var e = state.log[dayKey(Date.now() - i * DAY)];
      if (e) { n += e.n; ok += e.ok; }
    }
    return n ? Math.round((ok / n) * 100) : null;
  }

  // ─────────────────────────── Header controls ───────────────────────────
  function renderControls() {
    document.documentElement.style.setProperty('--h', (COLORS.find(function (c) { return c.id === state.settings.color; }) || COLORS[0]).hex);
    $('#toggle-h').checked = state.settings.showH;
    $('#swatches').innerHTML = COLORS.map(function (c) {
      return '<button class="swatch" data-color="' + c.id + '" aria-label="' + c.name + '" aria-pressed="' + (c.id === state.settings.color) + '">' +
        '<span style="background:' + c.hex + '"></span></button>';
    }).join('');
    $all('[data-ar]').forEach(function (el) { el.innerHTML = ar(el.getAttribute('data-ar')); });
  }
  $('#toggle-h').addEventListener('change', function (e) {
    state.settings.showH = e.target.checked; save(); renderControls(); rerender();
  });
  $('#swatches').addEventListener('click', function (e) {
    var b = e.target.closest('[data-color]');
    if (!b) return;
    state.settings.color = b.getAttribute('data-color'); save(); renderControls();
  });

  // ─────────────────────────── Shared: word details ───────────────────────────
  function detailsHTML(w) {
    var pills = ['<span class="pill">' + esc(w.pos) + '</span>'];
    w.forms.forEach(function (f) {
      pills.push('<span class="pill">' + esc(f[0]) + ' <span class="ar">' + ar(f[1]) + '</span> ' + esc(f[2]) + '</span>');
    });
    if (w.root && w.root !== '—') pills.push('<span class="pill">root <span class="ar">' + esc(w.root) + '</span></span>');

    var rows = w.p.map(function (r) {
      return '<div class="bd-row"><span class="ar" lang="ar">' + ar(r[0]) + '</span>' +
        '<span class="tr">' + esc(r[1]) + '</span>' +
        '<span><strong>' + esc(r[2]) + '</strong><span class="note">' + ar(r[3]) + '</span></span></div>';
    }).join('');

    return '' +
      '<div class="head">' +
        '<div class="ar word-ar" lang="ar">' + ar(w.ar) + '</div>' +
        '<div class="translit">' + esc(w.tr) + '</div>' +
        '<div class="meaning">' + esc(w.en) + '</div>' +
        '<div class="pills">' + pills.join('') + '</div>' +
        '<button class="btn icon-btn" data-speak="' + esc(w.ar) + '" aria-label="Play pronunciation">' + speakerIcon() + ' Listen</button>' +
      '</div>' +
      '<div class="divider"></div>' +
      '<div class="stack" style="gap:10px">' +
        '<div class="label">Sample sentence</div>' +
        '<div class="ar sentence-ar" lang="ar">' + ar(w.s.ar) + '</div>' +
        '<div><button class="btn icon-btn" data-speak="' + esc(w.s.ar) + '" aria-label="Play sentence">' + speakerIcon() + ' Listen to the sentence</button></div>' +
        '<div class="sentence-tr">' + esc(w.s.tr) + '</div>' +
        '<div class="sentence-en">' + esc(w.s.en) + '</div>' +
      '</div>' +
      '<div class="stack" style="gap:10px">' +
        '<div class="label">Breakdown</div>' +
        '<div class="breakdown">' + rows + '</div>' +
      '</div>';
  }
  function speakerIcon() {
    return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/></svg>';
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-speak]');
    if (b) speak(b.getAttribute('data-speak'));
  });

  // ─────────────────────────── Dashboard ───────────────────────────
  function viewDashboard() {
    var learned = WORDS.filter(function (w) { return wordStatus(w) === 'learned'; }).length;
    var started = WORDS.filter(isStarted).length;
    var due = countDueToday();
    var newLeft = Math.min(Math.max(0, state.settings.newPerDay - introducedToday()), WORDS.length - started);
    var acc = accuracy7();
    var hour = new Date().getHours();
    var greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

    var themes = THEMES.map(function (t) {
      var ws = WORDS.filter(function (w) { return w.theme === t.id; });
      var l = ws.filter(function (w) { return wordStatus(w) === 'learned'; }).length;
      var s = ws.filter(isStarted).length;
      var pct = Math.round((l / ws.length) * 100);
      return '<div class="theme-row"><span>' + esc(t.label) + ' <span class="muted small">· ' + l + ' learned, ' + s + ' started of ' + ws.length + '</span></span>' +
        '<a href="#/study?theme=' + t.id + '">Study</a>' +
        '<div class="bar" role="img" aria-label="' + pct + '% learned"><div style="width:' + pct + '%"></div></div></div>';
    }).join('');

    var tricky = WORDS.map(function (w) {
      var a = state.cards[w.id + ':ar'], e = state.cards[w.id + ':en'];
      return { w: w, n: (a ? a.lapses || 0 : 0) + (e ? e.lapses || 0 : 0) };
    }).filter(function (x) { return x.n > 0; }).sort(function (a, b) { return b.n - a.n; }).slice(0, 5);
    var trickyHTML = tricky.length ? tricky.map(function (x) {
      return '<div class="tricky"><span class="ar" lang="ar">' + ar(x.w.ar) + '</span><span class="muted">' + esc(x.w.en) + ' · missed ' + x.n + '×</span></div>';
    }).join('') : '<p class="muted small" style="margin:0">Words you forget will show up here.</p>';

    var startLabel = due + newLeft === 0 ? 'Nothing due — practise anyway' :
      'Start session · ' + due + ' due' + (newLeft ? ' · ' + newLeft + ' new' : '');

    view.innerHTML = '' +
      '<div class="stack" style="gap:28px">' +
        '<div class="hello"><div><div class="muted small">' + esc(new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })) + '</div>' +
          '<h1>' + greet + ', Antoine</h1></div>' +
          '<a class="btn primary big" href="#/study">' + esc(startLabel) + '</a></div>' +
        '<div class="tiles">' +
          tile('Words learned', learned + '<small> / ' + WORDS.length + '</small>', started + ' started') +
          tile('Due today', due, newLeft + ' new words available') +
          tile('Day streak', streak(), (state.log[dayKey()] ? state.log[dayKey()].n : 0) + ' reviews today') +
          tile('Accuracy, last 7 days', acc == null ? '—' : acc + '%', 'answers not marked “Again”') +
        '</div>' +
        '<div class="row">' +
          '<section class="panel grow"><h2>Top 100 words by theme</h2>' + themes + '</section>' +
          '<section class="panel side"><h2>Trickiest words</h2>' + trickyHTML + '</section>' +
        '</div>' +
        '<div class="row">' +
          '<section class="panel grow"><h2>Settings</h2>' +
            '<div class="field"><label for="set-dir">Card direction</label><select id="set-dir">' +
              opt('mixed', 'Mixed (Arabic → English and English → Arabic)', state.settings.direction) +
              opt('ar', 'Arabic → English only', state.settings.direction) +
              opt('en', 'English → Arabic only', state.settings.direction) +
            '</select></div>' +
            '<div class="field"><label for="set-new">New words per day</label><select id="set-new">' +
              [5, 10, 15, 20, 30].map(function (n) { return opt(String(n), String(n), String(state.settings.newPerDay)); }).join('') +
            '</select></div>' +
          '</section>' +
          '<section class="panel side"><h2>Your progress</h2>' +
            '<p class="muted small" style="margin:0 0 12px">Saved automatically in this browser. Export a backup to keep it safe or move it to another device.</p>' +
            '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
              '<button class="btn" id="export">Export backup</button>' +
              '<button class="btn" id="import">Import</button>' +
              '<input type="file" id="import-file" accept="application/json,.json" hidden>' +
            '</div>' +
          '</section>' +
        '</div>' +
        '<section class="panel dashed"><h2 style="margin-bottom:6px">Games &amp; modules</h2>' +
          '<p class="muted" style="margin:0">Space for what comes next: matching game, typing drill, alphabet trainer…</p></section>' +
      '</div>';

    $('#set-dir').addEventListener('change', function (e) { state.settings.direction = e.target.value; save(); viewDashboard(); });
    $('#set-new').addEventListener('change', function (e) { state.settings.newPerDay = parseInt(e.target.value, 10); save(); viewDashboard(); });
    $('#export').addEventListener('click', exportData);
    $('#import').addEventListener('click', function () { $('#import-file').click(); });
    $('#import-file').addEventListener('change', importData);
  }
  function tile(label, num, sub) {
    return '<div class="tile"><div class="muted small">' + esc(label) + '</div><div class="num">' + num + '</div><div class="muted small">' + esc(sub) + '</div></div>';
  }
  function opt(v, label, cur) { return '<option value="' + v + '"' + (v === cur ? ' selected' : '') + '>' + esc(label) + '</option>'; }

  function exportData() {
    var blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'arabic-progress-' + dayKey() + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    toast('Backup downloaded.');
  }
  function importData(e) {
    var f = e.target.files[0];
    if (!f) return;
    var r = new FileReader();
    r.onload = function () {
      try {
        var data = JSON.parse(r.result);
        if (!data || typeof data.cards !== 'object') throw new Error('bad');
        if (!confirm('Replace your current progress with this backup?')) return;
        state = normalise(data); save(); renderControls(); viewDashboard();
        toast('Progress imported.');
      } catch (err) { toast('That file is not a valid backup.'); }
    };
    r.readAsText(f);
  }

  // ─────────────────────────── Study session ───────────────────────────
  var session = null;

  function startSession(opts) {
    session = { opts: opts || {}, queue: buildQueue(opts), done: 0, revealed: false, showTr: false, hint: false, stats: { n: 0, ok: 0 } };
    session.total = session.queue.length;
  }

  function viewStudy(params) {
    var theme = params.theme || null;
    if (!session || session.opts.theme !== theme || session.finished) startSession({ theme: theme });
    renderStudy();
  }

  function renderStudy() {
    var themeLabel = session.opts.theme ? (THEMES.find(function (t) { return t.id === session.opts.theme; }) || {}).label : 'All words';
    if (!session.queue.length) return renderSummary(themeLabel);

    var key = session.queue[0];
    var parts = key.split(':'), w = BY_ID[parts[0]], dir = parts[1];
    var card = state.cards[key];
    var pct = session.total ? Math.round((session.done / (session.done + session.queue.length)) * 100) : 0;
    var dirLabel = dir === 'ar' ? 'Arabic → English · what does it mean?' : 'English → Arabic · how do you say it?';
    var isNew = !card;

    var html = '<div class="narrow stack">' +
      '<div class="session-meta"><span>' + esc(themeLabel) + ' · ' + session.queue.length + ' left' + (isNew ? ' · <strong>new word</strong>' : '') + '</span><span>' + esc(dirLabel) + '</span></div>' +
      '<div class="progress" role="progressbar" aria-valuenow="' + pct + '" aria-valuemin="0" aria-valuemax="100"><div style="width:' + pct + '%"></div></div>';

    if (!session.revealed) {
      if (dir === 'ar') {
        html += '<section class="card front">' +
          '<div class="ar word-ar" lang="ar">' + ar(w.ar) + '</div>' +
          (session.showTr ? '<div class="translit">' + esc(w.tr) + '</div>' : '') +
          '<div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center">' +
            '<button class="btn icon-btn" data-speak="' + esc(w.ar) + '" aria-label="Play pronunciation">' + speakerIcon() + ' Listen</button>' +
            (session.showTr ? '' : '<button class="btn" id="show-tr" style="border-radius:999px">Show transliteration</button>') +
          '</div></section>';
      } else {
        var first = strip(w.ar).replace(/^ال/, '')[0];
        html += '<section class="card front">' +
          '<div class="label">How do you say this in Arabic?</div>' +
          '<div class="word-en">' + esc(w.en) + '</div>' +
          '<div class="muted">' + esc(w.pos) + '</div>' +
          (session.hint ? '<div class="hint">Starts with <span class="ar" style="font-size:34px">' + esc(first) + '</span></div>'
                        : '<button class="btn" id="hint" style="border-radius:999px">Hint: first letter</button>') +
          '</section>';
      }
      html += '<button class="btn primary big block" id="reveal">Show answer</button>' +
        '<div class="keys">Space to reveal · P to listen' + (dir === 'ar' ? ' · T for transliteration' : '') + '</div>';
    } else {
      html += '<section class="card">' + detailsHTML(w) + '</section>' +
        '<div class="stack" style="gap:10px"><div class="small muted" style="text-align:center">How well did you know it?</div>' +
        '<div class="ratings">' +
          rateBtn(1, 'Again', card) + rateBtn(2, 'Hard', card) + rateBtn(3, 'Good', card) + rateBtn(4, 'Easy', card) +
        '</div><div class="keys">Keys 1 · 2 · 3 · 4 · P to listen</div></div>';
    }
    html += '</div>';
    view.innerHTML = html;

    var r = $('#reveal'); if (r) r.addEventListener('click', reveal);
    var t = $('#show-tr'); if (t) t.addEventListener('click', function () { session.showTr = true; renderStudy(); });
    var h = $('#hint'); if (h) h.addEventListener('click', function () { session.hint = true; renderStudy(); });
    $all('[data-rate]').forEach(function (b) {
      b.addEventListener('click', function () { rate(parseInt(b.getAttribute('data-rate'), 10)); });
    });
  }
  function rateBtn(n, label, card) {
    return '<button class="rate' + (n === 3 ? ' good' : '') + '" data-rate="' + n + '"><b>' + label + '</b><span>' + intervalLabel(card, n) + '</span></button>';
  }
  function reveal() {
    session.revealed = true;
    renderStudy();
    window.scrollTo({ top: 0 });
    var key = session.queue[0], w = BY_ID[key.split(':')[0]];
    if (key.split(':')[1] === 'en') speak(w.ar); // after recalling, hear the answer
  }
  function rate(n) {
    var key = session.queue.shift();
    var wid = key.split(':')[0];
    var wasNew = !state.cards[key] && !state.cards[wid + ':ar'] && !state.cards[wid + ':en'];
    var c = nextCard(state.cards[key], n);
    state.cards[key] = c;
    if (wasNew) state.introduced[dayKey()] = introducedToday() + 1;
    logReview(n > 1);
    session.stats.n++; if (n > 1) session.stats.ok++;

    if (c.interval === 0) {
      // still learning: show again a few cards later
      session.queue.splice(Math.min(session.queue.length, 3), 0, key);
    } else {
      session.done++;
      // first time Arabic→English is passed in mixed mode: add the reverse card later in this session
      var rev = wid + ':en';
      if (key.endsWith(':ar') && state.settings.direction === 'mixed' && !state.cards[rev] && session.queue.indexOf(rev) === -1) {
        session.queue.splice(Math.min(session.queue.length, 5), 0, rev);
      }
    }
    save();
    session.revealed = false; session.showTr = false; session.hint = false;
    renderStudy();
  }
  function renderSummary(themeLabel) {
    session.finished = session.stats.n > 0 || session.total > 0;
    var s = session.stats;
    var remaining = WORDS.filter(function (w) { return !isStarted(w) && (!session.opts.theme || w.theme === session.opts.theme); }).length;
    view.innerHTML = '<div class="narrow stack">' +
      '<section class="card front">' +
        '<div class="label">' + esc(themeLabel) + '</div>' +
        '<div class="word-en" style="font-size:40px">' + (s.n ? 'Session done' : 'Nothing due right now') + '</div>' +
        (s.n ? '<div class="muted">' + s.n + ' answers · ' + Math.round((s.ok / s.n) * 100) + '% not “Again”</div>' : '<div class="muted">You’re all caught up.</div>') +
        '<div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-top:10px">' +
          (remaining ? '<button class="btn primary" id="more">Learn 5 more new words</button>' : '') +
          '<a class="btn" href="#/dashboard">Back to dashboard</a>' +
        '</div>' +
      '</section></div>';
    var m = $('#more');
    if (m) m.addEventListener('click', function () {
      var theme = session.opts.theme || null;
      startSession({ theme: theme, extraNew: 5 });
      session.opts = { theme: theme }; // keep the same theme when coming back to Study
      renderStudy();
    });
  }

  document.addEventListener('keydown', function (e) {
    if (route !== 'study' || !session || e.target.matches('input, select, textarea') || e.metaKey || e.ctrlKey || e.altKey) return;
    if (!session.queue.length) return;
    var key = session.queue[0], w = BY_ID[key.split(':')[0]];
    if (!session.revealed && (e.code === 'Space' || e.key === 'Enter')) { e.preventDefault(); reveal(); }
    else if (session.revealed && /^[1-4]$/.test(e.key)) { e.preventDefault(); rate(parseInt(e.key, 10)); }
    else if (e.key === 'p' || e.key === 'P') {
      if (session.revealed || key.endsWith(':ar')) speak(w.ar);
    }
    else if ((e.key === 't' || e.key === 'T') && !session.revealed && key.endsWith(':ar')) { session.showTr = !session.showTr; renderStudy(); }
  });

  // ─────────────────────────── Word list ───────────────────────────
  var wordQuery = '';
  function viewWords() {
    view.innerHTML = '<div class="stack">' +
      '<input class="search" id="q" type="search" placeholder="Search in English, Arabic or transliteration" aria-label="Search words" value="' + esc(wordQuery) + '">' +
      '<div class="legend"><span><i class="dot"></i> new</span><span><i class="dot learning"></i> learning</span><span><i class="dot learned"></i> learned</span></div>' +
      '<div id="wgroups" class="stack"></div></div>';
    $('#q').addEventListener('input', function (e) { wordQuery = e.target.value; renderWordGroups(); });
    renderWordGroups();
  }
  function renderWordGroups() {
    var q = wordQuery.trim().toLowerCase();
    var qs = strip(q);
    var html = THEMES.map(function (t) {
      var ws = WORDS.filter(function (w) {
        if (w.theme !== t.id) return false;
        if (!q) return true;
        return w.en.toLowerCase().indexOf(q) > -1 || w.tr.toLowerCase().indexOf(q) > -1 || strip(w.ar).indexOf(qs) > -1;
      });
      if (!ws.length) return '';
      return '<section class="wgroup"><h2>' + esc(t.label) + '</h2><div class="wlist">' + ws.map(function (w) {
        return '<button class="witem" data-word="' + w.id + '"><span style="display:flex;align-items:center;gap:10px"><i class="dot ' + wordStatus(w) + '" aria-hidden="true"></i><span class="en">' + esc(w.en) + '</span></span>' +
          '<span class="ar" lang="ar">' + ar(w.ar) + '</span></button>';
      }).join('') + '</div></section>';
    }).join('');
    $('#wgroups').innerHTML = html || '<p class="muted">No word matches.</p>';
    $all('[data-word]').forEach(function (b) {
      b.addEventListener('click', function () { openWord(BY_ID[b.getAttribute('data-word')]); });
    });
  }
  function openWord(w) {
    var d = document.createElement('dialog');
    d.innerHTML = '<div class="dialog-body"><button class="btn dialog-close" aria-label="Close">Close</button>' + detailsHTML(w) + '</div>';
    document.body.appendChild(d);
    d.querySelector('.dialog-close').addEventListener('click', function () { d.close(); });
    d.addEventListener('close', function () { d.remove(); });
    d.addEventListener('click', function (e) { if (e.target === d) d.close(); });
    d.showModal();
  }

  // ─────────────────────────── Router ───────────────────────────
  var view = $('#view');
  var route = 'dashboard';
  function currentParams() {
    var hash = location.hash.replace(/^#\/?/, '');
    var qs = hash.split('?')[1] || '';
    var p = {};
    qs.split('&').forEach(function (kv) { if (!kv) return; var a = kv.split('='); p[decodeURIComponent(a[0])] = decodeURIComponent(a[1] || ''); });
    return p;
  }
  function rerender() {
    if (route === 'study') renderStudy();
    else if (route === 'words') renderWordGroups();
    else viewDashboard();
  }
  function onRoute() {
    var hash = location.hash.replace(/^#\/?/, '');
    var name = hash.split('?')[0] || 'dashboard';
    if (['dashboard', 'study', 'words'].indexOf(name) === -1) name = 'dashboard';
    route = name;
    $all('[data-nav]').forEach(function (a) { a.classList.toggle('active', a.getAttribute('data-nav') === name); });
    if (name === 'study') viewStudy(currentParams());
    else if (name === 'words') viewWords();
    else viewDashboard();
    window.scrollTo({ top: 0 });
  }
  window.addEventListener('hashchange', onRoute);

  renderControls();
  onRoute();
})();
