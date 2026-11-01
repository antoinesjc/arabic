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
    settings: { showH: true, color: 'green', direction: 'mixed', newPerDay: 10, lvNewPerDay: 5 },
    cards: {},      // "wordId:ar" | "wordId:en" → { reps, interval, ease, due, lapses, last }
    log: {},        // "YYYY-MM-DD" → { n, ok }
    introduced: {}, // "YYYY-MM-DD" → number of new words started that day
    lv: { cards: {}, introduced: {} } // Levantine sentences: kept apart, never counted in the word count / city
  };

  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return normalise({});
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
    base.savedAt = s.savedAt || 0;
    base.cityShown = Array.isArray(s.cityShown) ? s.cityShown : []; // city pieces already shown (new ones rise in)
    var lv = s.lv && typeof s.lv === 'object' ? s.lv : {};
    base.lv = { cards: lv.cards && typeof lv.cards === 'object' ? lv.cards : {}, introduced: lv.introduced && typeof lv.introduced === 'object' ? lv.introduced : {} };
    return base;
  }

  // Combine progress from two devices: keep the most recently reviewed version of each card.
  function merge(a, b) {
    var newer = (b.savedAt || 0) > (a.savedAt || 0) ? b : a;
    var out = clone(newer);
    function mergeCards(x, y) {
      var o = Object.assign({}, x);
      Object.keys(y).forEach(function (k) { if (!o[k] || (y[k].last || 0) > (o[k].last || 0)) o[k] = y[k]; });
      return o;
    }
    function mergeCounts(x, y) {
      var o = Object.assign({}, x);
      Object.keys(y).forEach(function (d) { o[d] = Math.max(o[d] || 0, y[d]); });
      return o;
    }
    out.cards = mergeCards(a.cards, b.cards);
    out.lv = { cards: mergeCards(a.lv.cards, b.lv.cards), introduced: mergeCounts(a.lv.introduced, b.lv.introduced) };
    out.log = Object.assign({}, a.log);
    Object.keys(b.log).forEach(function (d) {
      if (!out.log[d] || b.log[d].n > out.log[d].n) out.log[d] = b.log[d];
    });
    out.introduced = Object.assign({}, a.introduced);
    Object.keys(b.introduced).forEach(function (d) {
      out.introduced[d] = Math.max(out.introduced[d] || 0, b.introduced[d]);
    });
    out.savedAt = Math.max(a.savedAt || 0, b.savedAt || 0);
    return out;
  }
  function saveLocal() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
    catch (e) { toast('Could not save progress in this browser.'); }
  }
  function save() {
    state.savedAt = Date.now();
    saveLocal();
    schedulePush();
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  var state = load();

  // ─────────────────────────── Online sync (Supabase) ───────────────────────────
  // The publishable key is meant to be public; the database only lets a signed-in user read/write their own row.
  var SB_URL = 'https://wvefczonbcyujdmxlumc.supabase.co';
  var SB_KEY = 'sb_publishable_i4L4eB8giIR0Uiv0iV-G4g_m757wEg0';
  var sb = null;
  try { if (window.supabase && window.supabase.createClient) sb = window.supabase.createClient(SB_URL, SB_KEY); } catch (e) { sb = null; }
  var cloud = { user: null, status: 'idle', last: null, msg: '', email: '', timer: null, busy: false };

  function schedulePush() {
    if (!sb || !cloud.user) return;
    clearTimeout(cloud.timer);
    cloud.timer = setTimeout(push, 1500);
  }
  async function push() {
    if (!sb || !cloud.user) return;
    clearTimeout(cloud.timer);
    cloud.status = 'saving'; renderSyncPanel();
    var res = await sb.from('progress').upsert({ user_id: cloud.user.id, data: state, updated_at: new Date().toISOString() });
    if (res.error) { cloud.status = 'error'; cloud.msg = res.error.message; }
    else { cloud.status = 'synced'; cloud.last = Date.now(); cloud.msg = ''; }
    renderSyncPanel();
  }
  async function pull() {
    if (!sb || !cloud.user || cloud.busy) return;
    cloud.busy = true;
    cloud.status = 'saving'; renderSyncPanel();
    var res = await sb.from('progress').select('data').eq('user_id', cloud.user.id).maybeSingle();
    cloud.busy = false;
    if (res.error) { cloud.status = 'error'; cloud.msg = res.error.message; renderSyncPanel(); return; }
    if (res.data && res.data.data) {
      state = merge(state, normalise(res.data.data));
      saveLocal();
      renderControls();
      rerender();
    }
    await push();
  }

  if (sb) {
    sb.auth.onAuthStateChange(function (event, session) {
      var u = session ? session.user : null;
      var changed = (u && u.id) !== (cloud.user && cloud.user.id);
      cloud.user = u;
      if (!u) cloud.status = 'idle';
      if (u && changed) setTimeout(pull, 0); // run outside the auth callback
      renderSyncPanel();
    });
    // pick up reviews done on another device when coming back to this tab
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible' && cloud.user) pull();
    });
  }

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

  // Mixed English/Arabic text (breakdown notes): colour the diacritics of each Arabic run only.
  function arMixed(text) {
    return String(text).split(/([\u0600-\u06FF]+(?:\s+[\u0600-\u06FF]+)*)/).map(function (part, i) {
      return i % 2 ? '<span class="ar-inline" dir="rtl">' + ar(part) + '</span>' : esc(part);
    }).join('');
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
  var arVoice = null, lvVoice = null, lvVoiceIsLocal = false;
  function pickVoice() {
    if (!('speechSynthesis' in window)) return;
    var voices = speechSynthesis.getVoices().filter(function (v) { return /^ar(-|_|$)/i.test(v.lang); });
    arVoice = voices[0] || null;
    // Levantine: prefer a Lebanese, Syrian, Jordanian or Palestinian voice (Microsoft Edge has them)
    var lv = voices.find(function (v) { return /^ar[-_](LB|SY|JO|PS)/i.test(v.lang); });
    lvVoiceIsLocal = !!lv;
    lvVoice = lv || arVoice;
  }
  if ('speechSynthesis' in window) {
    pickVoice();
    speechSynthesis.onvoiceschanged = pickVoice;
  }
  function speak(text, kind) {
    if (!('speechSynthesis' in window)) { toast('This browser has no speech support.'); return; }
    if (!arVoice) pickVoice();
    var voice = kind === 'lv' ? lvVoice : arVoice;
    if (!voice) { toast('No Arabic voice found on this device. Install one in your system’s speech settings.'); return; }
    speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(text);
    u.voice = voice;
    u.lang = voice.lang;
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
        '<span><strong>' + esc(r[2]) + '</strong><span class="note">' + arMixed(r[3]) + '</span></span></div>';
    }).join('');

    return '' +
      '<div class="head">' +
        '<div class="ar word-ar" lang="ar">' + ar(w.ar) + '</div>' +
        '<div class="translit">' + esc(w.tr) + '</div>' +
        '<div class="meaning">' + esc(w.en) + '</div>' +
        '<div class="pills">' + pills.join('') + '</div>' +
        (w.cog ? '<div class="cog"><span class="label">Sounds familiar</span><div class="pills">' +
          w.cog.map(function (c) { return '<span class="pill cog-pill"><b>' + esc(c[0]) + '</b> ' + esc(c[1]) + '</span>'; }).join('') + '</div>' +
          (w.cogNote ? '<p class="muted small" style="margin:0">' + esc(w.cogNote) + '</p>' : '') + '</div>' : '') +
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
    if (b) speak(b.getAttribute('data-speak'), b.getAttribute('data-voice'));
  });

  // ─────────────────────────── Dashboard ───────────────────────────
  function viewDashboard() {
    var learned = WORDS.filter(function (w) { return wordStatus(w) === 'learned'; }).length;
    var started = WORDS.filter(isStarted).length;
    var due = countDueToday();
    var newLeft = Math.min(Math.max(0, state.settings.newPerDay - introducedToday()), WORDS.length - started);
    var acc = accuracy7();
    var hour = new Date().getHours();
    // Arabic greeting: صباح الخير in the morning, مساء الخير from noon on
    var greetAr = (hour < 12 ? 'صَبَاحُ الْخَيْرِ' : 'مَسَاءُ الْخَيْرِ') + ' يَا أنطوان';
    var greetTr = (hour < 12 ? 'ṣabāḥu l-khayri' : 'masāʾu l-khayri') + ' yā Anṭwān';
    var greetEn = hour < 12 ? 'Good morning, Antoine' : hour < 18 ? 'Good afternoon, Antoine' : 'Good evening, Antoine';

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
          '<h1 class="greet"><span class="ar" lang="ar">' + ar(greetAr) + '</span>' +
            '<button class="btn icon-btn greet-listen" data-speak="' + esc(greetAr) + '" aria-label="Listen to the greeting">' + speakerIcon() + '</button></h1>' +
          '<div class="muted small"><em>' + esc(greetTr) + '</em> · ' + esc(greetEn) + '</div></div>' +
          '<a class="btn primary big" href="#/study">' + esc(startLabel) + '</a></div>' +
        cityHTML(learned, started) +
        '<div class="tiles">' +
          tile('Words learned', learned + '<small> / ' + WORDS.length + '</small>', started + ' started') +
          tile('Due today', due, newLeft + ' new words available') +
          tile('Day streak', streak(), (state.log[dayKey()] ? state.log[dayKey()].n : 0) + ' reviews today') +
          tile('Accuracy, last 7 days', acc == null ? '—' : acc + '%', 'answers not marked “Again”') +
        '</div>' +
        lvDashboardHTML() +
        '<div class="row">' +
          '<section class="panel grow"><h2>Words by theme</h2>' + themes + '</section>' +
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
            '<div id="sync-panel"></div>' +
            '<p class="muted small" style="margin:16px 0 10px">Backup file</p>' +
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

    var pv = $('#city-preview');
    if (pv) pv.addEventListener('click', function () { cityPreview = !cityPreview; viewDashboard(); });
    $('#set-dir').addEventListener('change', function (e) { state.settings.direction = e.target.value; save(); viewDashboard(); });
    $('#set-new').addEventListener('change', function (e) { state.settings.newPerDay = parseInt(e.target.value, 10); save(); viewDashboard(); });
    $('#export').addEventListener('click', exportData);
    $('#import').addEventListener('click', function () { $('#import-file').click(); });
    $('#import-file').addEventListener('change', importData);
    renderSyncPanel();
  }

  function renderSyncPanel() {
    var el = $('#sync-panel');
    if (!el) return;
    var emailEl = $('#auth-email');
    if (emailEl) cloud.email = emailEl.value;

    if (!sb) {
      el.innerHTML = '<p class="muted small" style="margin:0">Online sync isn’t reachable right now (no internet?). Progress is still saved in this browser.</p>';
      return;
    }
    if (cloud.user) {
      var line = cloud.status === 'saving' ? 'Syncing…' :
        cloud.status === 'error' ? 'Sync failed: ' + cloud.msg :
        cloud.last ? 'Synced at ' + new Date(cloud.last).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Connected';
      el.innerHTML = '<p class="small" style="margin:0 0 4px">Saved online to <strong>' + esc(cloud.user.email || 'your account') + '</strong></p>' +
        '<p class="small ' + (cloud.status === 'error' ? '' : 'muted') + '" style="margin:0 0 12px">' + esc(line) + '</p>' +
        '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
          '<button class="btn" id="sync-now">Sync now</button>' +
          '<button class="btn" id="sign-out">Sign out</button>' +
        '</div>';
      $('#sync-now').addEventListener('click', pull);
      $('#sign-out').addEventListener('click', async function () {
        await sb.auth.signOut();
        cloud.user = null; cloud.last = null; renderSyncPanel();
        toast('Signed out. Progress stays in this browser.');
      });
      return;
    }
    el.innerHTML = '<p class="muted small" style="margin:0 0 12px">Sign in to save your progress online and use it on any device.</p>' +
      '<form id="auth-form" class="auth">' +
        '<label>Email<input type="email" id="auth-email" autocomplete="email" required value="' + esc(cloud.email) + '"></label>' +
        '<label>Password<input type="password" id="auth-pw" autocomplete="current-password" minlength="6" required></label>' +
        '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
          '<button class="btn primary" type="submit">Sign in</button>' +
          '<button class="btn" type="button" id="sign-up">Create account</button>' +
        '</div>' +
        (cloud.msg ? '<p class="small" id="auth-msg" style="margin:0">' + esc(cloud.msg) + '</p>' : '') +
      '</form>';
    $('#auth-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      cloud.email = $('#auth-email').value.trim();
      var pw = $('#auth-pw').value;
      setAuthMsg('Signing in…');
      try {
        var res = await sb.auth.signInWithPassword({ email: cloud.email, password: pw });
        cloud.msg = !res.error ? '' :
          /confirm/i.test(res.error.message) ? 'Please click the link in the confirmation email first.' :
          /fetch|network/i.test(res.error.message) ? 'Could not reach the server. Check your internet connection.' :
          'Sign-in failed: ' + res.error.message;
      } catch (err) { cloud.msg = 'Could not reach the server. Check your internet connection.'; }
      renderSyncPanel();
    });
    $('#sign-up').addEventListener('click', async function () {
      var form = $('#auth-form');
      if (!form.reportValidity()) return;
      cloud.email = $('#auth-email').value.trim();
      var pw = $('#auth-pw').value;
      setAuthMsg('Creating your account…');
      try {
        var res = await sb.auth.signUp({ email: cloud.email, password: pw });
        if (res.error) cloud.msg = 'Could not create the account: ' + res.error.message;
        else if (!res.data.session) cloud.msg = 'Account created. Open the confirmation email and click the link (the page it opens may show an error — that’s fine), then come back here and sign in.';
        else cloud.msg = '';
      } catch (err) { cloud.msg = 'Could not reach the server. Check your internet connection.'; }
      renderSyncPanel();
    });
  }
  function setAuthMsg(text) {
    var form = $('#auth-form');
    if (!form) return;
    var p = $('#auth-msg') || form.appendChild(Object.assign(document.createElement('p'), { id: 'auth-msg', className: 'small' }));
    p.style.margin = '0';
    p.textContent = text;
  }
  // The growing city: learned words count fully, words still being learned count half.
  var cityPreview = false;
  function cityHTML(learned, started) {
    if (!window.CITY) return '';
    var words = Math.floor(learned + (started - learned) * 0.5);
    var r = window.CITY.render(words, { seen: state.cityShown });               // your real city (and its counts)
    var shown = cityPreview ? window.CITY.render(words, { preview: true }) : r; // what the picture shows
    if (!cityPreview && r.visible.join() !== state.cityShown.join()) { state.cityShown = r.visible; save(); }
    var pct = Math.min(100, (words / window.CITY.FLUENT_WORDS) * 100);
    var status = cityPreview
      ? 'Preview: your city at fluency (about ' + window.CITY.FLUENT_WORDS.toLocaleString() + ' words).'
      : (r.last ? 'Latest: ' + r.last.name + '. ' : 'An empty desert, for now. ') +
        (r.next ? 'Next: ' + r.next.name + ' at ' + r.next.at.toLocaleString() + ' words.' : '') +
        (r.building.length ? ' Under construction: ' + r.building.map(function (b) { return b.name + ' (' + b.pct + '%)'; }).join(', ') + '.' : '');
    return '<section class="panel city">' +
      '<div class="city-frame">' + shown.svg + '</div>' +
      '<div class="city-info">' +
        '<h2>Your city</h2>' +
        '<div class="city-num">' + words.toLocaleString() + '<small> / ' + window.CITY.FLUENT_WORDS.toLocaleString() + ' words</small></div>' +
        '<div class="bar" role="img" aria-label="' + pct.toFixed(1) + '% to fluency"><div style="width:' + pct + '%"></div></div>' +
        '<div class="muted small">' + (pct < 1 && pct > 0 ? pct.toFixed(1) : Math.round(pct)) + '% of the way to fluency · ' + r.unlocked + ' of ' + r.total + ' levels</div>' +
        '<p style="margin:4px 0 0">' + esc(status) + '</p>' +
        '<p class="muted small" style="margin:0">Learned words count fully, words you’re still learning count half.</p>' +
        '<div><button class="btn" id="city-preview" aria-pressed="' + cityPreview + '">' + (cityPreview ? 'Back to my city' : 'Preview the fluent city') + '</button></div>' +
      '</div>' +
    '</section>';
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
        state = normalise(data); state.savedAt = Date.now(); saveLocal(); renderControls(); viewDashboard();
        push(); // the imported backup replaces the online copy too
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

  // ─────────────────────────── Levantine (spoken) ───────────────────────────
  // Sentence cards built on the core words. Stored in state.lv, so they never count toward the word count / city.
  // A new sentence is first shown Levantine → English (understand it); once passed, the "say it" card
  // (English → Levantine, out loud) joins the deck.
  var LV = window.LEVANTINE || [];
  var LV_BY_ID = {};
  LV.forEach(function (x) { LV_BY_ID[x.id] = x; });
  var LV_NEW_ORDER = NEW_ORDER.filter(function (w) { return LV_BY_ID[w.id]; }).map(function (w) { return LV_BY_ID[w.id]; });
  function lvTheme(x) { return BY_ID[x.id] ? BY_ID[x.id].theme : ''; }
  function lvCard(key) { return state.lv.cards[key]; }
  function lvStarted(x) { return !!(lvCard(x.id + ':ar') || lvCard(x.id + ':en')); }
  function lvStatus(x) {
    var a = lvCard(x.id + ':ar'), e = lvCard(x.id + ':en');
    if (!a && !e) return 'new';
    return a && e && a.interval >= LEARNED_DAYS && e.interval >= LEARNED_DAYS ? 'learned' : 'learning';
  }
  function lvIntroducedToday() { return state.lv.introduced[dayKey()] || 0; }
  function lvNewLeft() { return Math.min(Math.max(0, state.settings.lvNewPerDay - lvIntroducedToday()), LV.filter(function (x) { return !lvStarted(x); }).length); }
  function lvCountDue() {
    var end = startOfDay() + DAY, n = 0;
    Object.keys(state.lv.cards).forEach(function (k) { if (state.lv.cards[k].due < end) n++; });
    LV.forEach(function (x) { if (lvCard(x.id + ':ar') && !lvCard(x.id + ':en')) n++; });
    return n;
  }
  function lvBuildQueue(opts) {
    opts = opts || {};
    var now = Date.now(), due = [];
    var pool = opts.theme ? LV.filter(function (x) { return lvTheme(x) === opts.theme; }) : LV;
    pool.forEach(function (x) {
      ['ar', 'en'].forEach(function (d) {
        var key = x.id + ':' + d, c = lvCard(key);
        if (c && c.due <= now) due.push(key);
        if (!c && d === 'en' && lvCard(x.id + ':ar')) due.push(key); // "say it" opens once understood
      });
    });
    var newLimit = opts.extraNew != null ? opts.extraNew : Math.max(0, state.settings.lvNewPerDay - lvIntroducedToday());
    var order = opts.theme ? pool : LV_NEW_ORDER;
    var fresh = order.filter(function (x) { return !lvStarted(x); }).slice(0, newLimit).map(function (x) { return x.id + ':ar'; });
    var q = shuffle(due);
    fresh.forEach(function (k, i) { q.splice(Math.min(q.length, Math.floor(q.length / 2) + i * 2), 0, k); });
    return q;
  }

  // ── record yourself (speaking practice) ──
  var rec = { mr: null, chunks: [], url: null };
  function canRecord() { return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder); }
  function stopRecording() { if (rec.mr && rec.mr.state === 'recording') rec.mr.stop(); }
  function toggleRecording() {
    if (rec.mr && rec.mr.state === 'recording') { rec.mr.stop(); return; }
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      var mr = new MediaRecorder(stream);
      rec.mr = mr; rec.chunks = [];
      mr.ondataavailable = function (e) { if (e.data && e.data.size) rec.chunks.push(e.data); };
      mr.onstop = function () {
        stream.getTracks().forEach(function (t) { t.stop(); });
        if (rec.url) URL.revokeObjectURL(rec.url);
        rec.url = URL.createObjectURL(new Blob(rec.chunks, { type: mr.mimeType || 'audio/webm' }));
        var btn = $('#rec-btn'), player = $('#rec-player');
        if (btn) { btn.classList.remove('recording'); btn.innerHTML = micIcon() + ' Record again'; }
        if (player) { player.src = rec.url; player.hidden = false; player.play().catch(function () {}); }
      };
      mr.start();
      var btn = $('#rec-btn');
      if (btn) { btn.classList.add('recording'); btn.innerHTML = '<i class="rec-dot" aria-hidden="true"></i> Stop'; }
    }).catch(function () { toast('Microphone not available. Allow it in your browser to record yourself.'); });
  }
  function micIcon() {
    return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3"/></svg>';
  }
  document.addEventListener('click', function (e) { if (e.target.closest('#rec-btn')) toggleRecording(); });

  function lvSpeakBtn(text, label) {
    return '<button class="btn icon-btn" data-speak="' + esc(text) + '" data-voice="lv" aria-label="' + esc(label) + '">' + speakerIcon() + ' ' + esc(label) + '</button>';
  }
  function lvDetailsHTML(x, withRecorder) {
    var msa = BY_ID[x.id];
    var rows = x.p.map(function (r) {
      return '<div class="bd-row"><span class="ar" lang="ar">' + ar(r[0]) + '</span>' +
        '<span class="tr">' + esc(r[1]) + '</span>' +
        '<span><strong>' + esc(r[2]) + '</strong>' + (r[3] ? '<span class="note">' + arMixed(r[3]) + '</span>' : '') + '</span></div>';
    }).join('');
    return '' +
      '<div class="head">' +
        '<div class="ar lv-sentence" lang="apc">' + ar(x.s.ar) + '</div>' +
        '<div class="translit">' + esc(x.s.tr) + '</div>' +
        '<div class="meaning lv-meaning">' + esc(x.s.en) + '</div>' +
        '<div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center">' +
          lvSpeakBtn(x.s.ar, 'Listen') +
          (withRecorder && canRecord() ? '<button class="btn rec" id="rec-btn">' + micIcon() + ' Record yourself</button>' : '') +
        '</div>' +
        (withRecorder ? '<audio id="rec-player" controls hidden></audio>' : '') +
      '</div>' +
      '<div class="divider"></div>' +
      '<div class="lv-key">' +
        '<div class="lv-key-item"><span class="label">Key word</span><span class="ar" lang="apc">' + ar(x.w[0]) + '</span><span><em>' + esc(x.w[1]) + '</em> · ' + esc(x.w[2]) + '</span></div>' +
        (msa ? '<div class="lv-key-item"><span class="label">In standard Arabic</span><span class="ar" lang="ar">' + ar(msa.ar) + '</span><span><em>' + esc(msa.tr) + '</em> · ' + esc(msa.en) + '</span></div>' : '') +
      '</div>' +
      (x.tip ? '<div class="lv-tip">' + arMixed(x.tip) + '</div>' : '') +
      '<div class="stack" style="gap:10px">' +
        '<div class="label">Breakdown</div>' +
        '<div class="breakdown">' + rows + '</div>' +
      '</div>';
  }

  function lvDashboardHTML() {
    if (!LV.length) return '';
    var learned = LV.filter(function (x) { return lvStatus(x) === 'learned'; }).length;
    var due = lvCountDue(), fresh = lvNewLeft();
    return '<section class="panel lv-panel">' +
      '<div><h2 style="margin:0 0 4px">Levantine · speaking</h2>' +
      '<div class="muted small">' + learned + ' of ' + LV.length + ' sentences learned · ' + due + ' due' + (fresh ? ' · ' + fresh + ' new' : '') + ' · not counted in your city</div></div>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap"><a class="btn primary" href="#/lvstudy">Practise speaking</a><a class="btn" href="#/levantine">All sentences</a></div>' +
    '</section>';
  }

  function viewLevantine() {
    var learned = LV.filter(function (x) { return lvStatus(x) === 'learned'; }).length;
    var started = LV.filter(lvStarted).length;
    var due = lvCountDue(), fresh = lvNewLeft();
    var startLabel = due + fresh === 0 ? 'Nothing due — practise anyway' : 'Start session · ' + due + ' due' + (fresh ? ' · ' + fresh + ' new' : '');
    if (!arVoice) pickVoice();
    var groups = THEMES.map(function (t) {
      var xs = LV.filter(function (x) { return lvTheme(x) === t.id; });
      if (!xs.length) return '';
      return '<section class="wgroup"><div class="wgroup-head"><h2>' + esc(t.label) + '</h2><a href="#/lvstudy?theme=' + t.id + '">Study</a></div><div class="lvlist">' + xs.map(function (x) {
        return '<button class="lvitem" data-lv="' + x.id + '"><i class="dot ' + lvStatus(x) + '" aria-hidden="true"></i>' +
          '<span class="lvitem-text"><span class="ar" lang="apc">' + ar(x.s.ar) + '</span><span class="small muted">' + esc(x.s.en) + '</span></span></button>';
      }).join('') + '</div></section>';
    }).join('');

    view.innerHTML = '<div class="stack" style="gap:28px">' +
      '<div class="hello"><div><div class="muted small">Spoken Arabic of Syria, Lebanon, Palestine and Jordan</div>' +
        '<h1 class="greet"><span>Levantine</span><span class="ar" lang="apc">' + ar('شَامِي') + '</span></h1>' +
        '<div class="muted small">The same 100 words, in everyday sentences to say out loud. Not counted in your city.</div></div>' +
        '<a class="btn primary big" href="#/lvstudy">' + esc(startLabel) + '</a></div>' +
      '<div class="tiles">' +
        tile('Sentences learned', learned + '<small> / ' + LV.length + '</small>', started + ' started') +
        tile('Due today', due, fresh + ' new sentences available') +
      '</div>' +
      '<div class="row">' +
        '<section class="panel grow"><h2>How Levantine differs from standard Arabic</h2><div class="cheat">' +
          cheat('ق', 'ʾ (glottal stop)', 'In cities ق is a glottal stop: قَهْوِة ʾahwe “coffee”.') +
          cheat('بْـ', 'b-', 'Before a present verb for everyday “I do”: بْحِبّ bḥebb “I love”.') +
          cheat('عَم', 'ʿam', 'Right now, “-ing”: عَم بِقْرَا ʿam beʾra “I’m reading”.') +
          cheat('رَح', 'raḥ', 'Future, “will”: رَح سَافِر raḥ sāfer “I will travel”.') +
          cheat('بِدِّي', 'beddi', '“I want”: بِدِّي شَاي beddi shāy.') +
          cheat('فِي', 'fī', '“There is / are”; مَا فِي ma fī “there isn’t”.') +
          cheat('مَا / مِش', 'ma / mesh', 'Not: مَا with verbs, مِش with everything else.') +
          cheat('شُو، وَين، كِيف', 'shu, wēn, kīf', 'What, where, how (MSA مَاذَا، أَيْنَ، كَيْفَ).') +
        '</div></section>' +
        '<section class="panel side"><h2>Settings</h2>' +
          '<div class="field"><label for="set-lvnew">New sentences per day</label><select id="set-lvnew">' +
            [3, 5, 10, 15].map(function (n) { return opt(String(n), String(n), String(state.settings.lvNewPerDay)); }).join('') +
          '</select></div>' +
          '<p class="muted small" style="margin:8px 0 0">' + (lvVoiceIsLocal
            ? 'Audio uses your device’s Levantine voice (' + esc(lvVoice.name) + ').'
            : 'Your device reads these with a standard Arabic voice. For a real Levantine accent, open the app in Microsoft Edge, which has Lebanese, Syrian and Jordanian voices.') + '</p>' +
        '</section>' +
      '</div>' +
      '<div class="legend"><span><i class="dot"></i> new</span><span><i class="dot learning"></i> learning</span><span><i class="dot learned"></i> learned</span></div>' +
      groups +
    '</div>';

    $('#set-lvnew').addEventListener('change', function (e) { state.settings.lvNewPerDay = parseInt(e.target.value, 10); save(); viewLevantine(); });
    $all('[data-lv]').forEach(function (b) {
      b.addEventListener('click', function () { openLv(LV_BY_ID[b.getAttribute('data-lv')]); });
    });
  }
  function cheat(arText, tr, note) {
    return '<div class="cheat-item"><span class="ar" lang="apc">' + ar(arText) + '</span><span class="cheat-tr">' + esc(tr) + '</span><span class="small muted">' + arMixed(note) + '</span></div>';
  }
  function openLv(x) {
    var d = document.createElement('dialog');
    d.innerHTML = '<div class="dialog-body"><button class="btn dialog-close" aria-label="Close">Close</button>' + lvDetailsHTML(x, true) + '</div>';
    document.body.appendChild(d);
    d.querySelector('.dialog-close').addEventListener('click', function () { d.close(); });
    d.addEventListener('close', function () { stopRecording(); d.remove(); });
    d.addEventListener('click', function (e) { if (e.target === d) d.close(); });
    d.showModal();
  }

  var lvSession = null;
  function lvStartSession(opts) {
    lvSession = { opts: opts || {}, queue: lvBuildQueue(opts), done: 0, revealed: false, showTr: false, hint: false, stats: { n: 0, ok: 0 } };
    lvSession.total = lvSession.queue.length;
  }
  function viewLvStudy(params) {
    var theme = params.theme || null;
    if (!lvSession || lvSession.opts.theme !== theme || lvSession.finished) lvStartSession({ theme: theme });
    renderLvStudy();
  }
  function renderLvStudy() {
    if (!lvSession) lvStartSession({});
    var S = lvSession;
    var themeLabel = S.opts.theme ? (THEMES.find(function (t) { return t.id === S.opts.theme; }) || {}).label : 'All sentences';
    if (!S.queue.length) return renderLvSummary(themeLabel);
    var key = S.queue[0], id = key.split(':')[0], dir = key.split(':')[1], x = LV_BY_ID[id], card = lvCard(key);
    var pct = Math.round((S.done / (S.done + S.queue.length)) * 100);
    var dirLabel = dir === 'ar' ? 'Listen · what does it mean?' : 'Speak · say it in Levantine';
    var html = '<div class="narrow stack">' +
      '<div class="session-meta"><span>Levantine · ' + esc(themeLabel) + ' · ' + S.queue.length + ' left' + (!lvCard(id + ':ar') && !lvCard(id + ':en') ? ' · <strong>new</strong>' : '') + '</span><span>' + esc(dirLabel) + '</span></div>' +
      '<div class="progress" role="progressbar" aria-valuenow="' + pct + '" aria-valuemin="0" aria-valuemax="100"><div style="width:' + pct + '%"></div></div>';
    if (!S.revealed) {
      if (dir === 'ar') {
        html += '<section class="card front">' +
          '<div class="ar lv-sentence big" lang="apc">' + ar(x.s.ar) + '</div>' +
          (S.showTr ? '<div class="translit">' + esc(x.s.tr) + '</div>' : '') +
          '<div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center">' + lvSpeakBtn(x.s.ar, 'Listen') +
            (S.showTr ? '' : '<button class="btn" id="show-tr" style="border-radius:999px">Show transliteration</button>') +
          '</div></section>';
      } else {
        html += '<section class="card front">' +
          '<div class="label">Say it in Levantine — out loud</div>' +
          '<div class="lv-front-en">' + esc(x.s.en) + '</div>' +
          (S.hint ? '<div class="hint">Key word: <span class="ar" lang="apc" style="font-size:30px">' + ar(x.w[0]) + '</span> <em>' + esc(x.w[1]) + '</em></div>'
                  : '<button class="btn" id="hint" style="border-radius:999px">Hint: key word</button>') +
          (canRecord() ? '<div class="small muted">Tip: record yourself on the next screen and compare.</div>' : '') +
          '</section>';
      }
      html += '<button class="btn primary big block" id="reveal">' + (dir === 'en' ? 'I said it — show the answer' : 'Show answer') + '</button>' +
        '<div class="keys">Space to reveal' + (dir === 'ar' ? ' · P to listen · T for transliteration' : '') + '</div>';
    } else {
      html += '<section class="card">' + lvDetailsHTML(x, true) + '</section>' +
        '<div class="stack" style="gap:10px"><div class="small muted" style="text-align:center">' + (dir === 'en' ? 'How close was what you said?' : 'How well did you understand it?') + '</div>' +
        '<div class="ratings">' + lvRateBtn(1, 'Again', card) + lvRateBtn(2, 'Hard', card) + lvRateBtn(3, 'Good', card) + lvRateBtn(4, 'Easy', card) + '</div>' +
        '<div class="keys">Keys 1 · 2 · 3 · 4 · P to listen' + (canRecord() ? ' · R to record' : '') + '</div></div>';
    }
    html += '</div>';
    view.innerHTML = html;
    var r = $('#reveal'); if (r) r.addEventListener('click', lvReveal);
    var t = $('#show-tr'); if (t) t.addEventListener('click', function () { S.showTr = true; renderLvStudy(); });
    var h = $('#hint'); if (h) h.addEventListener('click', function () { S.hint = true; renderLvStudy(); });
    $all('[data-lvrate]').forEach(function (b) { b.addEventListener('click', function () { lvRate(parseInt(b.getAttribute('data-lvrate'), 10)); }); });
  }
  function lvRateBtn(n, label, card) {
    return '<button class="rate' + (n === 3 ? ' good' : '') + '" data-lvrate="' + n + '"><b>' + label + '</b><span>' + intervalLabel(card, n) + '</span></button>';
  }
  function lvReveal() {
    lvSession.revealed = true;
    renderLvStudy();
    window.scrollTo({ top: 0 });
    var key = lvSession.queue[0];
    if (key.split(':')[1] === 'en') speak(LV_BY_ID[key.split(':')[0]].s.ar, 'lv'); // hear the answer after saying it
  }
  function lvRate(n) {
    stopRecording();
    var S = lvSession, key = S.queue.shift(), id = key.split(':')[0];
    var wasNew = !lvCard(id + ':ar') && !lvCard(id + ':en');
    var c = nextCard(lvCard(key), n);
    state.lv.cards[key] = c;
    if (wasNew) state.lv.introduced[dayKey()] = lvIntroducedToday() + 1;
    logReview(n > 1);
    S.stats.n++; if (n > 1) S.stats.ok++;
    if (c.interval === 0) S.queue.splice(Math.min(S.queue.length, 3), 0, key);
    else {
      S.done++;
      var speakKey = id + ':en';
      if (key.endsWith(':ar') && !lvCard(speakKey) && S.queue.indexOf(speakKey) === -1) S.queue.splice(Math.min(S.queue.length, 5), 0, speakKey);
    }
    save();
    S.revealed = false; S.showTr = false; S.hint = false;
    renderLvStudy();
  }
  function renderLvSummary(themeLabel) {
    var S = lvSession;
    S.finished = S.stats.n > 0 || S.total > 0;
    var remaining = LV.filter(function (x) { return !lvStarted(x) && (!S.opts.theme || lvTheme(x) === S.opts.theme); }).length;
    view.innerHTML = '<div class="narrow stack"><section class="card front">' +
      '<div class="label">Levantine · ' + esc(themeLabel) + '</div>' +
      '<div class="word-en" style="font-size:40px">' + (S.stats.n ? 'Session done' : 'Nothing due right now') + '</div>' +
      (S.stats.n ? '<div class="muted">' + S.stats.n + ' answers · ' + Math.round((S.stats.ok / S.stats.n) * 100) + '% not “Again”</div>' : '<div class="muted">You’re all caught up.</div>') +
      '<div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-top:10px">' +
        (remaining ? '<button class="btn primary" id="lvmore">Learn 5 more sentences</button>' : '') +
        '<a class="btn" href="#/levantine">All sentences</a><a class="btn" href="#/dashboard">Dashboard</a>' +
      '</div></section></div>';
    var m = $('#lvmore');
    if (m) m.addEventListener('click', function () {
      var theme = S.opts.theme || null;
      lvStartSession({ theme: theme, extraNew: 5 });
      lvSession.opts = { theme: theme };
      renderLvStudy();
    });
  }
  document.addEventListener('keydown', function (e) {
    if (route !== 'lvstudy' || !lvSession || e.target.matches('input, select, textarea') || e.metaKey || e.ctrlKey || e.altKey) return;
    if (!lvSession.queue.length) return;
    var key = lvSession.queue[0], x = LV_BY_ID[key.split(':')[0]], dir = key.split(':')[1];
    if (!lvSession.revealed && (e.code === 'Space' || e.key === 'Enter')) { e.preventDefault(); lvReveal(); }
    else if (lvSession.revealed && /^[1-4]$/.test(e.key)) { e.preventDefault(); lvRate(parseInt(e.key, 10)); }
    else if (e.key === 'p' || e.key === 'P') { if (lvSession.revealed || dir === 'ar') speak(x.s.ar, 'lv'); }
    else if ((e.key === 't' || e.key === 'T') && !lvSession.revealed && dir === 'ar') { lvSession.showTr = !lvSession.showTr; renderLvStudy(); }
    else if ((e.key === 'r' || e.key === 'R') && lvSession.revealed && canRecord()) { e.preventDefault(); toggleRecording(); }
  });

  // ─────────────────────────── Word list ───────────────────────────
  var wordQuery = '';
  function viewWords() {
    view.innerHTML = '<div class="stack">' +
      '<input class="search" id="q" type="search" placeholder="Search in English, French, Spanish, Arabic or transliteration" aria-label="Search words" value="' + esc(wordQuery) + '">' +
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
        return w.en.toLowerCase().indexOf(q) > -1 || w.tr.toLowerCase().indexOf(q) > -1 || strip(w.ar).indexOf(qs) > -1 ||
          (w.cog || []).some(function (c) { return c[1].toLowerCase().indexOf(q) > -1; });
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
    else if (route === 'lvstudy') renderLvStudy();
    else if (route === 'levantine') viewLevantine();
    else viewDashboard();
  }
  function onRoute() {
    var hash = location.hash.replace(/^#\/?/, '');
    var name = hash.split('?')[0] || 'dashboard';
    if (['dashboard', 'study', 'words', 'levantine', 'lvstudy'].indexOf(name) === -1) name = 'dashboard';
    if (route === 'lvstudy' && name !== 'lvstudy') stopRecording();
    route = name;
    var navName = name === 'lvstudy' ? 'levantine' : name;
    $all('[data-nav]').forEach(function (a) { a.classList.toggle('active', a.getAttribute('data-nav') === navName); });
    if (name === 'study') viewStudy(currentParams());
    else if (name === 'words') viewWords();
    else if (name === 'levantine') viewLevantine();
    else if (name === 'lvstudy') viewLvStudy(currentParams());
    else viewDashboard();
    window.scrollTo({ top: 0 });
  }
  window.addEventListener('hashchange', onRoute);

  renderControls();
  onRoute();
})();
