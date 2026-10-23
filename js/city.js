/* The growing city: a circular, flat-style vignette. An empty desert inside a sky circle slowly
   becomes a Dubai-style skyline as vocabulary grows. The last landmark appears at FLUENT_WORDS. */
(function () {
  'use strict';

  var FLUENT_WORDS = 5000; // ≈ B2–C1 in Modern Standard Arabic: news, everyday conversation, most texts
  var G = 860;             // where everything stands
  var CX = 500, CY = 480, R = 390; // sky circle

  var C = {
    sky: '#c6e9fb', skyNight: '#24325c', sun: '#eaa93b', moon: '#f3eedc',
    dune: '#f8d893', duneShade: '#e8c07f', duneDeep: '#d9a965',
    trunk: '#9a7346', leaf: '#4f9a5a', leafDark: '#3a7d47', tree: '#6b7d3a', treeDark: '#566a2c',
    wall: '#f4e3bf', wallShade: '#dcc290', wallDeep: '#b8945a',
    steelL: '#8b99b1', steelR: '#5f6d87', steelTop: '#3f485c',
    glassL: '#b9c9e8', glassR: '#7895cc', band: '#6f6873', bandLight: '#cfc8cc',
    window: '#d3dcec', lit: '#f6c453', water: '#a3d6ec', waterLine: '#d7eef8', plate: '#dfe5f0'
  };

  // ── drawing helpers ──
  function hash(a, b) { var h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >> 13)) * 1274126177; return Math.abs(h ^ (h >> 16)); }
  function r(x, y, w, h, fill, extra) { return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + fill + '"' + (extra || '') + '/>'; }

  // a building column with a lit left half, a shaded right half, rounded top, bands and window dots
  function column(x, w, h, o) {
    o = o || {};
    var L = o.L || C.steelL, Rr = o.R || C.steelR, top = G - h, rad = Math.min(w / 2, o.round == null ? 5 : o.round), mid = x + w / 2;
    var out = '<path d="M' + x + ',' + G + ' L' + x + ',' + (top + rad) + ' Q' + x + ',' + top + ' ' + (x + rad) + ',' + top + ' L' + mid + ',' + top + ' L' + mid + ',' + G + ' Z" fill="' + L + '"/>' +
      '<path d="M' + mid + ',' + G + ' L' + mid + ',' + top + ' L' + (x + w - rad) + ',' + top + ' Q' + (x + w) + ',' + top + ' ' + (x + w) + ',' + (top + rad) + ' L' + (x + w) + ',' + G + ' Z" fill="' + Rr + '"/>';
    if (o.bands) {
      for (var by = top + o.bands; by < G - 20; by += o.bands) {
        out += r(x, by, w, 7, C.band) + r(mid - w * 0.08, by, w * 0.3, 7, C.bandLight);
      }
    }
    var lit = o.lit, step = 9;
    for (var yy = top + 10; yy < G - 8; yy += step) {
      for (var xx = x + 4; xx < x + w - 4; xx += 7) {
        var k = hash(Math.round(xx), Math.round(yy)) % 9;
        if (k < (lit ? 3 : 1)) out += r(xx, yy, 2.4, 3, lit ? C.lit : C.window, ' opacity="' + (lit ? 1 : 0.85) + '"');
      }
    }
    return out;
  }
  // a box building (warm stone) with a shaded side
  function box(x, w, h, shade) {
    var s = shade || w * 0.28;
    return r(x, G - h, w - s, h, C.wall) + r(x + w - s, G - h, s, h, C.wallShade);
  }
  function palm(x, y, h, s) {
    s = s || 1;
    var tx = x + h * 0.12, ty = y - h;
    var out = '<path d="M' + (x - 1) + ',' + y + ' Q' + (x + h * 0.16) + ',' + (y - h * 0.5) + ' ' + tx + ',' + ty + '" stroke="' + C.trunk + '" stroke-width="' + 4.5 * s + '" fill="none" stroke-linecap="round"/>';
    [-165, -130, -95, -55, -18].forEach(function (a, i) {
      var rr = a * Math.PI / 180, len = h * 0.45;
      var ex = tx + Math.cos(rr) * len, ey = ty + Math.sin(rr) * len + len * 0.55;
      var cx = tx + Math.cos(rr) * len * 0.5, cy = ty + Math.sin(rr) * len * 0.5 - len * 0.25;
      out += '<path d="M' + tx + ',' + ty + ' Q' + cx + ',' + cy + ' ' + ex + ',' + ey + '" stroke="' + (i % 2 ? C.leafDark : C.leaf) + '" stroke-width="' + 4.5 * s + '" fill="none" stroke-linecap="round"/>';
    });
    return out;
  }
  function tree(x, y, s) {
    s = s || 1;
    return '<line x1="' + x + '" y1="' + y + '" x2="' + x + '" y2="' + (y - 8 * s) + '" stroke="#5b4630" stroke-width="2"/>' +
      '<circle cx="' + (x - 4 * s) + '" cy="' + (y - 11 * s) + '" r="' + 6 * s + '" fill="' + C.tree + '"/>' +
      '<circle cx="' + (x + 4 * s) + '" cy="' + (y - 12 * s) + '" r="' + 6.5 * s + '" fill="' + C.treeDark + '"/>' +
      '<circle cx="' + x + '" cy="' + (y - 16 * s) + '" r="' + 5.5 * s + '" fill="' + C.tree + '"/>';
  }
  function scaled(x, s, svg) { return '<g transform="translate(' + x + ',' + G + ') scale(' + s + ') translate(' + (-x) + ',' + (-G) + ')">' + svg + '</g>'; }
  function camel(x, y) {
    var c = '#c98f55', d = '#a9733f';
    return '<ellipse cx="' + x + '" cy="' + (y - 30) + '" rx="22" ry="11" fill="' + c + '"/>' +
      '<ellipse cx="' + (x - 3) + '" cy="' + (y - 40) + '" rx="11" ry="10" fill="' + c + '"/>' +
      '<path d="M' + (x + 16) + ',' + (y - 33) + ' Q' + (x + 24) + ',' + (y - 41) + ' ' + (x + 27) + ',' + (y - 55) + '" stroke="' + c + '" stroke-width="7" fill="none" stroke-linecap="round"/>' +
      '<ellipse cx="' + (x + 32) + '" cy="' + (y - 55) + '" rx="8" ry="4.5" fill="' + c + '"/>' +
      [[-15, -16, d], [-7, -6, c], [8, 7, d], [15, 17, c]].map(function (l) {
        return '<line x1="' + (x + l[0]) + '" y1="' + (y - 22) + '" x2="' + (x + l[1]) + '" y2="' + y + '" stroke="' + l[2] + '" stroke-width="3.5" stroke-linecap="round"/>';
      }).join('');
  }

  // ── landmarks, in the order they appear. z: lower draws further back ──
  var ELEMENTS = [
    { at: 3, name: 'a first palm tree', z: 20, draw: function () { return palm(232, G, 104); } },
    { at: 8, name: 'a camel', z: 21, draw: function () { return scaled(296, 1.4, camel(296, G)); } },
    { at: 15, name: 'a Bedouin tent', z: 19, draw: function () {
      return scaled(178, 1.35, '<path d="M140,' + G + ' L180,' + (G - 42) + ' L180,' + G + ' Z" fill="#d7ad6f"/><path d="M180,' + G + ' L180,' + (G - 42) + ' L222,' + G + ' Z" fill="#b98c4f"/>' +
        '<path d="M172,' + G + ' L180,' + (G - 22) + ' L188,' + G + ' Z" fill="#6e5030"/>');
    } },
    { at: 25, name: 'an oasis', z: 18, draw: function () {
      return '<ellipse cx="724" cy="' + (G + 6) + '" rx="46" ry="8" fill="' + C.water + '"/>' + palm(700, G + 2, 70, 0.95) + palm(748, G + 3, 86, 1);
    } },
    { at: 40, name: 'a palm grove', z: 17, draw: function () { return palm(804, G, 92) + palm(832, G, 68, 0.9) + palm(780, G, 60, 0.8); } },
    { at: 60, name: 'a wind-tower house', z: 12, draw: function () {
      var x = 336;
      return box(x, 64, 40) + box(x + 18, 24, 74, 8) +
        [x + 22, x + 27, x + 32].map(function (sx) { return '<line x1="' + sx + '" y1="' + (G - 68) + '" x2="' + sx + '" y2="' + (G - 46) + '" stroke="' + C.wallDeep + '" stroke-width="2"/>'; }).join('') +
        r(x + 8, G - 18, 10, 18, C.wallDeep);
    } },
    { at: 90, name: 'the creek with a dhow', z: 30, water: true, draw: function () {
      var x = 760, y = 896;
      return '<path d="M' + (x - 30) + ',' + y + ' Q' + x + ',' + (y + 11) + ' ' + (x + 32) + ',' + (y - 5) + ' L' + (x - 30) + ',' + y + ' Z" fill="#8a5a2b"/>' +
        '<line x1="' + x + '" y1="' + (y - 1) + '" x2="' + x + '" y2="' + (y - 44) + '" stroke="#6b4521" stroke-width="2"/>' +
        '<path d="M' + (x + 1) + ',' + (y - 43) + ' L' + (x + 26) + ',' + (y - 8) + ' L' + (x + 1) + ',' + (y - 7) + ' Z" fill="#ffffff" stroke="#d5d5d5"/>';
    } },
    { at: 130, name: 'a mosque', z: 12, draw: function () {
      var x = 612;
      return box(x, 56, 34) +
        '<path d="M' + (x + 10) + ',' + (G - 34) + ' Q' + (x + 10) + ',' + (G - 62) + ' ' + (x + 28) + ',' + (G - 66) + ' L' + (x + 28) + ',' + (G - 34) + ' Z" fill="' + C.wall + '"/>' +
        '<path d="M' + (x + 28) + ',' + (G - 66) + ' Q' + (x + 46) + ',' + (G - 62) + ' ' + (x + 46) + ',' + (G - 34) + ' L' + (x + 28) + ',' + (G - 34) + ' Z" fill="' + C.wallShade + '"/>' +
        r(x + 62, G - 96, 5, 96, C.wall) + r(x + 67, G - 96, 4, 96, C.wallShade) +
        '<path d="M' + (x + 61) + ',' + (G - 96) + ' L' + (x + 66.5) + ',' + (G - 112) + ' L' + (x + 72) + ',' + (G - 96) + ' Z" fill="' + C.wallShade + '"/>';
    } },
    { at: 200, name: 'a souk', z: 13, draw: function () {
      var x = 452, out = box(x, 96, 34);
      for (var i = 0; i < 4; i++) {
        var ax = x + 13 + i * 21;
        out += '<path d="M' + (ax - 6) + ',' + G + ' L' + (ax - 6) + ',' + (G - 14) + ' Q' + ax + ',' + (G - 26) + ' ' + (ax + 6) + ',' + (G - 14) + ' L' + (ax + 6) + ',' + G + ' Z" fill="' + C.wallDeep + '"/>';
      }
      return out;
    } },
    { at: 300, name: 'a boulevard with trees', z: 22, plate: true, draw: function () {
      return [318, 404, 590, 676].map(function (x) { return tree(x, G + 4, 1.1); }).join('');
    } },
    { at: 450, name: 'the first apartment blocks', z: 9, draw: function (lit) {
      return column(420, 38, 88, { L: C.wall, R: C.wallShade, round: 2, lit: lit }) + column(548, 42, 74, { L: C.wall, R: C.wallShade, round: 2, lit: lit });
    } },
    { at: 650, name: 'a glass office tower', z: 6, draw: function (lit) {
      return column(636, 42, 270, { L: C.glassL, R: C.glassR, bands: 60, lit: lit });
    } },
    { at: 900, name: 'the marina towers', z: 5, draw: function (lit) {
      return column(300, 40, 230, { lit: lit }) + column(344, 36, 300, { L: C.glassL, R: C.glassR, bands: 70, lit: lit }) + column(384, 30, 250, { lit: lit });
    } },
    { at: 1200, name: 'the metro', z: 10, draw: function () {
      var y = 792, out = r(290, y, 420, 6, '#a9b3c4', ' rx="3"');
      for (var x = 312; x < 710; x += 66) out += r(x - 3, y + 6, 6, G - y - 6, '#c3cad6');
      return out + r(470, y - 13, 96, 13, '#ffffff', ' rx="6" stroke="#a9b3c4"') + r(478, y - 9, 80, 4, '#1f6feb', ' opacity="0.55"');
    } },
    { at: 1600, name: 'a twisting tower', z: 4, draw: function (lit) {
      var out = '', n = 18, h = 18;
      for (var i = 0; i < n; i++) {
        var off = Math.sin(i * 0.45) * 7, x = 688 + off, y = G - (i + 1) * h;
        out += r(x, y, 18, h - 2, i % 2 ? C.steelL : C.glassL) + r(x + 18, y, 16, h - 2, i % 2 ? C.steelR : C.glassR);
        if (lit && i % 3 === 1) out += r(x + 5, y + 6, 3, 3, C.lit) + r(x + 23, y + 6, 3, 3, C.lit);
      }
      return out;
    } },
    { at: 2100, name: 'a cluster of skyscrapers', z: 3, draw: function (lit) {
      return column(398, 34, 360, { bands: 80, lit: lit }) + column(566, 40, 400, { L: C.glassL, R: C.glassR, bands: 90, lit: lit }) + column(604, 28, 310, { lit: lit });
    } },
    { at: 2700, name: 'a palm-shaped island', z: 31, water: true, draw: function () {
      var x = 250, y = 894, sand = '#f4d58f', out = r(x - 4, y - 2, 8, 14, sand);
      [-155, -125, -90, -55, -25].forEach(function (a) {
        var rr = a * Math.PI / 180;
        out += '<line x1="' + x + '" y1="' + y + '" x2="' + (x + Math.cos(rr) * 52) + '" y2="' + (y + Math.sin(rr) * 10 + 7) + '" stroke="' + sand + '" stroke-width="5" stroke-linecap="round"/>';
      });
      return out;
    } },
    { at: 3300, name: 'an observation wheel', z: 7, draw: function () {
      var cx = 312, cy = G - 84, rr = 60, out = '';
      out += '<line x1="' + (cx - 26) + '" y1="' + G + '" x2="' + cx + '" y2="' + cy + '" stroke="#8d98a8" stroke-width="5"/><line x1="' + (cx + 26) + '" y1="' + G + '" x2="' + cx + '" y2="' + cy + '" stroke="#6f7a8a" stroke-width="5"/>';
      out += '<circle cx="' + cx + '" cy="' + cy + '" r="' + rr + '" fill="none" stroke="#8d98a8" stroke-width="4"/>';
      for (var i = 0; i < 14; i++) {
        var a = i * Math.PI / 7;
        out += '<line x1="' + cx + '" y1="' + cy + '" x2="' + (cx + Math.cos(a) * rr) + '" y2="' + (cy + Math.sin(a) * rr) + '" stroke="#b8c1cc" stroke-width="1.2"/>';
        out += '<circle cx="' + (cx + Math.cos(a) * rr) + '" cy="' + (cy + Math.sin(a) * rr) + '" r="5" fill="#ffffff" stroke="#8d98a8" stroke-width="1.5"/>';
      }
      return out;
    } },
    { at: 4000, name: 'the tallest tower', z: 1, draw: function (lit) {
      // clustered columns stepping up to a central spire
      var cols = [[-50, 22, 250], [-38, 24, 360], [-26, 24, 480], [-14, 28, 600], [10, 24, 530], [22, 24, 410], [34, 22, 300]];
      var out = '';
      cols.slice().sort(function (a, b) { return b[2] - a[2]; }).forEach(function (c) {
        out += column(CX + c[0], c[1], c[2], { L: c[0] < 0 ? C.steelL : '#7383a0', R: c[0] < 0 ? '#6c7a95' : C.steelR, bands: 115, round: 8, lit: lit });
      });
      out += r(CX - 3, G - 650, 6, 52, C.steelTop) + '<line x1="' + CX + '" y1="' + (G - 650) + '" x2="' + CX + '" y2="' + (G - 690) + '" stroke="' + C.steelTop + '" stroke-width="2.5"/>';
      return out;
    } },
    { at: FLUENT_WORDS, name: 'fireworks — you’re fluent!', z: 0, draw: function () {
      var out = '';
      [[300, 300, '#f08c4a'], [712, 250, '#6fb1ff'], [380, 190, '#5fd28a'], [640, 150, '#c08bff']].forEach(function (f) {
        for (var i = 0; i < 12; i++) {
          var a = i * Math.PI / 6;
          out += '<line x1="' + (f[0] + Math.cos(a) * 8) + '" y1="' + (f[1] + Math.sin(a) * 8) + '" x2="' + (f[0] + Math.cos(a) * 30) + '" y2="' + (f[1] + Math.sin(a) * 30) + '" stroke="' + f[2] + '" stroke-width="3.5" stroke-linecap="round"/>';
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
    var plate = unlocked.some(function (e) { return e.plate; });
    var newFrom = opts.newFrom == null ? Infinity : opts.newFrom;
    var id = 'city' + (++uid);

    var svg = '<svg class="city-svg" viewBox="100 60 800 860" role="img" aria-label="Your city: ' + unlocked.length + ' of ' + ELEMENTS.length + ' landmarks built">' +
            '<circle cx="' + CX + '" cy="' + CY + '" r="' + R + '" fill="' + (lit ? C.skyNight : C.sky) + '"/>';
    // stars at night
    if (lit) for (var s = 0; s < 40; s++) {
      var sx = 150 + hash(s, 7) % 700, sy = 110 + hash(s, 13) % 420;
      if (Math.hypot(sx - CX, sy - CY) < R - 10) svg += '<circle cx="' + sx + '" cy="' + sy + '" r="' + (1 + hash(s, 3) % 2) + '" fill="#ffffff" opacity="0.8"/>';
    }
    svg += lit ? '<circle cx="300" cy="420" r="34" fill="' + C.moon + '"/><circle cx="314" cy="410" r="30" fill="' + C.skyNight + '"/>'
               : '<circle cx="300" cy="560" r="40" fill="' + C.sun + '"/>';
    // dunes spill out of the circle at the bottom
    svg += '<path d="M380,880 Q480,770 600,700 Q700,750 880,880 Z" fill="' + C.dune + '"/>' +
      '<path d="M600,700 Q640,760 700,800 Q660,770 640,745 Z" fill="' + C.duneShade + '" opacity="0.7"/>' +
      '<path d="M120,880 Q240,790 352,722 Q430,770 540,880 Z" fill="' + C.dune + '"/>' +
      '<path d="M352,722 Q330,744 314,770 Q300,792 290,800 Q340,786 352,762 Q342,780 360,770 Q356,742 366,730 Z" fill="' + C.duneShade + '"/>' +
      '<path d="M120,880 Q240,790 352,722 Q260,800 230,880 Z" fill="' + C.duneShade + '" opacity="0.55"/>';
    if (plate) svg += r(282, G - 2, 436, 14, C.plate, ' rx="7"');

    var order = unlocked.map(function (e) { return { e: e, i: ELEMENTS.indexOf(e) }; });
    order.sort(function (a, b) { return a.e.z - b.e.z || a.i - b.i; });
    var city = '', front = '';
    order.forEach(function (o) {
      var g = '<g class="el' + (o.i >= newFrom ? ' new' : '') + '">' + o.e.draw(lit) + '</g>';
      if (o.e.z >= 30) front += g; else city += g;
    });
    svg += city;
    if (water) {
      svg += r(150, 880, 700, 30, C.water, ' rx="15"');
      [[200, 892], [330, 900], [470, 890], [600, 899], [690, 889]].forEach(function (w) {
        svg += '<line x1="' + w[0] + '" y1="' + w[1] + '" x2="' + (w[0] + 34) + '" y2="' + w[1] + '" stroke="' + C.waterLine + '" stroke-width="3" stroke-linecap="round"/>';
      });
    }
    svg += front + '</svg>';

    var done = ELEMENTS.filter(function (e) { return words >= e.at; });
    return { svg: svg, unlocked: done.length, total: ELEMENTS.length, next: ELEMENTS.find(function (e) { return words < e.at; }), last: done[done.length - 1] };
  }

  window.CITY = { render: render, FLUENT_WORDS: FLUENT_WORDS, ELEMENTS: ELEMENTS };
})();
