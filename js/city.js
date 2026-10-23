/* The growing city: a circular, flat-style vignette. An empty desert inside a sky circle slowly
   becomes a Dubai-style skyline as vocabulary grows. 40 levels; from 600 words the skyscrapers
   go up gradually under cranes. Small CSS animations (see styles.css, .city-svg) keep it alive. */
(function () {
  'use strict';

  var FLUENT_WORDS = 5000; // ≈ B2–C1 in Modern Standard Arabic: news, everyday conversation, most texts
  var G = 860;             // where everything stands
  var CX = 500, CY = 480, R = 390; // sky circle

  var C = {
    sky: '#c6e9fb', skyNight: '#24325c', goldTop: '#ffd9a6', goldBottom: '#f7b183', sun: '#eaa93b', sunset: '#ef7a3e', moon: '#f3eedc',
    dune: '#f8d893', duneShade: '#e8c07f',
    trunk: '#9a7346', leaf: '#4f9a5a', leafDark: '#3a7d47', tree: '#6b7d3a', treeDark: '#566a2c',
    wall: '#f4e3bf', wallShade: '#dcc290', wallDeep: '#b8945a',
    steelL: '#8b99b1', steelR: '#5f6d87', steelTop: '#3f485c',
    glassL: '#b9c9e8', glassR: '#7895cc', band: '#6f6873', bandLight: '#cfc8cc',
    window: '#d3dcec', lit: '#f6c453', water: '#a3d6ec', waterLine: '#d7eef8', plate: '#dfe5f0',
    crane: '#e3a62b', craneDark: '#b9821c'
  };

  // ── drawing helpers ──
  function hash(a, b) { var h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >> 13)) * 1274126177; return Math.abs(h ^ (h >> 16)); }
  function r(x, y, w, h, fill, extra) { return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + fill + '"' + (extra || '') + '/>'; }
  function anim(cls, ox, oy, delay) {
    // a <g> with a CSS animation; ox/oy is the pivot in drawing units
    return '<g class="' + cls + '" style="' + (ox != null ? 'transform-origin:' + ox + 'px ' + oy + 'px;' : '') + (delay ? 'animation-delay:-' + delay + 's;' : '') + '">';
  }

  // a building column with a lit left half, a shaded right half, rounded top, bands and window dots
  // mode: 0 day · 1 golden hour · 2 night
  function column(x, w, h, o) {
    o = o || {};
    var L = o.L || C.steelL, Rr = o.R || C.steelR, top = G - h, rad = Math.min(w / 2, h / 2, o.round == null ? 5 : o.round), mid = x + w / 2;
    var out = '<path d="M' + x + ',' + G + ' L' + x + ',' + (top + rad) + ' Q' + x + ',' + top + ' ' + (x + rad) + ',' + top + ' L' + mid + ',' + top + ' L' + mid + ',' + G + ' Z" fill="' + L + '"/>' +
      '<path d="M' + mid + ',' + G + ' L' + mid + ',' + top + ' L' + (x + w - rad) + ',' + top + ' Q' + (x + w) + ',' + top + ' ' + (x + w) + ',' + (top + rad) + ' L' + (x + w) + ',' + G + ' Z" fill="' + Rr + '"/>';
    if (o.bands) {
      for (var by = top + o.bands; by < G - 20; by += o.bands) out += r(x, by, w, 7, C.band) + r(mid - w * 0.08, by, w * 0.3, 7, C.bandLight);
    }
    var mode = o.mode || 0;
    for (var yy = top + 10; yy < G - 8; yy += 9) {
      for (var xx = x + 4; xx < x + w - 4; xx += 7) {
        var k = hash(Math.round(xx), Math.round(yy)) % 9;
        if (k < [1, 2, 3][mode]) out += r(xx, yy, 2.4, 3, mode && k < mode + 1 && (mode === 2 || k === 0) ? C.lit : C.window, mode === 2 ? '' : ' opacity="0.85"');
      }
    }
    return out;
  }
  function box(x, w, h, shade) {
    var s = shade || w * 0.28;
    return r(x, G - h, w - s, h, C.wall) + r(x + w - s, G - h, s, h, C.wallShade);
  }
  function palm(x, y, h, s) {
    s = s || 1;
    var tx = x + h * 0.12, ty = y - h;
    var out = '<path d="M' + (x - 1) + ',' + y + ' Q' + (x + h * 0.16) + ',' + (y - h * 0.5) + ' ' + tx + ',' + ty + '" stroke="' + C.trunk + '" stroke-width="' + 4.5 * s + '" fill="none" stroke-linecap="round"/>';
    out += anim('sway', tx, ty, (x % 9) * 0.6);
    [-165, -130, -95, -55, -18].forEach(function (a, i) {
      var rr = a * Math.PI / 180, len = h * 0.45;
      var ex = tx + Math.cos(rr) * len, ey = ty + Math.sin(rr) * len + len * 0.55;
      var cx = tx + Math.cos(rr) * len * 0.5, cy = ty + Math.sin(rr) * len * 0.5 - len * 0.25;
      out += '<path d="M' + tx + ',' + ty + ' Q' + cx + ',' + cy + ' ' + ex + ',' + ey + '" stroke="' + (i % 2 ? C.leafDark : C.leaf) + '" stroke-width="' + 4.5 * s + '" fill="none" stroke-linecap="round"/>';
    });
    return out + '</g>';
  }
  function tree(x, y, s) {
    s = s || 1;
    return '<line x1="' + x + '" y1="' + y + '" x2="' + x + '" y2="' + (y - 8 * s) + '" stroke="#5b4630" stroke-width="2"/>' +
      anim('sway', x, y - 8 * s, (x % 7) * 0.5) +
      '<circle cx="' + (x - 4 * s) + '" cy="' + (y - 11 * s) + '" r="' + 6 * s + '" fill="' + C.tree + '"/>' +
      '<circle cx="' + (x + 4 * s) + '" cy="' + (y - 12 * s) + '" r="' + 6.5 * s + '" fill="' + C.treeDark + '"/>' +
      '<circle cx="' + x + '" cy="' + (y - 16 * s) + '" r="' + 5.5 * s + '" fill="' + C.tree + '"/></g>';
  }
  function scaled(x, s, svg) { return '<g transform="translate(' + x + ',' + G + ') scale(' + s + ') translate(' + (-x) + ',' + (-G) + ')">' + svg + '</g>'; }
  function camel(x, y) {
    var c = '#c98f55', d = '#a9733f';
    return '<ellipse cx="' + x + '" cy="' + (y - 30) + '" rx="22" ry="11" fill="' + c + '"/>' +
      '<ellipse cx="' + (x - 3) + '" cy="' + (y - 40) + '" rx="11" ry="10" fill="' + c + '"/>' +
      anim('nod', x + 16, y - 33, (x % 5)) +
      '<path d="M' + (x + 16) + ',' + (y - 33) + ' Q' + (x + 24) + ',' + (y - 41) + ' ' + (x + 27) + ',' + (y - 55) + '" stroke="' + c + '" stroke-width="7" fill="none" stroke-linecap="round"/>' +
      '<ellipse cx="' + (x + 32) + '" cy="' + (y - 55) + '" rx="8" ry="4.5" fill="' + c + '"/></g>' +
      [[-15, -16, d], [-7, -6, c], [8, 7, d], [15, 17, c]].map(function (l) {
        return '<line x1="' + (x + l[0]) + '" y1="' + (y - 22) + '" x2="' + (x + l[1]) + '" y2="' + y + '" stroke="' + l[2] + '" stroke-width="3.5" stroke-linecap="round"/>';
      }).join('');
  }
  function boat(x, y, sail) {
    var out = anim('bob', null, null, (x % 4));
    if (sail) {
      out += '<path d="M' + (x - 30) + ',' + y + ' Q' + x + ',' + (y + 11) + ' ' + (x + 32) + ',' + (y - 5) + ' L' + (x - 30) + ',' + y + ' Z" fill="#8a5a2b"/>' +
        '<line x1="' + x + '" y1="' + (y - 1) + '" x2="' + x + '" y2="' + (y - 44) + '" stroke="#6b4521" stroke-width="2"/>' +
        '<path d="M' + (x + 1) + ',' + (y - 43) + ' L' + (x + 26) + ',' + (y - 8) + ' L' + (x + 1) + ',' + (y - 7) + ' Z" fill="#ffffff" stroke="#d5d5d5"/>';
    } else {
      out += '<path d="M' + (x - 34) + ',' + (y - 6) + ' L' + (x + 34) + ',' + (y - 6) + ' L' + (x + 26) + ',' + (y + 4) + ' L' + (x - 28) + ',' + (y + 4) + ' Z" fill="#ffffff" stroke="#c9d2dc"/>' +
        r(x - 14, y - 15, 30, 9, '#eef3f8', ' rx="3" stroke="#c9d2dc"') + r(x - 9, y - 12, 18, 3, '#7895cc');
    }
    return out + '</g>';
  }
  function cloud(x, y, s, dur, delay) {
    return '<g class="drift" style="animation-duration:' + dur + 's;animation-delay:-' + delay + 's">' +
      '<g transform="translate(' + x + ',' + y + ') scale(' + s + ')" fill="#ffffff">' +
      '<rect x="-46" y="-8" width="92" height="18" rx="9"/><circle cx="-16" cy="-10" r="16"/><circle cx="10" cy="-16" r="20"/><circle cx="32" cy="-6" r="12"/></g></g>';
  }

  // scaffolding + a tower crane on top of a building that is still going up
  function crane(x, w, hh) {
    var top = G - hh, mx = x + w + 10, my = top - 70, hookX = x + w / 2;
    var out = '<g class="crane">';
    // scaffold on the top floors
    out += '<g stroke="' + C.craneDark + '" stroke-width="1.4" opacity="0.8" fill="none">' +
      '<rect x="' + (x - 3) + '" y="' + (top - 16) + '" width="' + (w + 6) + '" height="34"/>';
    for (var sx = x + 5; sx < x + w; sx += 8) out += '<line x1="' + sx + '" y1="' + (top - 16) + '" x2="' + sx + '" y2="' + (top + 18) + '"/>';
    out += '<line x1="' + (x - 3) + '" y1="' + (top + 1) + '" x2="' + (x + w + 3) + '" y2="' + (top + 1) + '"/></g>';
    // mast
    out += r(mx - 3, my, 6, G - my, C.crane);
    for (var yy = my + 6; yy < G - 6; yy += 12) out += '<line x1="' + (mx - 3) + '" y1="' + yy + '" x2="' + (mx + 3) + '" y2="' + (yy + 6) + '" stroke="' + C.craneDark + '" stroke-width="1"/>';
    // jib with cable and load, swinging gently around the mast top
    out += anim('jib', mx, my) +
      r(mx - 120, my - 3, 160, 5, C.crane) + r(mx + 26, my - 1, 14, 10, C.craneDark) +
      '<path d="M' + mx + ',' + (my - 16) + ' L' + (mx - 110) + ',' + (my - 3) + ' M' + mx + ',' + (my - 16) + ' L' + (mx + 36) + ',' + (my - 3) + '" stroke="' + C.craneDark + '" stroke-width="1.2"/>' +
      r(mx - 2, my - 18, 4, 16, C.craneDark) +
      '<g class="cable" style="transform-origin:' + (hookX) + 'px ' + (my + 2) + 'px">' +
        '<line x1="' + hookX + '" y1="' + (my + 2) + '" x2="' + hookX + '" y2="' + (top - 28) + '" stroke="#4a4a4a" stroke-width="1"/>' +
        r(hookX - 9, top - 28, 18, 7, '#8b99b1') +
      '</g></g></g>';
    return out;
  }
  // draw a tower that grows from `from` to `at` words, with a crane until it's finished
  function growing(ctx, from, at, x, w, h, drawAt) {
    var p = Math.max(0, Math.min(1, (ctx.w - from) / (at - from)));
    if (p >= 1) return drawAt(h, p);
    var hh = Math.max(12, Math.round(h * p));
    return drawAt(hh, p) + crane(x, w, hh);
  }

  // ── the 40 levels, in order. `from` = starts being built (towers only). z: lower draws further back ──
  var ELEMENTS = [
    // the desert
    { id: 'palm', at: 3, name: 'a first palm tree', z: 20, draw: function () { return palm(232, G, 104); } },
    { id: 'camel', at: 6, name: 'a camel', z: 21, draw: function () { return scaled(296, 1.4, camel(296, G)); } },
    { id: 'tent', at: 10, name: 'a Bedouin tent', z: 19, draw: function () {
      return scaled(178, 1.35, '<path d="M140,' + G + ' L180,' + (G - 42) + ' L180,' + G + ' Z" fill="#d7ad6f"/><path d="M180,' + G + ' L180,' + (G - 42) + ' L222,' + G + ' Z" fill="#b98c4f"/>' +
        '<path d="M172,' + G + ' L180,' + (G - 22) + ' L188,' + G + ' Z" fill="#6e5030"/>');
    } },
    { id: 'falcon', at: 15, name: 'a falcon overhead', z: 0, sky: true, draw: function () {
      return '<g transform="translate(500,300)"><g class="fly"><g class="flap"><path d="M-16,0 Q-8,-8 0,0 Q8,-8 16,0" stroke="#5a4632" stroke-width="3.5" fill="none" stroke-linecap="round"/></g></g></g>';
    } },
    { id: 'oasis', at: 20, name: 'an oasis', z: 18, draw: function () {
      return '<ellipse cx="724" cy="' + (G + 6) + '" rx="46" ry="8" fill="' + C.water + '"/>' + palm(700, G + 2, 70, 0.95) + palm(748, G + 3, 86, 1);
    } },
    { id: 'grove', at: 28, name: 'a palm grove', z: 17, draw: function () { return palm(804, G, 92) + palm(832, G, 68, 0.9) + palm(780, G, 60, 0.8); } },
    { id: 'fire', at: 36, name: 'a campfire', z: 24, draw: function () {
      var x = 214, y = G + 14;
      return '<line x1="' + (x - 11) + '" y1="' + y + '" x2="' + (x + 11) + '" y2="' + (y - 5) + '" stroke="#6e4b2a" stroke-width="4" stroke-linecap="round"/>' +
        '<line x1="' + (x - 11) + '" y1="' + (y - 5) + '" x2="' + (x + 11) + '" y2="' + y + '" stroke="#86603a" stroke-width="4" stroke-linecap="round"/>' +
        '<g class="flame" style="transform-origin:' + x + 'px ' + (y - 3) + 'px"><path d="M' + (x - 8) + ',' + (y - 3) + ' Q' + (x - 9) + ',' + (y - 16) + ' ' + x + ',' + (y - 26) + ' Q' + (x + 9) + ',' + (y - 16) + ' ' + (x + 8) + ',' + (y - 3) + ' Z" fill="#f0883e"/>' +
        '<path d="M' + (x - 4) + ',' + (y - 3) + ' Q' + (x - 4) + ',' + (y - 11) + ' ' + x + ',' + (y - 17) + ' Q' + (x + 4) + ',' + (y - 11) + ' ' + (x + 4) + ',' + (y - 3) + ' Z" fill="#f8d257"/></g>';
    } },
    { id: 'windtower', at: 45, name: 'a wind-tower house', z: 12, draw: function () {
      var x = 336;
      return box(x, 64, 40) + box(x + 18, 24, 74, 8) +
        [x + 22, x + 27, x + 32].map(function (sx) { return '<line x1="' + sx + '" y1="' + (G - 68) + '" x2="' + sx + '" y2="' + (G - 46) + '" stroke="' + C.wallDeep + '" stroke-width="2"/>'; }).join('') +
        r(x + 8, G - 18, 10, 18, C.wallDeep);
    } },
    { id: 'well', at: 55, name: 'a well', z: 14, draw: function () {
      var x = 418;
      return r(x - 13, G - 16, 26, 16, '#d8c49b') + r(x + 4, G - 16, 9, 16, '#bfa877') +
        r(x - 12, G - 40, 3, 24, '#7d5c33') + r(x + 9, G - 40, 3, 24, '#7d5c33') + r(x - 15, G - 43, 30, 4, '#7d5c33') +
        anim('swing', x, G - 39) + '<line x1="' + x + '" y1="' + (G - 39) + '" x2="' + x + '" y2="' + (G - 26) + '" stroke="#4a4a4a" stroke-width="1"/>' + r(x - 4, G - 26, 8, 7, '#8a6a43') + '</g>';
    } },
    { id: 'creek', at: 70, name: 'the creek', z: 30, water: true, draw: function () { return ''; } },
    { id: 'dhow', at: 85, name: 'a dhow on the creek', z: 31, draw: function () { return boat(760, 896, true); } },
    { id: 'fort', at: 100, name: 'an old fort', z: 12, draw: function () {
      var x = 552, out = box(x, 46, 40, 12);
      for (var i = 0; i < 4; i++) out += r(x + 2 + i * 9, G - 46, 6, 6, C.wall);
      out += r(x + 34, G - 66, 14, 66, C.wallShade) + r(x + 34, G - 66, 6, 66, C.wall);
      for (var j = 0; j < 2; j++) out += r(x + 34 + j * 8, G - 72, 5, 6, C.wallShade);
      return out + r(x + 12, G - 16, 10, 16, C.wallDeep);
    } },
    { id: 'mosque', at: 130, name: 'a mosque', z: 12, draw: function () {
      var x = 612;
      return box(x, 56, 34) +
        '<path d="M' + (x + 10) + ',' + (G - 34) + ' Q' + (x + 10) + ',' + (G - 62) + ' ' + (x + 28) + ',' + (G - 66) + ' L' + (x + 28) + ',' + (G - 34) + ' Z" fill="' + C.wall + '"/>' +
        '<path d="M' + (x + 28) + ',' + (G - 66) + ' Q' + (x + 46) + ',' + (G - 62) + ' ' + (x + 46) + ',' + (G - 34) + ' L' + (x + 28) + ',' + (G - 34) + ' Z" fill="' + C.wallShade + '"/>' +
        r(x + 62, G - 96, 5, 96, C.wall) + r(x + 67, G - 96, 4, 96, C.wallShade) +
        '<path d="M' + (x + 61) + ',' + (G - 96) + ' L' + (x + 66.5) + ',' + (G - 112) + ' L' + (x + 72) + ',' + (G - 96) + ' Z" fill="' + C.wallShade + '"/>';
    } },
    { id: 'souk', at: 170, name: 'a souk', z: 13, draw: function () {
      var x = 452, out = box(x, 96, 34);
      for (var i = 0; i < 4; i++) {
        var ax = x + 13 + i * 21;
        out += '<path d="M' + (ax - 6) + ',' + G + ' L' + (ax - 6) + ',' + (G - 14) + ' Q' + ax + ',' + (G - 26) + ' ' + (ax + 6) + ',' + (G - 14) + ' L' + (ax + 6) + ',' + G + ' Z" fill="' + C.wallDeep + '"/>';
      }
      return out + r(x - 4, G - 40, 104, 6, '#c96f4a') + r(x - 4, G - 40, 104, 2, '#e08a63');
    } },
    { id: 'dates', at: 220, name: 'date palms by the water', z: 23, draw: function () { return palm(150, G + 8, 74, 0.9) + palm(862, G + 8, 70, 0.9); } },
    { id: 'boulevard', at: 280, name: 'a boulevard with trees', z: 22, plate: true, draw: function () {
      return [318, 404, 590, 676].map(function (x) { return tree(x, G + 4, 1.1); }).join('');
    } },
    { id: 'lamps', at: 350, name: 'street lamps', z: 22, draw: function (ctx) {
      var out = '';
      [356, 446, 556, 646].forEach(function (x) {
        out += r(x - 1, G - 26, 2.5, 30, '#7b8494') + r(x - 6, G - 28, 12, 3, '#7b8494', ' rx="1.5"') +
          '<circle cx="' + x + '" cy="' + (G - 24) + '" r="' + (ctx.mode ? 5 : 2.6) + '" fill="' + C.lit + '"' + (ctx.mode ? ' class="glow"' : '') + '/>';
      });
      return out;
    } },
    { id: 'apartments', at: 430, name: 'the first apartment blocks', z: 9, draw: function (ctx) {
      return column(420, 38, 88, { L: C.wall, R: C.wallShade, round: 2, mode: ctx.mode }) + column(548, 42, 74, { L: C.wall, R: C.wallShade, round: 2, mode: ctx.mode });
    } },
    { id: 'hotel', at: 510, name: 'a hotel', z: 8, draw: function (ctx) {
      return column(466, 66, 126, { L: '#f1d9c0', R: '#d7b897', bands: 36, round: 4, mode: ctx.mode });
    } },
    { id: 'cranes', at: 600, name: 'cranes — the first skyscraper is going up', z: 0, draw: null },

    // the skyscraper era
    { id: 'office', from: 600, at: 900, name: 'a glass office tower', z: 6, draw: function (ctx) {
      return growing(ctx, 600, 900, 636, 42, 270, function (h) { return column(636, 42, h, { L: C.glassL, R: C.glassR, bands: 60, mode: ctx.mode }); });
    } },
    { id: 'yacht', at: 1050, name: 'a yacht', z: 31, draw: function () { return boat(392, 892, false); } },
    { id: 'marinaA', from: 900, at: 1200, name: 'the first marina tower', z: 5, draw: function (ctx) {
      return growing(ctx, 900, 1200, 344, 36, 300, function (h) { return column(344, 36, h, { L: C.glassL, R: C.glassR, bands: 70, mode: ctx.mode }); });
    } },
    { id: 'metro', at: 1300, name: 'the metro', z: 10, draw: function () {
      var y = 792, out = r(290, y, 420, 6, '#a9b3c4', ' rx="3"');
      for (var x = 312; x < 710; x += 66) out += r(x - 3, y + 6, 6, G - y - 6, '#c3cad6');
      return out + '<g class="train">' + r(560, y - 13, 96, 13, '#ffffff', ' rx="6" stroke="#a9b3c4"') + r(568, y - 9, 80, 4, '#1f6feb', ' opacity="0.55"') + '</g>';
    } },
    { id: 'marinaB', from: 1150, at: 1400, name: 'a second marina tower', z: 5, draw: function (ctx) {
      return growing(ctx, 1150, 1400, 300, 40, 230, function (h) { return column(300, 40, h, { mode: ctx.mode }); });
    } },
    { id: 'marinaC', from: 1350, at: 1600, name: 'a third marina tower', z: 5, draw: function (ctx) {
      return growing(ctx, 1350, 1600, 384, 30, 250, function (h) { return column(384, 30, h, { mode: ctx.mode }); });
    } },
    { id: 'mall', at: 1800, name: 'a shopping mall', z: 11, draw: function (ctx) {
      return column(428, 62, 64, { L: C.glassL, R: C.glassR, round: 3, mode: ctx.mode }) + column(510, 66, 72, { L: '#a9bde4', R: '#6886c2', round: 3, mode: ctx.mode }) +
        r(486, G - 56, 30, 56, '#dfe7f5') + r(500, G - 56, 16, 56, '#c4d2ec');
    } },
    { id: 'twist', from: 1650, at: 2100, name: 'a twisting tower', z: 4, draw: function (ctx) {
      var p = Math.max(0, Math.min(1, (ctx.w - 1650) / 450)), n = Math.max(1, Math.round(18 * p)), h = 18, out = '';
      for (var i = 0; i < n; i++) {
        var off = Math.sin(i * 0.45) * 7, x = 688 + off, y = G - (i + 1) * h;
        out += r(x, y, 18, h - 2, i % 2 ? C.steelL : C.glassL) + r(x + 18, y, 16, h - 2, i % 2 ? C.steelR : C.glassR);
        if (ctx.mode && i % 3 === 1) out += r(x + 5, y + 6, 3, 3, C.lit) + r(x + 23, y + 6, 3, 3, C.lit);
      }
      return p < 1 ? out + crane(688 + Math.sin((n - 1) * 0.45) * 7, 34, n * h) : out;
    } },
    { id: 'island', at: 2300, name: 'a palm-shaped island', z: 31, water: true, draw: function () {
      var x = 250, y = 894, sand = '#f4d58f', out = r(x - 4, y - 2, 8, 14, sand);
      [-155, -125, -90, -55, -25].forEach(function (a) {
        var rr = a * Math.PI / 180;
        out += '<line x1="' + x + '" y1="' + y + '" x2="' + (x + Math.cos(rr) * 52) + '" y2="' + (y + Math.sin(rr) * 10 + 7) + '" stroke="' + sand + '" stroke-width="5" stroke-linecap="round"/>';
      });
      return out;
    } },
    { id: 'clusterA', from: 2100, at: 2500, name: 'a skyscraper', z: 3, draw: function (ctx) {
      return growing(ctx, 2100, 2500, 398, 34, 360, function (h) { return column(398, 34, h, { bands: 80, mode: ctx.mode }); });
    } },
    { id: 'heli', at: 2650, name: 'a helicopter', z: 0, sky: true, draw: function () {
      var x = 700, y = 430;
      return '<g class="hover"><ellipse cx="' + x + '" cy="' + y + '" rx="16" ry="9" fill="#d9483b"/><path d="M' + (x + 12) + ',' + (y - 2) + ' L' + (x + 40) + ',' + (y - 6) + '" stroke="#d9483b" stroke-width="4" stroke-linecap="round"/>' +
        '<ellipse cx="' + (x - 6) + '" cy="' + (y - 2) + '" rx="7" ry="5" fill="#cfe6f5"/>' +
        '<line x1="' + (x - 10) + '" y1="' + (y + 12) + '" x2="' + (x + 10) + '" y2="' + (y + 12) + '" stroke="#555" stroke-width="2"/>' +
        '<line x1="' + x + '" y1="' + (y - 9) + '" x2="' + x + '" y2="' + (y - 13) + '" stroke="#555" stroke-width="2"/>' +
        '<g class="rotor"><line x1="' + (x - 30) + '" y1="' + (y - 13) + '" x2="' + (x + 30) + '" y2="' + (y - 13) + '" stroke="#555" stroke-width="2"/></g></g>';
    } },
    { id: 'clusterB', from: 2350, at: 2800, name: 'a tall glass skyscraper', z: 3, draw: function (ctx) {
      return growing(ctx, 2350, 2800, 566, 40, 400, function (h) { return column(566, 40, h, { L: C.glassL, R: C.glassR, bands: 90, mode: ctx.mode }); });
    } },
    { id: 'wheel', at: 2950, name: 'an observation wheel', z: 7, draw: function () {
      var cx = 312, cy = G - 84, rr = 60, out = '';
      out += '<line x1="' + (cx - 26) + '" y1="' + G + '" x2="' + cx + '" y2="' + cy + '" stroke="#8d98a8" stroke-width="5"/><line x1="' + (cx + 26) + '" y1="' + G + '" x2="' + cx + '" y2="' + cy + '" stroke="#6f7a8a" stroke-width="5"/>';
      out += anim('spin', cx, cy) + '<circle cx="' + cx + '" cy="' + cy + '" r="' + rr + '" fill="none" stroke="#8d98a8" stroke-width="4"/>';
      for (var i = 0; i < 14; i++) {
        var a = i * Math.PI / 7;
        out += '<line x1="' + cx + '" y1="' + cy + '" x2="' + (cx + Math.cos(a) * rr) + '" y2="' + (cy + Math.sin(a) * rr) + '" stroke="#b8c1cc" stroke-width="1.2"/>';
        out += '<circle cx="' + (cx + Math.cos(a) * rr) + '" cy="' + (cy + Math.sin(a) * rr) + '" r="5" fill="#ffffff" stroke="#8d98a8" stroke-width="1.5"/>';
      }
      return out + '</g><circle cx="' + cx + '" cy="' + cy + '" r="5" fill="#6f7a8a"/>';
    } },
    { id: 'clusterC', from: 2700, at: 3100, name: 'a third skyscraper', z: 3, draw: function (ctx) {
      return growing(ctx, 2700, 3100, 604, 28, 310, function (h) { return column(604, 28, h, { mode: ctx.mode }); });
    } },
    { id: 'plane', at: 3300, name: 'planes in the sky', z: 0, sky: true, draw: function () {
      return '<g transform="translate(500,190)"><g class="plane"><path d="M-22,0 L18,0 Q26,0 26,3 Q26,6 18,6 L-22,6 Z" fill="#ffffff"/><path d="M-4,3 L-14,-10 L-8,-10 L6,3 Z M-4,4 L-14,16 L-8,16 L6,4 Z" fill="#e5ebf2"/><path d="M-22,1 L-28,-8 L-23,-8 L-16,1 Z" fill="#d9483b"/></g></g>';
    } },
    { id: 'fountain', at: 3600, name: 'the dancing fountain', z: 32, draw: function () {
      var out = '';
      [[470, 44, 0], [485, 62, 0.4], [500, 78, 0.8], [515, 62, 1.2], [530, 44, 1.6]].forEach(function (j) {
        out += '<g class="jet" style="transform-origin:' + j[0] + 'px 888px;animation-delay:-' + j[2] + 's"><path d="M' + (j[0] - 3) + ',888 Q' + j[0] + ',' + (888 - j[1] * 1.2) + ' ' + (j[0] + 3) + ',888 Z" fill="#eaf7fd" opacity="0.95"/></g>';
      });
      return out;
    } },
    { id: 'halfway', at: 3800, name: 'the tallest tower reaches halfway', z: 0, draw: null },
    { id: 'golden', at: 4300, name: 'golden hour over the city', z: 0, draw: null },
    { id: 'tallest', from: 3000, at: 4600, name: 'the tallest tower', z: 1, draw: function (ctx) {
      // clustered columns stepping up to a central spire, rising together while it's built
      var p = Math.max(0, Math.min(1, (ctx.w - 3000) / 1600));
      var cols = [[-50, 22, 250], [-38, 24, 360], [-26, 24, 480], [-14, 28, 600], [10, 24, 530], [22, 24, 410], [34, 22, 300]];
      var out = '';
      cols.slice().sort(function (a, b) { return b[2] - a[2]; }).forEach(function (c) {
        out += column(CX + c[0], c[1], Math.max(10, Math.round(c[2] * p)), { L: c[0] < 0 ? C.steelL : '#7383a0', R: c[0] < 0 ? '#6c7a95' : C.steelR, bands: 115, round: 8, mode: ctx.mode });
      });
      if (p >= 1) return out + r(CX - 3, G - 650, 6, 52, C.steelTop) + '<line x1="' + CX + '" y1="' + (G - 650) + '" x2="' + CX + '" y2="' + (G - 690) + '" stroke="' + C.steelTop + '" stroke-width="2.5"/>' +
        '<circle cx="' + CX + '" cy="' + (G - 690) + '" r="3" fill="#e5483b" class="blink"/>';
      return out + crane(CX - 14, 28, Math.max(10, Math.round(600 * p)));
    } },
    { id: 'fireworks', at: FLUENT_WORDS, name: 'fireworks — you’re fluent!', z: 0, sky: true, draw: function () {
      var out = '';
      [[300, 300, '#f08c4a', 0], [712, 250, '#6fb1ff', 0.9], [380, 190, '#5fd28a', 1.7], [640, 150, '#c08bff', 2.4]].forEach(function (f) {
        out += '<g class="burst" style="transform-origin:' + f[0] + 'px ' + f[1] + 'px;animation-delay:-' + f[3] + 's">';
        for (var i = 0; i < 12; i++) {
          var a = i * Math.PI / 6;
          out += '<line x1="' + (f[0] + Math.cos(a) * 8) + '" y1="' + (f[1] + Math.sin(a) * 8) + '" x2="' + (f[0] + Math.cos(a) * 30) + '" y2="' + (f[1] + Math.sin(a) * 30) + '" stroke="' + f[2] + '" stroke-width="3.5" stroke-linecap="round"/>';
        }
        out += '</g>';
      });
      return out;
    } }
  ];

  var uid = 0;
  function visibleAt(e, w) { return w >= (e.from != null ? e.from : e.at); }

  // words: the learner's word count · opts.preview: show the finished city · opts.seen: ids already shown (others rise in)
  function render(words, opts) {
    opts = opts || {};
    var w = opts.preview ? FLUENT_WORDS : words;
    var mode = w >= FLUENT_WORDS ? 2 : w >= 4300 ? 1 : 0;
    var ctx = { w: w, mode: mode };
    var visible = ELEMENTS.filter(function (e) { return visibleAt(e, w); });
    var water = visible.some(function (e) { return e.water; });
    var plate = visible.some(function (e) { return e.plate; });
    var seen = opts.seen || null;
    var id = 'city' + (++uid);

    var skyFill = mode === 2 ? C.skyNight : mode === 1 ? 'url(#' + id + 'g)' : C.sky;
    var svg = '<svg class="city-svg" viewBox="100 60 800 860" role="img" aria-label="Your city: ' + ELEMENTS.filter(function (e) { return w >= e.at; }).length + ' of ' + ELEMENTS.length + ' levels">' +
      '<defs><clipPath id="' + id + 'c"><circle cx="' + CX + '" cy="' + CY + '" r="' + R + '"/></clipPath>' +
      '<linearGradient id="' + id + 'g" x1="0" y1="0" x2="0" y2="1"><stop offset="0.2" stop-color="' + C.goldTop + '"/><stop offset="1" stop-color="' + C.goldBottom + '"/></linearGradient></defs>' +
      '<circle cx="' + CX + '" cy="' + CY + '" r="' + R + '" fill="' + skyFill + '"/>';

    // sky layer, clipped to the circle: sun/moon, stars, clouds, things that fly
    var sky = '';
    if (mode === 2) {
      for (var s = 0; s < 44; s++) {
        var sx = 150 + hash(s, 7) % 700, sy = 110 + hash(s, 13) % 420;
        sky += '<circle cx="' + sx + '" cy="' + sy + '" r="' + (1 + hash(s, 3) % 2) + '" fill="#ffffff" class="twinkle" style="animation-delay:-' + (s % 5) * 0.7 + 's"/>';
      }
      sky += '<circle cx="300" cy="420" r="34" fill="' + C.moon + '"/><circle cx="314" cy="410" r="30" fill="' + C.skyNight + '"/>';
    } else {
      sky += '<circle cx="300" cy="' + (mode ? 640 : 560) + '" r="' + (mode ? 46 : 40) + '" fill="' + (mode ? C.sunset : C.sun) + '" class="sun" style="transform-origin:300px ' + (mode ? 640 : 560) + 'px"/>';
    }
    sky += '<g opacity="' + (mode === 2 ? 0.18 : mode ? 0.75 : 0.95) + '">' + cloud(380, 250, 1, 95, 10) + cloud(640, 180, 0.8, 120, 70) + cloud(300, 380, 0.65, 80, 40) + '</g>';
    var skyEls = '', city = '', front = '';
    var order = visible.filter(function (e) { return e.draw; }).map(function (e) { return { e: e, i: ELEMENTS.indexOf(e) }; });
    order.sort(function (a, b) { return a.e.z - b.e.z || a.i - b.i; });
    order.forEach(function (o) {
      var isNew = seen && seen.indexOf(o.e.id) === -1;
      var g = '<g class="el' + (isNew ? ' new' : '') + '">' + o.e.draw(ctx) + '</g>';
      if (o.e.sky) skyEls += g; else if (o.e.z >= 30) front += g; else city += g;
    });
    svg += '<g clip-path="url(#' + id + 'c)">' + sky + skyEls + '</g>';

    // dunes spill out of the circle at the bottom
    svg += '<path d="M380,880 Q480,770 600,700 Q700,750 880,880 Z" fill="' + C.dune + '"/>' +
      '<path d="M600,700 Q640,760 700,800 Q660,770 640,745 Z" fill="' + C.duneShade + '" opacity="0.7"/>' +
      '<path d="M120,880 Q240,790 352,722 Q430,770 540,880 Z" fill="' + C.dune + '"/>' +
      '<path d="M352,722 Q330,744 314,770 Q300,792 290,800 Q340,786 352,762 Q342,780 360,770 Q356,742 366,730 Z" fill="' + C.duneShade + '"/>' +
      '<path d="M120,880 Q240,790 352,722 Q260,800 230,880 Z" fill="' + C.duneShade + '" opacity="0.55"/>';
    if (plate) svg += r(282, G - 2, 436, 14, C.plate, ' rx="7"');
    svg += city;
    if (water) {
      svg += r(150, 880, 700, 30, C.water, ' rx="15"') + '<g class="shimmer">';
      [[200, 892], [330, 900], [470, 890], [600, 899], [690, 889]].forEach(function (p) {
        svg += '<line x1="' + p[0] + '" y1="' + p[1] + '" x2="' + (p[0] + 34) + '" y2="' + p[1] + '" stroke="' + C.waterLine + '" stroke-width="3" stroke-linecap="round"/>';
      });
      svg += '</g>';
    }
    svg += front + '</svg>';

    var done = ELEMENTS.filter(function (e) { return w >= e.at; });
    var building = ELEMENTS.filter(function (e) { return e.from != null && w >= e.from && w < e.at; }).map(function (e) {
      return { name: e.name, pct: Math.round(((w - e.from) / (e.at - e.from)) * 100) };
    });
    return {
      svg: svg, unlocked: done.length, total: ELEMENTS.length, building: building,
      next: ELEMENTS.find(function (e) { return w < e.at; }), last: done[done.length - 1],
      visible: visible.map(function (e) { return e.id; })
    };
  }

  window.CITY = { render: render, FLUENT_WORDS: FLUENT_WORDS, ELEMENTS: ELEMENTS };
})();
