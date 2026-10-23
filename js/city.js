/* The growing city: an empty desert that turns into a Dubai-style skyline as vocabulary grows.
   Each element appears at a word count; the last one is "fluent" (FLUENT_WORDS). */
(function () {
  'use strict';

  var FLUENT_WORDS = 5000; // ≈ B2–C1 in Modern Standard Arabic: news, everyday conversation, most texts
  var G = 240;             // ground line
  var C = {
    sand: '#ecd7a9', sandDark: '#dcbd86', dune: '#f3e4c3', trunk: '#8a6a43', leaf: '#3f8a4e', leafDark: '#2f6e3d',
    water: '#a9d3e0', waterLine: '#d6ecf3', wall: '#e6d2a8', wallLine: '#c4a774', glass: '#cfdde3', glassLine: '#93aab4',
    glassDark: '#b6c9d1', road: '#8f8f8f', ink: '#5a4a35'
  };

  // ── small drawing helpers ──
  function palm(x, y, h, s) {
    s = s || 1;
    var tx = x + h * 0.12, ty = y - h;
    var out = '<path d="M' + (x - 1) + ',' + y + ' Q' + (x + h * 0.16) + ',' + (y - h * 0.5) + ' ' + tx + ',' + ty + '" stroke="' + C.trunk + '" stroke-width="' + 3.2 * s + '" fill="none" stroke-linecap="round"/>';
    [-165, -130, -95, -55, -18].forEach(function (a, i) {
      var r = a * Math.PI / 180, len = h * 0.42;
      var ex = tx + Math.cos(r) * len, ey = ty + Math.sin(r) * len + len * 0.55;
      var cx = tx + Math.cos(r) * len * 0.5, cy = ty + Math.sin(r) * len * 0.5 - len * 0.25;
      out += '<path d="M' + tx + ',' + ty + ' Q' + cx + ',' + cy + ' ' + ex + ',' + ey + '" stroke="' + (i % 2 ? C.leafDark : C.leaf) + '" stroke-width="' + 3 * s + '" fill="none" stroke-linecap="round"/>';
    });
    return out;
  }
  function rect(x, y, w, h, fill, stroke) {
    return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + fill + '"' + (stroke ? ' stroke="' + stroke + '" stroke-width="1"' : '') + '/>';
  }
  function tower(x, w, h, fill, stroke, lit) {
    var out = rect(x, G - h, w, h, fill, stroke);
    for (var i = 1; i < w / 6; i++) out += '<line x1="' + (x + i * 6) + '" y1="' + (G - h + 4) + '" x2="' + (x + i * 6) + '" y2="' + (G - 2) + '" stroke="' + stroke + '" stroke-width="0.6" opacity="0.7"/>';
    if (lit) {
      for (var yy = G - h + 8; yy < G - 6; yy += 10) {
        for (var xx = x + 3; xx < x + w - 3; xx += 6) {
          if ((xx * 7 + yy * 3) % 5 < 2) out += rect(xx, yy, 2.5, 3, '#f6c453');
        }
      }
    }
    return out;
  }
  function camel(x, y) {
    var c = '#b88a55';
    return '<ellipse cx="' + x + '" cy="' + (y - 22) + '" rx="16" ry="8" fill="' + c + '"/>' +
      '<ellipse cx="' + (x - 2) + '" cy="' + (y - 29) + '" rx="8" ry="7" fill="' + c + '"/>' +
      '<path d="M' + (x + 12) + ',' + (y - 24) + ' Q' + (x + 18) + ',' + (y - 30) + ' ' + (x + 20) + ',' + (y - 40) + '" stroke="' + c + '" stroke-width="5" fill="none" stroke-linecap="round"/>' +
      '<ellipse cx="' + (x + 24) + '" cy="' + (y - 40) + '" rx="6" ry="3.2" fill="' + c + '"/>' +
      [[-11, -12], [-5, -4], [6, 5], [11, 13]].map(function (l) {
        return '<line x1="' + (x + l[0]) + '" y1="' + (y - 16) + '" x2="' + (x + l[1]) + '" y2="' + y + '" stroke="' + c + '" stroke-width="2.6" stroke-linecap="round"/>';
      }).join('');
  }

  // ── the elements, in the order they appear ──
  // each: words needed, short name, draw(lit) → svg
  var ELEMENTS = [
    { at: 3, name: 'a first palm tree', draw: function () { return palm(115, G, 52); } },
    { at: 8, name: 'a camel', draw: function () { return camel(205, G); } },
    { at: 15, name: 'a Bedouin tent', draw: function () {
      return '<path d="M30,' + G + ' L58,' + (G - 30) + ' L86,' + G + ' Z" fill="#c9a26a"/><path d="M52,' + G + ' L58,' + (G - 16) + ' L64,' + G + ' Z" fill="#7d5c33"/><line x1="58" y1="' + (G - 30) + '" x2="58" y2="' + (G - 38) + '" stroke="#7d5c33" stroke-width="2"/>';
    } },
    { at: 25, name: 'an oasis', draw: function () {
      return '<ellipse cx="160" cy="' + (G + 6) + '" rx="34" ry="6" fill="' + C.water + '"/>' + palm(140, G + 2, 34, 0.8) + palm(182, G + 3, 40, 0.85);
    } },
    { at: 40, name: 'a palm grove', draw: function () { return palm(262, G, 46) + palm(281, G, 36, 0.85) + palm(248, G, 30, 0.75); } },
    { at: 60, name: 'a wind-tower house', draw: function () {
      var x = 330;
      return rect(x - 26, G - 30, 52, 30, C.wall, C.wallLine) + rect(x - 9, G - 56, 18, 26, C.wall, C.wallLine) +
        [x - 5, x, x + 5].map(function (sx) { return '<line x1="' + sx + '" y1="' + (G - 52) + '" x2="' + sx + '" y2="' + (G - 36) + '" stroke="' + C.wallLine + '" stroke-width="1.5"/>'; }).join('') +
        rect(x - 4, G - 14, 8, 14, '#a07c4a');
    } },
    { at: 90, name: 'the creek with a dhow', water: true, draw: function () {
      var x = 470, y = 270;
      return '<path d="M' + (x - 24) + ',' + y + ' Q' + x + ',' + (y + 9) + ' ' + (x + 26) + ',' + (y - 4) + ' L' + (x - 24) + ',' + y + ' Z" fill="#8a5a2b"/>' +
        '<line x1="' + x + '" y1="' + (y - 1) + '" x2="' + x + '" y2="' + (y - 34) + '" stroke="#6b4521" stroke-width="1.5"/>' +
        '<path d="M' + (x + 1) + ',' + (y - 33) + ' L' + (x + 20) + ',' + (y - 6) + ' L' + (x + 1) + ',' + (y - 5) + ' Z" fill="#ffffff" stroke="#cfcfcf"/>';
    } },
    { at: 130, name: 'a mosque', draw: function () {
      var x = 400;
      return rect(x - 22, G - 24, 44, 24, '#f2ead8', C.wallLine) +
        '<path d="M' + (x - 14) + ',' + (G - 24) + ' Q' + (x - 14) + ',' + (G - 46) + ' ' + x + ',' + (G - 50) + ' Q' + (x + 14) + ',' + (G - 46) + ' ' + (x + 14) + ',' + (G - 24) + ' Z" fill="#e8dcc0" stroke="' + C.wallLine + '"/>' +
        rect(x + 27, G - 72, 7, 72, '#f2ead8', C.wallLine) + '<path d="M' + (x + 26) + ',' + (G - 72) + ' L' + (x + 30.5) + ',' + (G - 84) + ' L' + (x + 35) + ',' + (G - 72) + ' Z" fill="#e8dcc0" stroke="' + C.wallLine + '"/>';
    } },
    { at: 200, name: 'a souk', draw: function () {
      var x = 486, out = rect(x - 40, G - 26, 80, 26, C.wall, C.wallLine);
      for (var i = 0; i < 4; i++) {
        var ax = x - 30 + i * 20;
        out += '<path d="M' + (ax - 6) + ',' + G + ' L' + (ax - 6) + ',' + (G - 12) + ' Q' + ax + ',' + (G - 22) + ' ' + (ax + 6) + ',' + (G - 12) + ' L' + (ax + 6) + ',' + G + ' Z" fill="#b48a55"/>';
      }
      return out;
    } },
    { at: 300, name: 'a road with street lights', draw: function () {
      var out = rect(290, G - 2, 710, 9, C.road) + '<line x1="292" y1="' + (G + 2.5) + '" x2="998" y2="' + (G + 2.5) + '" stroke="#fff" stroke-width="1" stroke-dasharray="8 8"/>';
      for (var x = 300; x < 1000; x += 64) out += '<line x1="' + x + '" y1="' + (G - 2) + '" x2="' + x + '" y2="' + (G - 22) + '" stroke="#777" stroke-width="1.2"/><circle cx="' + x + '" cy="' + (G - 23) + '" r="2" fill="#f6c453"/>';
      return out;
    } },
    { at: 450, name: 'the first apartment blocks', draw: function (lit) {
      return tower(600, 22, 38, C.wall, C.wallLine, lit) + tower(624, 18, 52, '#efe3c6', C.wallLine, lit) + tower(644, 20, 30, C.wall, C.wallLine, lit);
    } },
    { at: 650, name: 'a glass office tower', draw: function (lit) { return tower(668, 24, 118, C.glass, C.glassLine, lit); } },
    { at: 900, name: 'the marina towers', draw: function (lit) {
      return tower(786, 20, 150, C.glassDark, C.glassLine, lit) + tower(808, 18, 120, C.glass, C.glassLine, lit) + tower(828, 22, 170, C.glassDark, C.glassLine, lit) + tower(852, 16, 104, C.glass, C.glassLine, lit);
    } },
    { at: 1200, name: 'the metro', draw: function () {
      var y = 212, out = '<line x1="430" y1="' + y + '" x2="996" y2="' + y + '" stroke="#9aa4a8" stroke-width="3"/>';
      for (var x = 450; x < 1000; x += 70) out += '<line x1="' + x + '" y1="' + y + '" x2="' + x + '" y2="' + (G - 2) + '" stroke="#b8c0c3" stroke-width="3"/>';
      return out + '<rect x="540" y="' + (y - 9) + '" width="70" height="8" rx="3" fill="#ffffff" stroke="#9aa4a8"/><rect x="546" y="' + (y - 7) + '" width="58" height="3" fill="#1f6feb" opacity="0.6"/>';
    } },
    { at: 1600, name: 'a twisting tower', draw: function (lit) {
      var out = '';
      for (var i = 0; i < 12; i++) {
        var off = Math.sin(i * 0.55) * 5;
        out += rect(874 + off, G - 14 - i * 13, 24, 13, i % 2 ? C.glass : C.glassDark, C.glassLine);
        if (lit && i % 2) out += rect(880 + off, G - 9 - i * 13, 3, 3, '#f6c453') + rect(889 + off, G - 9 - i * 13, 3, 3, '#f6c453');
      }
      return out;
    } },
    { at: 2100, name: 'a cluster of skyscrapers', draw: function (lit) {
      return tower(912, 20, 136, C.glass, C.glassLine, lit) + tower(934, 24, 178, C.glassDark, C.glassLine, lit) + tower(960, 18, 124, C.glass, C.glassLine, lit) + tower(980, 16, 90, C.glassDark, C.glassLine, lit);
    } },
    { at: 2700, name: 'a palm-shaped island', water: true, draw: function () {
      var x = 190, y = 284, out = rect(x - 3, y - 2, 6, 16, C.sand);
      [-150, -120, -90, -60, -30].forEach(function (a) {
        var r = a * Math.PI / 180;
        out += '<line x1="' + x + '" y1="' + y + '" x2="' + (x + Math.cos(r) * 46) + '" y2="' + (y + Math.sin(r) * 14 + 10) + '" stroke="' + C.sand + '" stroke-width="4" stroke-linecap="round"/>';
      });
      return out + '<path d="M' + (x - 58) + ',' + (y + 4) + ' Q' + x + ',' + (y - 22) + ' ' + (x + 58) + ',' + (y + 4) + '" stroke="' + C.sand + '" stroke-width="3" fill="none"/>';
    } },
    { at: 3300, name: 'an observation wheel', draw: function () {
      var cx = 560, cy = G - 54, r = 42, out = '';
      out += '<line x1="' + (cx - 20) + '" y1="' + (G - 2) + '" x2="' + cx + '" y2="' + cy + '" stroke="#8d989c" stroke-width="3"/><line x1="' + (cx + 20) + '" y1="' + (G - 2) + '" x2="' + cx + '" y2="' + cy + '" stroke="#8d989c" stroke-width="3"/>';
      out += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="#8d989c" stroke-width="2"/>';
      for (var i = 0; i < 12; i++) {
        var a = i * Math.PI / 6;
        out += '<line x1="' + cx + '" y1="' + cy + '" x2="' + (cx + Math.cos(a) * r) + '" y2="' + (cy + Math.sin(a) * r) + '" stroke="#b8c0c3" stroke-width="0.8"/>';
        out += '<circle cx="' + (cx + Math.cos(a) * r) + '" cy="' + (cy + Math.sin(a) * r) + '" r="2.6" fill="#ffffff" stroke="#8d989c"/>';
      }
      return out;
    } },
    { at: 4000, name: 'the tallest tower', draw: function (lit) {
      var x = 742, s = [[22, 0], [22, 62], [16, 62], [16, 122], [10, 122], [10, 172], [5, 172], [4, 206], [0, 238]];
      var left = s.map(function (p) { return (x - p[0]) + ',' + (G - p[1]); });
      var right = s.slice().reverse().map(function (p) { return (x + p[0]) + ',' + (G - p[1]); });
      var out = '<polygon points="' + left.concat(right).join(' ') + '" fill="' + C.glassDark + '" stroke="' + C.glassLine + '"/>';
      out += '<line x1="' + x + '" y1="' + (G - 2) + '" x2="' + x + '" y2="' + (G - 200) + '" stroke="' + C.glassLine + '" stroke-width="0.8"/>';
      if (lit) for (var yy = G - 12; yy > G - 170; yy -= 12) out += rect(x - 6, yy, 3, 3, '#f6c453') + rect(x + 3, yy - 5, 3, 3, '#f6c453');
      return out;
    } },
    { at: FLUENT_WORDS, name: 'fireworks — you’re fluent!', draw: function () {
      var out = '';
      [[540, 60, '#d9480f'], [640, 40, '#1f6feb'], [380, 50, '#2fa35a'], [480, 30, '#8b3fd9']].forEach(function (f) {
        for (var i = 0; i < 10; i++) {
          var a = i * Math.PI / 5;
          out += '<line x1="' + (f[0] + Math.cos(a) * 5) + '" y1="' + (f[1] + Math.sin(a) * 5) + '" x2="' + (f[0] + Math.cos(a) * 18) + '" y2="' + (f[1] + Math.sin(a) * 18) + '" stroke="' + f[2] + '" stroke-width="2" stroke-linecap="round"/>';
        }
      });
      return out;
    } }
  ];

  var uid = 0;
  function render(words, opts) {
    opts = opts || {};
    var all = !!opts.preview;
    var unlocked = ELEMENTS.filter(function (e) { return all || words >= e.at; });
    var lit = all || words >= FLUENT_WORDS;
    var water = unlocked.some(function (e) { return e.water; });
    var gid = 'sky' + (++uid);
    var newFrom = opts.newFrom == null ? Infinity : opts.newFrom;

    var svg = '<svg class="city-svg" viewBox="0 0 1000 300" role="img" aria-label="Your city: ' + unlocked.length + ' of ' + ELEMENTS.length + ' landmarks built" preserveAspectRatio="xMidYMax meet">' +
      '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + (lit ? '#1d2747' : '#ffffff') + '"/><stop offset="1" stop-color="' + (lit ? '#4b4f79' : '#fbf1de') + '"/></linearGradient></defs>' +
      '<rect width="1000" height="300" fill="url(#' + gid + ')"/>' +
      (lit ? '<circle cx="250" cy="55" r="20" fill="#f4efe1"/>' : '<circle cx="880" cy="70" r="28" fill="#f2b544" opacity="0.9"/>') +
      '<path d="M0,' + (G - 18) + ' Q120,' + (G - 48) + ' 260,' + (G - 20) + ' T560,' + (G - 22) + ' T1000,' + (G - 28) + ' L1000,' + G + ' L0,' + G + ' Z" fill="' + C.dune + '"/>' +
      rect(0, G, 1000, 60, C.sand) +
      '<path d="M0,' + (G + 30) + ' Q160,' + (G + 6) + ' 330,' + (G + 26) + ' T700,' + (G + 24) + ' T1000,' + (G + 20) + ' L1000,300 L0,300 Z" fill="' + C.sandDark + '" opacity="0.55"/>';
    if (water) {
      svg += rect(0, G + 12, 1000, 48, C.water);
      for (var i = 0; i < 9; i++) svg += '<line x1="' + (30 + i * 115) + '" y1="' + (G + 26 + (i % 3) * 9) + '" x2="' + (70 + i * 115) + '" y2="' + (G + 26 + (i % 3) * 9) + '" stroke="' + C.waterLine + '" stroke-width="2" stroke-linecap="round"/>';
    }
    // draw tall buildings before small foreground things so nothing important is hidden
    var order = unlocked.map(function (e) { return { e: e, i: ELEMENTS.indexOf(e) }; });
    var back = ['the marina towers', 'a glass office tower', 'the tallest tower', 'a twisting tower', 'a cluster of skyscrapers', 'an observation wheel'];
    order.sort(function (a, b) { return (back.indexOf(b.e.name) > -1) - (back.indexOf(a.e.name) > -1) || a.i - b.i; });
    order.forEach(function (o) {
      svg += '<g class="el' + (o.i >= newFrom ? ' new' : '') + '">' + o.e.draw(lit) + '</g>';
    });
    svg += '</svg>';

    var next = ELEMENTS.find(function (e) { return words < e.at; });
    return { svg: svg, unlocked: ELEMENTS.filter(function (e) { return words >= e.at; }).length, total: ELEMENTS.length, next: next, last: ELEMENTS.filter(function (e) { return words >= e.at; }).pop() };
  }

  window.CITY = { render: render, FLUENT_WORDS: FLUENT_WORDS, ELEMENTS: ELEMENTS };
})();
