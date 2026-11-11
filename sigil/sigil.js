// Sigil: a loading spinner that is a summoning circle on a dark stone floor.
// With no value, a will-o'-wisp circles the ring, and the runes it passes light up and fade behind it: a spinner.
// Give it a value (0 to 1) and it is a progress ring: the runes light one by one, clockwise from the top, and stay lit.
// At 100% the wisp spirals into the middle, the circle flares, and an imp climbs out of the floor and waves. Then it is quiet.
// Everything is painted in code at 41 x 41, lit, and crushed to a fixed palette every frame. No assets, no network.
//
// One file, no dependencies. Load it with a script tag and put <sigil-spinner></sigil-spinner> where the spinner goes.
// It fires "sigil:done" once, when the circle is answered.
(() => {
'use strict';
function hash(x, y) { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vnoise(x, y) { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy), l = (a, b, t) => a + (b - a) * t; return l(l(hash(xi, yi), hash(xi + 1, yi), sx), l(hash(xi, yi + 1), hash(xi + 1, yi + 1), sx), sy); }
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v), mix = (a, b, t) => a + (b - a) * t, smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const TAU = Math.PI * 2;

const W = 41, H = 41, C = 20, UP = 6;   // the scene in art pixels, its middle pixel, and how many canvas pixels there are to each art pixel
const TEAL = ['#0b2a2e', '#0f4a4a', '#14706a', '#1f9a88', '#38c4a6', '#7aeccc', '#c4fff0', '#f4fffa'];   // the magic, dark to bright
const PAL = [
  '#05060a', '#0a0c13', '#10131d', '#171b29', '#202638', '#2a3149', '#364060', '#46517a', '#5d6a95', '#7d8ab4', '#a6b0d2',   // the stone
  ...TEAL,
  '#1a3a40', '#244f58', '#33707a', '#4a929a', '#6cb6bc',                                                                // stone with the light on it
  '#7c1e12', '#b8421a', '#e0641e', '#f89a38', '#fbe88a', '#fffbd4',                                                      // ember: the imp's eyes
  '#120a1c', '#1e1230', '#2e1c48', '#43296a', '#6a5c50', '#9c8a70',                                                      // the imp, and bone
];
const mk = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h });
const soft = mk(W, H), sctx = soft.getContext('2d', { willReadFrequently: true });
let g = sctx;
const POOL = [];
function scratch() { const c = POOL.pop() || mk(W, H), x = c.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; x.filter = 'none'; x.clearRect(0, 0, W, H); return c; }
const release = (...cs) => { for (const c of cs) if (c) POOL.push(c); };
function layer(draw) { const L = scratch(), prev = g; g = L.getContext('2d'); g.save(); draw(); g.restore(); g = prev; return L; }
const rc = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };

// ───────── light ─────────
// Every layer is multiplied by the same kind of map: a cold ambient plus whatever is giving light in this frame.
function lit(L, S) {
  const k = L.getContext('2d'), M = scratch(), m = M.getContext('2d');
  m.fillStyle = S.amb; m.fillRect(0, 0, W, H); m.globalCompositeOperation = 'lighter';
  for (const [x, y, r, rgb, a, hard] of S.lights) {
    const s = Math.min(1, a), gr = m.createRadialGradient(x, y, hard ? 0 : 2, x, y, r);
    if (hard) for (const [at, v] of [[0, 1], [0.5, 1], [0.5, 0.45], [1, 0.45], [1, 0]]) gr.addColorStop(at, `rgba(${rgb},${s * v})`);   // two flat rings: a soft pool crushes to speckle
    else { gr.addColorStop(0, `rgba(${rgb},${s})`); gr.addColorStop(0.42, `rgba(${rgb},${s * 0.5})`); gr.addColorStop(1, `rgba(${rgb},0)`); }
    m.fillStyle = gr; m.fillRect(0, 0, W, H);
  }
  m.globalCompositeOperation = 'destination-in'; m.drawImage(L, 0, 0);
  k.globalCompositeOperation = 'multiply'; k.drawImage(M, 0, 0); k.globalCompositeOperation = 'source-over'; release(M);
  return L;
}
function rim(L, dx, dy, x, y, r, rgb, a) {   // a thin bright edge on the side that faces the light: (dx, dy) points away from it
  if (a <= 0) return;
  const k = L.getContext('2d'), R = scratch(), q = R.getContext('2d');
  q.drawImage(L, 0, 0); q.globalCompositeOperation = 'source-in';
  const gr = q.createRadialGradient(x, y, 2, x, y, r); gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(0.5, `rgba(${rgb},${a * 0.6})`); gr.addColorStop(1, `rgba(${rgb},0)`);
  q.fillStyle = gr; q.fillRect(0, 0, W, H); q.globalCompositeOperation = 'destination-out'; q.drawImage(L, dx, dy);
  k.globalCompositeOperation = 'source-atop'; k.drawImage(R, 0, 0); k.globalCompositeOperation = 'source-over'; release(R);
}

// ───────── crush: every pixel to the nearest palette colour, with a 4 x 4 ordered dither ─────────
const B4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5], SPREAD = 5;
const bayer = (x, y) => (B4[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
const RGB = PAL.map((h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
const PAL32 = new Uint32Array(RGB.map((c) => (255 << 24) | (c[2] << 16) | (c[1] << 8) | c[0])), LUT = new Uint8Array(32768);
for (let r = 0; r < 32; r++) for (let gg = 0; gg < 32; gg++) for (let b = 0; b < 32; b++) {
  let best = 0, bd = 1e9; const R = r * 8 + 4, G = gg * 8 + 4, Bv = b * 8 + 4;
  for (let q = 0; q < RGB.length; q++) { const c = RGB[q], e = 2 * (R - c[0]) ** 2 + 4 * (G - c[1]) ** 2 + 3 * (Bv - c[2]) ** 2; if (e < bd) { bd = e; best = q; } }
  LUT[(r << 10) | (gg << 5) | b] = best;
}
const art = mk(W, H), actx = art.getContext('2d'), artImg = actx.createImageData(W, H), art32 = new Uint32Array(artImg.data.buffer);
function crush() {
  const d = sctx.getImageData(0, 0, W, H).data;
  for (let y = 0, i = 0, j = 0; y < H; y++) for (let x = 0; x < W; x++, i += 4, j++) {
    const nz = (bayer(x, y) - 0.5) * SPREAD;
    let r = d[i] + nz, gg = d[i + 1] + nz, b = d[i + 2] + nz;
    r = r < 0 ? 0 : r > 255 ? 255 : r; gg = gg < 0 ? 0 : gg > 255 ? 255 : gg; b = b < 0 ? 0 : b > 255 ? 255 : b;
    art32[j] = PAL32[LUT[((r >> 3) << 10) | ((gg >> 3) << 5) | (b >> 3)]];
  }
  actx.putImageData(artImg, 0, 0);
}

// ───────── the circle ─────────
const N = 12, R_RUNE = 14, R_OUT = 17.7, R_IN = 10.6, R_STAR = 9.4, R_DISC = 20.3;
const dist = (x, y) => Math.hypot(x - C, y - C);
// Twelve runes, 3 x 5. They are made up: each is a few straight strokes, so none is a letter, and each has its own outline.
const RUNES = [
  '#.# #.# .#. .#. .#.', '#.. ##. #.# ##. #..', '.#. #.# .#. #.# .#.', '.#. ### .#. .#. .#.', '##. #.# ##. #.# ##.', '#.# ### #.# #.# #.#',
  '#.# ##. .#. .## #.#', '..# .#. #.. .#. ..#', '##. .## .#. ##. .##', '#.. ##. #.. ##. #..', '..# .#. ### .#. #..', '.#. #.. .#. ..# .#.',
].map((r) => r.split(' '));
const RPOS = Array.from({ length: N }, (_, i) => { const a = (i * TAU) / N; return [C + Math.round(R_RUNE * Math.sin(a)), C - Math.round(R_RUNE * Math.cos(a))]; });   // each rune's middle pixel
const runePixels = (i) => { const out = [], [cx, cy] = RPOS[i]; RUNES[i].forEach((row, r) => { for (let q = 0; q < 3; q++) if (row[q] === '#') out.push([cx - 1 + q, cy - 2 + r]); }); return out; };
const RUNE_PX = RUNES.map((_, i) => runePixels(i));
function ringPx(R) { const out = []; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (Math.abs(dist(x, y) - R) < 0.55) out.push([x, y]); return out; }
function lineTo(a, b) {   // the pixels of a straight line, Bresenham
  const out = []; let [x0, y0] = a; const [x1, y1] = b, dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx + dy;
  for (;;) { out.push([x0, y0]); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
  return out;
}
const STAR_V = Array.from({ length: 5 }, (_, k) => { const a = -Math.PI / 2 + (k * TAU) / 5; return [C + Math.round(R_STAR * Math.cos(a)), C + Math.round(R_STAR * Math.sin(a))]; });
const STAR_PX = (() => { const seen = new Set(), out = []; for (let k = 0; k < 5; k++) for (const [x, y] of lineTo(STAR_V[k], STAR_V[(k + 2) % 5])) if (!seen.has(x * 64 + y)) { seen.add(x * 64 + y); out.push([x, y]); } return out; })();

// ───────── the imp ─────────
// He is too small to draw, so he is a shape, placed a pixel at a time and never rotated or scaled. He is dark, against a floor that glows.
// b body, h horn. His eyes and the tips of his horns go on after the light, so they stay exact.
const INKS = { b: '#5a3c8a', h: '#5a3c8a' };
function spr(rows, x, y) { for (let r = 0; r < rows.length; r++) for (let q = 0, row = rows[r]; q < row.length; q++) if (row[q] !== '.') rc(x + q, y + r, 1, 1, INKS[row[q]]); }
const STAND = [   // 11 wide, 14 tall. His eyes are in row 4, columns 3 and 7. His feet are in row 13.
  'h.........h',
  'hh.......hh',
  '.hbbbbbbbh.',
  '..bbbbbbb..',
  '..bbbbbbb..',
  '..bbbbbbb..',
  '...bbbbb...',
  '.bbbbbbbbb.',
  'bbbbbbbbbbb',
  'bb.bbbbb.bb',
  'bb.bbbbb.bb',
  '...bbbbb...',
  '...bb.bb...',
  '..bbb.bbb..',
];
// the same, with the arm on the left of the picture raised, and the hand in one of two places, for the wave
function waving(f) {
  const rows = STAND.map((r) => r.split(''));
  for (const r of [8, 9, 10]) { rows[r][0] = '.'; rows[r][1] = '.'; }
  for (const [x, y] of f ? [[0, 5], [0, 6], [1, 6]] : [[0, 4], [0, 5], [0, 6], [1, 6]]) rows[y][x] = 'b';   // a forearm, with the hand a pixel higher in one of the two
  return rows.map((r) => r.join(''));
}
const WAVE = [waving(0), waving(1)];
const TAILS = [   // his tail, off his hip: at rest, and flicked
  [[0, 0], [1, 0], [2, -1], [3, -2], [3, -3], [3, -4], [2, -4], [4, -4], [3, -5]],
  [[0, 0], [1, 0], [2, 0], [3, -1], [4, -2], [5, -2], [5, -3], [5, -1], [6, -2]],
];
const FEET = 26;                     // the row his feet stand on, and the floor he climbs out of
const IMP_X = C - 5, IMP_Y = FEET - 13;

// ───────── the floor ─────────
const AMB = 'rgb(82,88,124)', GLOW = '70,255,200';
let FLOOR, MASK;
function bake() {   // the things that never change, painted once in their own colours
  const still = (draw) => { const c = mk(W, H), prev = g; g = c.getContext('2d'); draw(); g = prev; return c; };
  MASK = still(() => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (dist(x, y) <= R_DISC) rc(x, y, 1, 1, '#000'); });
  FLOOR = still(() => {
    const dark = '#1e2238', mid = '#5e6684', lip = '#7f88aa';
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const d = dist(x, y); if (d > R_DISC) continue;
      if (d > 19.3) rc(x, y, 1, 1, dark);   // the edge of the flagstone: a dark rim
      else if (d > 18.3) rc(x, y, 1, 1, (x - C) + (y - C) < 0 ? '#9aa3c4' : '#3e4560');   // and a bevel that catches light on the upper left
      else rc(x, y, 1, 1, mid);
    }
    // a few cracks, placed by hand
    for (const [a, b] of [[[7, 30], [10, 33]], [[10, 33], [11, 36]], [[33, 6], [30, 9]], [[30, 9], [31, 12]]]) for (const [x, y] of lineTo(a, b)) rc(x, y, 1, 1, dark);
    // the circle, cut into the stone: a dark line with a pale lip on its lower right
    const cut = (px) => { const set = new Set(px.map(([x, y]) => x * 64 + y)); for (const [x, y] of px) if (!set.has((x + 1) * 64 + y + 1)) rc(x + 1, y + 1, 1, 1, lip); for (const [x, y] of px) rc(x, y, 1, 1, '#1c2036'); };
    cut(ringPx(R_OUT)); cut(ringPx(R_IN));
    for (const [x, y] of STAR_PX) rc(x, y, 1, 1, '#2a3049');   // the star is a thin line, with no lip, so the middle stays quiet
    for (const px of RUNE_PX) cut(px);
  });
}

// ───────── the scene ─────────
const T_IN = 0.55, T_BEAM = 0.62, T_UP = 0.72, T_DOWN = 1.55, T_WAVE = 1.95, SETTLED = 3;   // the answer, in seconds from the moment the circle is done
const REV = 1.5;   // seconds the wisp takes to go round
function wispAt(s) {   // [x, y, angle]
  const t = s.time; let R = R_RUNE + Math.sin(t * 6.1) * 0.7, a = (t / REV) * TAU;
  if (s.done) { const u = clamp(s.ta / T_IN, 0, 1); R *= (1 - u) * (1 - u); a += 9 * u * u; }
  return [C + Math.round(R * Math.sin(a)), C - Math.round(R * Math.cos(a)), a];
}
function scene(s) {
  const t = s.time, ta = s.ta, done = s.done, p = s.p, det = s.det;
  g = sctx; g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, W, H);
  const [wx, wy] = wispAt(s), wispOn = !done || ta < T_IN, fl = 0.9 + 0.1 * vnoise(t * 9, 4);
  const flash = done ? smooth(T_IN - 0.18, T_IN, ta) * (1 - smooth(T_IN, T_IN + 0.35, ta)) : 0;
  const energy = done ? 1 : det ? 0.6 * p : 0, steady = Math.round(energy * 10) / 10;
  const lights = []; if (steady > 0 || flash > 0) lights.push([C + 0.5, C + 0.5, Math.round(9 + 8 * steady + 8 * flash), GLOW, (0.2 + 0.5 * steady + 0.4 * flash) * (done ? 1 : fl), true]);
  if (wispOn) lights.push([wx + 0.5, wy + 0.5, 8, GLOW, 0.55, true]);
  const FL = lit(layer(() => g.drawImage(FLOOR, 0, 0)), { amb: AMB, lights }); g.drawImage(FL, 0, 0); release(FL);

  // the runes: lit ones are drawn after the light, so they never go grey. s.heat[i] is 0 to 1; the wisp makes the one under it flare.
  const [, , wa] = wispAt(s);
  for (let i = 0; i < N; i++) {
    let h = s.heat[i]; if (h <= 0.02) continue;
    let lv = Math.ceil(h * 4 - 0.001);   // 1 to 4
    const ahead = (((wa - (i * TAU) / N) % TAU) + TAU) % TAU; if (wispOn && h > 0.9 && (ahead < 0.32 || ahead > TAU - 0.18)) lv = 5;
    if (done && ta < T_IN + 0.5) lv = 5; else if (done) lv = Math.min(lv, 4) + (ta < 1.5 ? 1 : 0);
    if (lv >= 3) for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (const [x, y] of RUNE_PX[i]) rc(x + ox, y + oy, 1, 1, TEAL[lv - 2]);   // a stepped glow round it
    for (const [x, y] of RUNE_PX[i]) rc(x, y, 1, 1, TEAL[lv + 1]);
  }
  if (done) { const sl = Math.round(clamp(smooth(T_IN, T_IN + 0.3, ta) * 5, 0, 5) * (1 - 0.6 * smooth(1.6, 2.6, ta))); if (sl > 0) for (const [x, y] of STAR_PX) rc(x, y, 1, 1, TEAL[Math.min(7, sl + 1 - (((x + y) & 1) && sl < 3 ? 1 : 0))]); }

  // the wisp: a little flame with a tail of the places it has just been
  if (wispOn) {
    const a0 = wispAt(s)[2], fade = done ? 1 - smooth(0.3, T_IN, ta) : 1;
    for (let k = 9; k >= 1; k--) {
      const a = a0 - k * 0.085, R = R_RUNE + Math.sin((t - k * 0.014) * 6.1) * 0.7, x = C + Math.round(R * Math.sin(a)), y = C - Math.round(R * Math.cos(a));
      const ix = clamp(Math.round((6 - k * 0.62) * fade), 0, 7); if (ix > 0) rc(x, y, 1, 1, TEAL[ix]);
    }
    rc(wx, wy - 1, 1, 3, TEAL[5]); rc(wx - 1, wy, 3, 1, TEAL[5]); rc(wx, wy, 1, 1, TEAL[7]);
    if (vnoise(t * 14, 9) > 0.45) rc(wx, wy - 2, 1, 1, TEAL[4]);   // the tip of the flame licks up
    if (vnoise(t * 11, 2) > 0.6) rc(wx + 1, wy - 1, 1, 1, TEAL[3]);
  }
  if (done) {
    // the answer: a ring of light goes out, the floor flashes, a beam goes up, and the imp climbs out
    if (ta > T_IN && ta < T_IN + 0.75) { const r = mix(1.5, 21, smooth(T_IN, T_IN + 0.75, ta)), a = 1 - smooth(T_IN + 0.3, T_IN + 0.75, ta); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const d = Math.abs(dist(x, y) - r); if (d < 0.6) rc(x, y, 1, 1, TEAL[a > 0.6 ? 7 : a > 0.3 ? 6 : 5]); } }
    if (flash > 0.02) { g.fillStyle = `rgba(130,255,220,${flash * 0.8})`; g.fillRect(0, 0, W, H); }
    if (ta > T_BEAM && ta < 2.1) {   // a pillar of light the imp climbs up through: narrow, with a dithered edge, and it thins out as he settles
      const grow = smooth(T_BEAM, T_BEAM + 0.3, ta), top = Math.round(FEET - 16 * grow), keep = 1 - smooth(1.45, 2.1, ta);
      for (let y = top; y <= FEET; y++) for (let x = C - 3; x <= C + 3; x++) { const dx = Math.abs(x - C); if (bayer(x, y) >= keep) continue; if (dx <= 1) rc(x, y, 1, 1, dx === 0 ? TEAL[7] : TEAL[6]); else if (dx === 2) rc(x, y, 1, 1, TEAL[5]); else if (bayer(x + 2, y) < 0.5) rc(x, y, 1, 1, TEAL[3]); }
    }
    if (ta > T_UP - 0.02) {
      const u = clamp((ta - T_UP) / (T_DOWN - T_UP), 0, 1), off = Math.round(16 * (1 - (1 - u) * (1 - u) * (1 - u))), oy = 16 - off + (u > 0.82 && u < 1 ? -1 : 0);   // out of the floor, a hop, and down
      const waving = ta > T_WAVE && ta < T_WAVE + 0.8, wv = waving ? (((ta - T_WAVE) / 0.2) | 0) & 1 : -1;
      const I = layer(() => {
        spr(waving ? WAVE[wv] : STAND, IMP_X, IMP_Y + oy);
        const flick = (t % 2.9) > 2.74 ? 1 : 0; for (const [x, y] of TAILS[flick]) rc(IMP_X + 11 + x, IMP_Y + 12 + y + oy, 1, 1, INKS.b);
        g.globalCompositeOperation = 'destination-out'; rc(0, FEET + 1, W, H, '#000'); g.globalCompositeOperation = 'source-over';
      });
      lit(I, { amb: AMB, lights: [] }); g.drawImage(I, 0, 0); release(I);
      const blink = (t % 3.7) > 3.58, ey = IMP_Y + 4 + oy;
      for (const x of [IMP_X, IMP_X + 10]) if (IMP_Y + oy <= FEET) rc(x, IMP_Y + oy, 1, 1, '#c8b08a');   // the tips of his horns
      if (!blink && ey <= FEET) { const c = ta < 1.7 ? '#fffbd4' : '#f89a38'; rc(IMP_X + 3, ey, 1, 1, c); rc(IMP_X + 7, ey, 1, 1, c); }
    }
  }
}

// ───────── the element ─────────
const SHEET = `
:host{display:inline-block;position:relative;vertical-align:middle;width:${W * 2}px;aspect-ratio:1;line-height:0}
:host([hidden]){display:none}
.ring{position:absolute;inset:0}
canvas{display:block;width:100%;height:100%;image-rendering:pixelated}
.say{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}`;
// every spinner on the page is painted from one loop, with the same scratch canvases
const LIVE = new Set(); let ticking = false, last = 0, baked = false, paused = false;
function loop(now) { if (!LIVE.size || paused) { ticking = false; return; } const dt = last < 0 ? 0 : clamp((now - last) / 1000, 0, 0.05); last = now; for (const el of LIVE) el.advance(dt); requestAnimationFrame(loop); }
function wake() { if (!ticking && LIVE.size && !paused) { ticking = true; last = -1; requestAnimationFrame(loop); } }
const fin = mk(W, H), fctx = fin.getContext('2d');
class SigilSpinner extends HTMLElement {
  static get observedAttributes() { return ['value', 'label', 'done-label']; }
  static get paused() { return paused; }                 // set true to stop the clock and step it yourself with el.advance(seconds)
  static set paused(v) { paused = !!v; wake(); }
  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>${SHEET}</style><div class="ring" role="progressbar" aria-valuemin="0" aria-valuemax="100"><canvas aria-hidden="true"></canvas></div><span class="say" role="status"></span>`;
    this._bar = root.querySelector('.ring'); this._face = root.querySelector('canvas'); this._say = root.querySelector('.say');
    this._face.width = W * UP; this._face.height = H * UP;
    this._s = { time: LIVE.size * 1.37, p: 0, det: false, done: false, ta: 0, heat: new Array(N).fill(0) };
    this._want = null;
  }
  connectedCallback() { if (!baked) { bake(); baked = true; } this._aria(); LIVE.add(this); this._render(); wake(); }
  disconnectedCallback() { LIVE.delete(this); }
  attributeChangedCallback(name, _, v) {
    if (name === 'value') { const n = v === null ? NaN : parseFloat(v); this._want = Number.isFinite(n) ? clamp(n, 0, 1) : null; }   // with no usable number it is a plain spinner
    this._aria();
  }
  _aria() {   // what a screen reader gets: a progress bar, with no value while it is only spinning
    const s = this._s, b = this._bar;
    b.setAttribute('aria-label', this.getAttribute('label') || 'Loading');
    if (s.done) b.setAttribute('aria-valuenow', '100'); else if (this._want !== null) b.setAttribute('aria-valuenow', String(Math.round(this._want * 100))); else b.removeAttribute('aria-valuenow');
    b.setAttribute('aria-busy', s.done ? 'false' : 'true');
    this._say.textContent = s.done ? this.getAttribute('done-label') || 'Done' : '';
  }
  set(n, now) {   // the task's progress, 0 to 1. With nothing, or null, it goes back to a plain spinner. With a second argument of true it goes straight there.
    const v = n === null || n === undefined ? null : Number.isFinite(+n) ? clamp(+n, 0, 1) : this._want;
    this._want = v; const s = this._s;
    if (now && v !== null && !s.done) { s.p = v; s.det = true; if (v >= 1) { this._finish(); s.ta = SETTLED + 1; } }
    this._aria();
  }
  reset() { Object.assign(this._s, { p: 0, det: false, done: false, ta: 0 }); this._s.heat.fill(0); this._want = null; this.removeAttribute('value'); this._aria(); if (paused) this._render(); }   // back to a plain spinner, ready for the next task
  get value() { return this._s.done ? 1 : this._s.det ? this._s.p : null; }   // the progress it is showing, or null while it only spins
  get done() { return this._s.done; }
  _finish() { const s = this._s; s.done = true; s.p = 1; s.det = true; s.ta = 0; this._aria(); this.dispatchEvent(new CustomEvent('sigil:done', { bubbles: true, composed: true })); }
  advance(dt) {
    const s = this._s; s.time += dt;
    if (!s.done) {
      s.det = this._want !== null;
      s.p += clamp((s.det ? this._want : 0) - s.p, -dt * 3, dt * 1.6);   // a jump in progress is walked, not teleported
      if (s.det && this._want >= 1 && s.p >= 0.999) this._finish();
    } else s.ta += dt;
    // which runes are lit. With a value: the first p x 12 of them, clockwise from the top. Without one: the ones the wisp has just gone past.
    const wa = wispAt(s)[2];
    for (let i = 0; i < N; i++) {
      const target = s.done ? 1 : s.det ? clamp(s.p * N - i, 0, 1) : (() => { const behind = (((wa - (i * TAU) / N) % TAU) + TAU) % TAU; return behind < 4.4 ? 1 - behind / 4.4 : 0; })();
      s.heat[i] += clamp(target - s.heat[i], -dt * 7, dt * 14);
    }
    this._render();
  }
  _render() {
    scene(this._s); crush();
    fctx.globalCompositeOperation = 'source-over'; fctx.clearRect(0, 0, W, H); fctx.drawImage(art, 0, 0); fctx.globalCompositeOperation = 'destination-in'; fctx.drawImage(MASK, 0, 0);   // the corners are clear: it is a round floor
    const v = this._face.getContext('2d'); v.imageSmoothingEnabled = false; v.clearRect(0, 0, this._face.width, this._face.height); v.drawImage(fin, 0, 0, this._face.width, this._face.height);
  }
}
customElements.define('sigil-spinner', SigilSpinner);
})();
