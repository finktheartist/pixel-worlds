// Sigil: a loading spinner that is a summoning circle cut into a dark stone floor, lit by one thing: a will-o'-wisp.
// With no value the wisp circles the ring. The stone shows only where it is: the grooves catch its light and throw shadows,
// and the runes it passes ignite and cool behind it. Give it a value (0 to 1) and the runes stay charged one by one, clockwise from the top.
// At 100% the wisp spirals into the middle and flares, the floor answers, and something climbs out of it and takes the light in its hand.
// Everything is painted in code at 97 x 97: a height map of the stone, lit per pixel by the wisp, then crushed to a fixed palette. No assets, no network.
//
// One file, no dependencies. Load it with a script tag and put <sigil-spinner></sigil-spinner> where the spinner goes.
// It fires "sigil:done" once, when the circle is answered.
(() => {
'use strict';
if (customElements.get('sigil-spinner')) return;   // loaded twice: the first one stands
function hash(x, y) { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vnoise(x, y) { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy), l = (a, b, t) => a + (b - a) * t; return l(l(hash(xi, yi), hash(xi + 1, yi), sx), l(hash(xi, yi + 1), hash(xi + 1, yi + 1), sx), sy); }
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v), mix = (a, b, t) => a + (b - a) * t, smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const TAU = Math.PI * 2;

const W = 97, H = 97, C = 48, UP = 4, N = 16;   // the scene in art pixels, its middle pixel, canvas pixels to each art pixel, and how many runes there are
const R_D = 47.6, R_RUNE = 33, REV = 1.6;       // the edge of the flagstone, the radius of the rune ring (and of the wisp's orbit), seconds for a turn
const PAL = [
  '#020307', '#05060b', '#090b13', '#0e111c', '#141928', '#1b2236', '#242d46', '#2f3b5a', '#3d4d72', '#516590', '#6c83ad',   // the stone, cold
  '#0a0813', '#110d20',                                                                                                    // the stone in deep shadow, a little violet
  '#04100f', '#071a1b', '#0b2628', '#103639', '#16494c', '#1f6064', '#2c7c7e', '#40999a', '#5fb8b4', '#8adbd0',            // the stone with the wisp on it
  '#0f4a4a', '#14706a', '#1f9a88', '#38c4a6', '#7aeccc', '#c4fff0', '#f4fffa',                                            // the wisp itself
  '#3a0a08', '#7c1e12', '#b8421a', '#e0641e', '#f89a38', '#fbe88a',                                                       // ember: eyes
  '#030206', '#08060e', '#4a4038', '#8a7c68',                                                                              // the figure, and horn
];
const mk = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h });
const soft = mk(W, H), sctx = soft.getContext('2d', { willReadFrequently: true });
let g = sctx;
const rc = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };

// ───────── crush: every pixel to the nearest palette colour, with a 4 x 4 ordered dither ─────────
const B4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5], SPREAD = 8;
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

// ───────── the stone: baked once as a height map, an albedo and a shine, so that a light can be put on it every frame ─────────
const NPX = W * H, SW = 36, SH = 40, FEET = 60;   // the figure's sprite is 36 x 40, and its hem rests on row 60
const dist = (x, y) => Math.hypot(x - C, y - C);
let HT, NX, NY, NZ, AR, AG, AB, SP, RID, RW, RBW, RBI, DISC, MASK;
let CAL, CAA, CNX, CNY, CNZ, CHT;   // the figure: albedo, alpha, normals, height
function boxBlur(a, w, h, r) {
  const t = new Float32Array(a.length), o = new Float32Array(a.length), n = 2 * r + 1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let s = 0; for (let k = -r; k <= r; k++) s += a[y * w + clamp(x + k, 0, w - 1)]; t[y * w + x] = s / n; }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let s = 0; for (let k = -r; k <= r; k++) s += t[clamp(y + k, 0, h - 1) * w + x]; o[y * w + x] = s / n; }
  return o;
}
function maskOf(w, h, draw) {   // draw white strokes on black and get back a 0 to 1 map
  const c = mk(w, h), x = c.getContext('2d', { willReadFrequently: true }); x.fillStyle = '#000'; x.fillRect(0, 0, w, h); x.strokeStyle = x.fillStyle = '#fff'; x.lineCap = x.lineJoin = 'round'; draw(x);
  const d = x.getImageData(0, 0, w, h).data, m = new Float32Array(w * h); for (let i = 0; i < m.length; i++) m[i] = d[i * 4] / 255; return m;
}
// Sixteen runes, each a few straight strokes on a 5 x 7 grid, with the top of the rune pointing out from the circle. They are made up: none is a letter.
const RUNES = [
  [[[1, 0], [1, 7]], [[1, 2], [4, 0]], [[1, 4], [4, 2]]], [[[0, 7], [0, 0], [3, 2], [3, 7]]], [[[1, 0], [1, 7]], [[1, 2], [4, 3.5], [1, 5]]], [[[1, 0], [1, 7]], [[1, 1], [4, 3]], [[1, 3], [4, 5]]],
  [[[1, 0], [1, 7]], [[1, 0], [4, 2], [1, 4]], [[1, 4], [4, 7]]], [[[4, 1], [1, 3.5], [4, 6]]], [[[0, 1], [4, 6]], [[4, 1], [0, 6]]], [[[1, 0], [1, 7]], [[1, 0], [4, 2], [1, 4]]],
  [[[0, 0], [0, 7]], [[4, 0], [4, 7]], [[0, 2], [4, 5]]], [[[2, 0], [2, 7]], [[0, 2.5], [4, 4.5]]], [[[2, 0], [0, 2], [2, 4]], [[2, 3], [4, 5], [2, 7]]], [[[2, 0], [2, 7]], [[2, 0], [0, 2]], [[2, 7], [4, 5]]],
  [[[2, 0], [2, 7]], [[2, 3.5], [0, 0.5]], [[2, 3.5], [4, 0.5]]], [[[3.5, 0], [0.5, 2.3], [3.5, 4.7], [0.5, 7]]], [[[2, 0], [2, 7]], [[2, 0], [0, 2.5]], [[2, 0], [4, 2.5]]], [[[1, 0], [1, 7]], [[1, 0], [4, 1.7], [1, 3.5], [4, 5.2], [1, 7]]],
];
const RUNE_A = (i) => (i * TAU) / N;
function bakeStone() {
  const CX = C + 0.5, ring = (x, r, w) => { x.lineWidth = w; x.beginPath(); x.arc(CX, CX, r, 0, TAU); x.stroke(); }, line = (x, a, b) => { x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.stroke(); };
  // the circle: rings with a dial of ticks between them, a ring of runes, an inner ring, a five-pointed star, and a round well in the middle
  const GR = maskOf(W, H, (x) => {
    ring(x, 42.6, 1.7); ring(x, 40, 1); x.lineWidth = 0.9;
    for (let k = 0; k < 48; k++) { const a = (k * TAU) / 48, r1 = k % 4 === 0 ? 42.2 : 41.4; line(x, [CX + 40.5 * Math.sin(a), CX - 40.5 * Math.cos(a)], [CX + r1 * Math.sin(a), CX - r1 * Math.cos(a)]); }
    ring(x, 27, 1.7); ring(x, 25.2, 1);
    const v = Array.from({ length: 5 }, (_, k) => { const a = -Math.PI / 2 + (k * TAU) / 5; return [CX + 24.2 * Math.cos(a), CX + 24.2 * Math.sin(a)]; });
    x.lineWidth = 1.15; for (let k = 0; k < 5; k++) line(x, v[k], v[(k + 2) % 5]);
    x.lineWidth = 0.9; for (const [vx, vy] of v) { x.beginPath(); x.arc(vx, vy, 2.4, 0, TAU); x.stroke(); }
    ring(x, 9, 1.4); ring(x, 6.4, 0.8);
  });
  const RM = Array.from({ length: N }, (_, i) => maskOf(W, H, (x) => {
    x.save(); x.translate(CX, CX); x.rotate(RUNE_A(i)); x.translate(0, -R_RUNE); x.scale(1.2, 1.2); x.lineWidth = 1.2 / 1.2 * 1.05;
    for (const st of RUNES[i]) { x.beginPath(); st.forEach(([px, py], q) => (q ? x.lineTo(px - 2, py - 3.5) : x.moveTo(px - 2, py - 3.5))); x.stroke(); } x.restore();
  }));
  // cracks and pits, placed by hand; a crack is a few straight runs with a kink at each joint
  const crack = (pts) => (x) => { x.lineWidth = 0.8; x.beginPath(); pts.forEach(([px, py], q) => (q ? x.lineTo(px, py) : x.moveTo(px, py))); x.stroke(); };
  const CK = maskOf(W, H, (x) => {
    for (const pts of [[[8, 61], [12, 65], [13, 70], [18, 74], [19, 79]], [[13, 70], [9, 74], [10, 78]], [[88, 24], [83, 28], [82, 34], [76, 38], [75, 44]], [[82, 34], [87, 37]], [[62, 88], [60, 82], [63, 77], [61, 72]], [[33, 8], [36, 12], [34, 17], [38, 20]]]) crack(pts)(x);
  });
  const PT = maskOf(W, H, (x) => { for (let k = 0; k < 16; k++) { const a = hash(k, 5) * TAU, r = 13 + hash(k, 6) * 29; x.beginPath(); x.ellipse(CX + r * Math.cos(a), CX + r * Math.sin(a), 0.7 + hash(k, 7) * 1.3, 0.6 + hash(k, 8) * 1.0, hash(k, 9) * 3, 0, TAU); x.fill(); } });
  const D = new Float32Array(NPX); RID = new Int8Array(NPX).fill(-1); RW = new Float32Array(NPX);
  for (let i = 0; i < NPX; i++) D[i] = GR[i];
  for (let q = 0; q < N; q++) for (let i = 0; i < NPX; i++) { if (RM[q][i] > D[i]) D[i] = RM[q][i]; if (RM[q][i] > RW[i]) { RW[i] = RM[q][i]; RID[i] = q; } }
  // a halo around each rune, so a charged one blooms a little into the stone
  RBW = boxBlur(RW, W, H, 2); RBI = new Int8Array(NPX).fill(-1);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let best = 0, id = -1; for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const j = clamp(y + dy, 0, H - 1) * W + clamp(x + dx, 0, W - 1); if (RW[j] > best) { best = RW[j]; id = RID[j]; } } RBI[y * W + x] = id; }
  const DS = boxBlur(D, W, H, 1), CKS = boxBlur(CK, W, H, 1), PTS = boxBlur(PT, W, H, 1);
  // flagstones: a grid that wanders, laid in running bond, each slab a little domed, with a joint round it
  HT = new Float32Array(NPX); AR = new Float32Array(NPX); AG = new Float32Array(NPX); AB = new Float32Array(NPX); SP = new Float32Array(NPX); DISC = new Uint8Array(NPX);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const p = y * W + x, d = dist(x, y); DISC[p] = d <= R_D ? 1 : 0;
    const wx = x + 1.6 * Math.sin(y * 0.09 + 1), wy = y + 1.4 * Math.sin(x * 0.075), gx = Math.floor(wx / 34), off = gx & 1 ? 0.5 : 0, gyf = wy / 26 + off, gy = Math.floor(gyf);
    const fx = wx / 34 - gx, fy = gyf - gy, dj = Math.min(fx * 34, (1 - fx) * 34, fy * 26, (1 - fy) * 26), jd = 1 - smooth(0.2, 1.2, dj), tint = hash(gx, gy) - 0.5;
    let h = 0.45 * smooth(0, 7, dj) + 0.22 * (vnoise(x * 0.07, y * 0.07) - 0.5) - 0.8 * jd - 2.5 * DS[p] - 1.5 * CKS[p] - 1.2 * PTS[p];
    h += 1.5 * smooth(43.4, 45.4, d) - 4.5 * smooth(46, 47.6, d);   // a raised lip round the edge, and the drop outside it
    HT[p] = h;
    const mott = 0.82 + 0.3 * vnoise(x * 0.05 + 9, y * 0.05), dark = (1 - 0.4 * jd) * (1 - 0.8 * D[p]) * (1 - 0.7 * CKS[p]) * (1 - 0.5 * PTS[p]) * (1 - 0.65 * smooth(44.6, 47.6, d));
    AR[p] = (108 + tint * 22) * mott * dark; AG[p] = (118 + tint * 14) * mott * dark; AB[p] = (146 - tint * 10) * mott * dark;
    SP[p] = 0.22 + 0.5 * vnoise(x * 0.06 + 3, y * 0.06 + 11);   // damp patches shine more
  }
  HT = boxBlur(HT, W, H, 1); NX = new Float32Array(NPX); NY = new Float32Array(NPX); NZ = new Float32Array(NPX);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const p = y * W + x, nx = (HT[y * W + clamp(x - 1, 0, W - 1)] - HT[y * W + clamp(x + 1, 0, W - 1)]) * 1.0, ny = (HT[clamp(y - 1, 0, H - 1) * W + x] - HT[clamp(y + 1, 0, H - 1) * W + x]) * 1.0, l = 1 / Math.hypot(nx, ny, 1);
    NX[p] = nx * l; NY[p] = ny * l; NZ[p] = l;
  }
  MASK = mk(W, H); { const m = MASK.getContext('2d'); m.fillStyle = '#000'; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (DISC[y * W + x]) m.fillRect(x, y, 1, 1); }
}
// ───────── the thing that answers: a hooded, horned figure, painted once, with a height from its own outline so that light can find its edges ─────────
const HAND = [33, 31];   // where its open hand is, in the sprite
function bakeFigure() {
  const c = mk(SW, SH), x = c.getContext('2d', { willReadFrequently: true });
  const poly = (pts, col) => { x.fillStyle = col; x.beginPath(); pts.forEach(([px, py], q) => (q ? x.lineTo(px, py) : x.moveTo(px, py))); x.closePath(); x.fill(); };
  const horn = (s) => { x.fillStyle = '#d8c8a4'; x.beginPath(); x.moveTo(18 + s * 6, 11); x.bezierCurveTo(18 + s * 13, 11, 18 + s * 17, 7, 18 + s * 16.5, 0.3); x.bezierCurveTo(18 + s * 14, 5, 18 + s * 9, 7, 18 + s * 4.5, 7); x.closePath(); x.fill(); };
  horn(-1); horn(1);
  const cl = x.createLinearGradient(0, 14, 0, 40); cl.addColorStop(0, '#2a2240'); cl.addColorStop(1, '#120e1c');
  poly([[11.5, 14.5], [24.5, 14.5], [29, 17], [30, 24], [31, 32], [34, 39.5], [31, 38], [28, 40], [25, 38.5], [22, 40], [18.5, 38.5], [15, 40], [11.5, 38.5], [8, 40], [6, 38], [4.5, 39.5], [5, 32], [6, 24], [8, 17]], cl);
  x.strokeStyle = '#2a2240'; x.lineCap = 'round'; x.lineWidth = 3.2; x.beginPath(); x.moveTo(27, 18); x.lineTo(31, 25); x.lineTo(HAND[0], HAND[1]); x.stroke();   // the arm that holds out its hand
  x.lineWidth = 3; x.beginPath(); x.moveTo(9, 18); x.lineTo(6.5, 30); x.stroke();
  x.lineWidth = 0.9; for (const [dx, dy] of [[-2.2, 1.6], [0.4, 2.4], [2.2, 1.4]]) { x.beginPath(); x.moveTo(HAND[0], HAND[1]); x.lineTo(HAND[0] + dx, HAND[1] + dy); x.stroke(); }
  const hood = x.createLinearGradient(0, 4, 0, 15); hood.addColorStop(0, '#32284a'); hood.addColorStop(1, '#1c1630');
  x.fillStyle = hood; x.beginPath(); x.moveTo(18, 3); x.quadraticCurveTo(26.5, 8, 25.5, 16); x.lineTo(10.5, 16); x.quadraticCurveTo(9.5, 8, 18, 3); x.fill();
  x.fillStyle = '#030206'; x.beginPath(); x.ellipse(18, 11.4, 4.8, 5.4, 0, 0, TAU); x.fill();   // the face is a dark hollow
  const d = x.getImageData(0, 0, SW, SH).data; CAL = new Uint8Array(d); CAA = new Float32Array(SW * SH); for (let i = 0; i < CAA.length; i++) CAA[i] = d[i * 4 + 3] / 255;
  const F = maskOf(SW, SH, (f) => { f.lineWidth = 0.9; for (const [x0, y0, x1, y1] of [[14, 18, 12, 38], [18, 17, 18, 39], [22, 18, 25, 38], [10, 22, 8, 36], [27, 24, 30, 37]]) { f.beginPath(); f.moveTo(x0, y0); f.lineTo(x1, y1); f.stroke(); } });   // folds in the cloak
  const HOL = maskOf(SW, SH, (f) => { f.beginPath(); f.ellipse(18, 11.4, 4.8, 5.4, 0, 0, TAU); f.fill(); });
  const B = boxBlur(CAA, SW, SH, 2), B2 = boxBlur(B, SW, SH, 2); CHT = new Float32Array(SW * SH);
  for (let i = 0; i < CHT.length; i++) CHT[i] = B2[i] * 7 + 0.8 * F[i] - 1.6 * HOL[i];
  CNX = new Float32Array(SW * SH); CNY = new Float32Array(SW * SH); CNZ = new Float32Array(SW * SH);
  for (let yy = 0; yy < SH; yy++) for (let xx = 0; xx < SW; xx++) { const p = yy * SW + xx, nx = (CHT[yy * SW + clamp(xx - 1, 0, SW - 1)] - CHT[yy * SW + clamp(xx + 1, 0, SW - 1)]) * 0.8, ny = (CHT[clamp(yy - 1, 0, SH - 1) * SW + xx] - CHT[clamp(yy + 1, 0, SH - 1) * SW + xx]) * 0.8, l = 1 / Math.hypot(nx, ny, 1); CNX[p] = nx * l; CNY[p] = ny * l; CNZ[p] = l; }
}

// ───────── the wisp, and when things happen ─────────
// The answer, in seconds from the moment the circle is done: the wisp spirals in, flares, the figure climbs out, the wisp goes to its hand, and it is still.
const T_IN = 0.9, T_UP0 = 1.1, T_UP1 = 2.5, T_HAND0 = 2.4, T_HAND1 = 3.3, SETTLED = 4;
const FX = C - 18, FY = FEET - SH;   // where the figure's sprite is, when it has come all the way up
const HX = FX + HAND[0] + 1, HY = FY + HAND[1] - 5;   // where the wisp rests: just above its hand
function flashAt(s) { return s.done ? smooth(T_IN - 0.05, T_IN + 0.06, s.ta) * (1 - smooth(T_IN + 0.06, T_IN + 0.9, s.ta)) : 0; }
function wispAt(s) {   // { x, y, z, I, a }: where the light is, how high above the floor, how bright, and how far round the ring
  const t = s.time, fl = 0.9 + 0.1 * vnoise(t * 9, 4), bob = Math.sin(t * 5.3); let R = R_RUNE + bob * 1.2, a = (t / REV) * TAU, z = 11 + Math.sin(t * 4.1) * 1.1, I = fl, x, y;
  if (!s.done) { x = C + R * Math.sin(a); y = C - R * Math.cos(a); }
  else {
    const ta = s.ta, f = flashAt(s);
    if (ta < T_IN) { const u = ta / T_IN; R *= (1 - u) * (1 - u); a += 9 * u * u; x = C + R * Math.sin(a); y = C - R * Math.cos(a); z += 4 * u; I = fl * (1 + 1.1 * u); }
    else {
      const v = smooth(T_HAND0, T_HAND1, ta), settle = smooth(T_HAND0, SETTLED, ta); x = mix(C, HX, v); y = mix(C + 3, HY, v) + (ta > T_HAND1 ? bob * 0.6 : 0); z = mix(13, 9, v) + Math.sin(t * 3) * 0.5; I = fl * mix(1.7, 1.2, settle);
    }
    I += 4.2 * f * fl;
  }
  return { x, y, z, I, a };
}

// ───────── the scene: one light, put on every pixel of the stone ─────────
const AMB = [0.036, 0.045, 0.078], SF = [0.07, 0.15, 0.27, 0.42, 0.6], AMP = 2.1, R0 = 21, RMAX = 62;
const IMG = sctx.createImageData(W, H), OUT = IMG.data;
const MOTES = Array.from({ length: 26 }, (_, k) => [hash(k, 1) * 70 + 13, hash(k, 2) * 60 + 18, 0.6 + hash(k, 3) * 1.1, hash(k, 4) * TAU]);
function scene(s) {
  const t = s.time, ta = s.ta, done = s.done, wsp = wispAt(s), wx = wsp.x, wy = wsp.y, wz = wsp.z, I = wsp.I, flash = flashAt(s), heat = s.heat;
  const settle = done ? smooth(T_HAND0, SETTLED, ta) : 0, charge = done ? mix(1 + 1.8 * flash, 0.55, settle) : 1;   // the runes burn brighter in the flare and bank down once it is quiet
  const up = done ? clamp((ta - T_UP0) / (T_UP1 - T_UP0), 0, 1) : 0, rise = 1 - (1 - up) * (1 - up) * (1 - up), oy = Math.round(FY + SH * (1 - rise));   // how far the figure has come out of the floor
  const ringR = done && ta > T_IN + 0.02 ? (ta - T_IN - 0.02) * 74 : -50, ringA = done ? clamp(1 - (ta - T_IN - 0.02) / 0.8, 0, 1) : 0;
  const amp = AMP * I;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const p = y * W + x, o = p * 4; if (!DISC[p]) { OUT[o] = OUT[o + 1] = OUT[o + 2] = 0; OUT[o + 3] = 255; continue; }
    const hh = HT[p], dx = wx - x, dy = wy - y, dz = wz - hh, dxy2 = dx * dx + dy * dy, d2 = dxy2 + dz * dz, inv = 1 / Math.sqrt(d2), lx = dx * inv, ly = dy * inv, lz = dz * inv;
    const nl = NX[p] * lx + NY[p] * ly + NZ[p] * lz, win = 1 - Math.min(1, d2 / (RMAX * RMAX)), att = (win * win) / (1 + d2 / (R0 * R0));
    let diff = 0, spec = 0;
    if (nl > 0) {
      let occ = 0; for (let q = 0; q < 5; q++) { const f = SF[q], sx = clamp((x + dx * f + 0.5) | 0, 0, W - 1), sy = clamp((y + dy * f + 0.5) | 0, 0, H - 1); if (HT[sy * W + sx] > hh + dz * f - 0.1) occ += 0.1; }   // a groove or a lip in the way throws a shadow
      const sh = 1 - Math.min(0.4, occ); diff = nl * att * amp * sh;
      const hz = lz + 1, hl = 1 / Math.hypot(lx, ly, hz), nh = Math.max(0, (NX[p] * lx + NY[p] * ly + NZ[p] * hz) * hl), n2 = nh * nh, n4 = n2 * n2, n8 = n4 * n4, n16 = n8 * n8; spec = n16 * n16 * SP[p] * att * amp * sh * 0.55;
    }
    const hot = Math.min(1, att * I * 0.9), lr = mix(0.32, 0.72, hot), lg = 1, lb = mix(0.82, 0.95, hot), haze = 0.09 * I / (1 + dxy2 / 60);   // the light is teal, and whiter at its heart; some of it hangs in the air
    let r = AR[p] * (AMB[0] + lr * diff) / 255 + lr * (spec + haze * 0.4), gg = AG[p] * (AMB[1] + lg * diff) / 255 + lg * (spec + haze), b = AB[p] * (AMB[2] + lb * diff) / 255 + lb * (spec + haze * 0.85);
    // the runes: charged ones glow in their grooves, most where the wisp is; the ones it passes in a plain spin are hot, and cool behind it
    const id = RID[p], bid = RBI[p];
    if (id >= 0 || (bid >= 0 && RBW[p] > 0.02)) {
      const k = id >= 0 ? id : bid, e = heat[k] * charge;
      if (e > 0.01) {
        const prox = 1 / (1 + dxy2 / 150), gl = e * (0.34 + 0.66 * prox), w = id >= 0 ? RW[p] : RBW[p] * 0.16, hotw = Math.max(0, gl - 0.62) * 2.6, tw = Math.min(1, gl * 1.5);
        r += w * (0.08 * tw + 0.8 * hotw); gg += w * (0.85 * tw + 0.5 * hotw); b += w * (0.7 * tw + 0.5 * hotw);
      }
    }
    if (ringA > 0) { const dd = (dist(x, y) - ringR) / 2.2, rv = Math.exp(-dd * dd) * ringA * 1.3; r += rv * 0.5; gg += rv; b += rv * 0.9; }   // the answer goes out across the floor as a ring of light
    OUT[o] = 255 * (1 - Math.exp(-1.25 * r)); OUT[o + 1] = 255 * (1 - Math.exp(-1.25 * gg)); OUT[o + 2] = 255 * (1 - Math.exp(-1.25 * b)); OUT[o + 3] = 255;
  }
  // the figure, lit by the same wisp, with the part of it still under the floor not drawn
  if (done && ta > T_UP0 - 0.05) {
    for (let sy = 0; sy < SH; sy++) {
      const y = oy + sy; if (y > FEET || y < 0) continue;
      for (let sx = 0; sx < SW; sx++) {
        const i = sy * SW + sx, a = CAA[i]; if (a < 0.05) continue; const x = FX + sx; if (x < 0 || x >= W) continue;
        const dx = wx - x, dy = wy - y, dz = wz - 2 - CHT[i], d2 = dx * dx + dy * dy + dz * dz, inv = 1 / Math.sqrt(d2), nl = Math.max(0, CNX[i] * dx * inv + CNY[i] * dy * inv + CNZ[i] * dz * inv), win = 1 - Math.min(1, d2 / (RMAX * RMAX)), att = (win * win) / (1 + d2 / (R0 * R0));
        const df = nl * att * amp * 2.4, hot = Math.min(1, att * I * 0.9), lr = mix(0.32, 0.72, hot), lg = 1, lb = mix(0.82, 0.95, hot), rimv = Math.pow(1 - CNZ[i], 2) * att * amp * 2.2;   // the edge facing the light catches it
        const r = CAL[i * 4] * (AMB[0] * 1.5 + lr * (df + rimv * 0.5)) / 255, gg = CAL[i * 4 + 1] * (AMB[1] * 1.5 + lg * (df + rimv)) / 255, b = CAL[i * 4 + 2] * (AMB[2] * 1.5 + lb * (df + rimv * 0.9)) / 255, o = (y * W + x) * 4;
        OUT[o] += a * (255 * (1 - Math.exp(-1.25 * r)) - OUT[o]); OUT[o + 1] += a * (255 * (1 - Math.exp(-1.25 * gg)) - OUT[o + 1]); OUT[o + 2] += a * (255 * (1 - Math.exp(-1.25 * b)) - OUT[o + 2]);
      }
    }
  }
  g = sctx; g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.putImageData(IMG, 0, 0);

  // what hangs in the air: mist where the figure climbs out, dust that only shows where the light catches it, and sparks off the wisp
  g.globalCompositeOperation = 'lighter';
  if (done && ta > T_UP0 - 0.2 && ta < T_HAND1 + 0.6) { const m = smooth(T_UP0 - 0.2, T_UP0 + 0.4, ta) * (1 - smooth(T_UP1, T_HAND1 + 0.6, ta)); for (const [oyy, rr] of [[0, 15], [-9, 12], [-18, 9]]) { const gr = g.createRadialGradient(C, FEET + oyy, 1, C, FEET + oyy, rr); gr.addColorStop(0, `rgba(80,200,170,${0.2 * m})`); gr.addColorStop(1, 'rgba(80,200,170,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); } }
  const dust = (k) => { const m = MOTES[k]; return [m[0] + 5 * Math.sin(t * 0.33 + m[3]) + 3 * Math.sin(t * 0.9 + k), ((m[1] - t * m[2] * 1.4) % 64 + 64) % 64 + 16]; };
  for (let k = 0; k < MOTES.length; k++) { const [mx, my] = dust(k), px = Math.round(mx), py = Math.round(my); if (dist(px, py) > 42) continue; const dd = (px - wx) ** 2 + (py - wy) ** 2, br = I * Math.exp(-dd / 700) * (0.6 + 0.4 * Math.sin(t * 3 + k * 2)); if (br > 0.14) rc(px, py, 1, 1, br > 0.8 ? '#7aeccc' : br > 0.4 ? '#38c4a6' : '#14706a'); }
  g.globalCompositeOperation = 'source-over';
  // the wisp itself: a little flame with a tail of the places it has just been, and sparks that come off it and rise
  const wispOn = !done || ta < T_HAND1 + 2, fade = done ? 1 : 1, wxr = Math.round(wx), wyr = Math.round(wy);
  if (!done || ta < T_IN) {
    const a0 = wsp.a, tail = done ? 1 - smooth(0.3, T_IN, ta) : 1;
    for (let k = 14; k >= 1; k--) { const a = a0 - k * 0.075, R = R_RUNE + Math.sin((t - k * 0.012) * 5.3) * 1.2, rr = done ? R * (1 - ta / T_IN) * (1 - ta / T_IN) : R, x = C + Math.round(rr * Math.sin(a)), y = C - Math.round(rr * Math.cos(a)), ix = Math.round((5.6 - k * 0.36) * tail); if (ix >= 1) { g.fillStyle = ['#0f4a4a', '#14706a', '#1f9a88', '#38c4a6', '#7aeccc', '#c4fff0'][clamp(ix - 1, 0, 5)]; g.fillRect(x, y, 1, 1); if (k < 5) g.fillRect(x, y - 1, 1, 1); } }
  }
  if (wispOn) {
    const gl = g.createRadialGradient(wxr + 0.5, wyr + 0.5, 0.5, wxr + 0.5, wyr + 0.5, 11); gl.addColorStop(0, `rgba(120,240,205,${0.2 * Math.min(1.6, I)})`); gl.addColorStop(1, 'rgba(120,240,205,0)'); g.globalCompositeOperation = 'lighter'; g.fillStyle = gl; g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'source-over';
    const f1 = vnoise(t * 13, 7), f2 = vnoise(t * 17, 3), big = 1.35 + 0.45 * Math.max(0, I - 1.6);
    g.fillStyle = '#38c4a6'; g.beginPath(); g.moveTo(wxr - 2.4 * big, wyr + 1.5); g.quadraticCurveTo(wxr - 2.2 * big, wyr - 2.5, wxr + (f1 - 0.5) * 2.5, wyr - 8 - 4 * f2); g.quadraticCurveTo(wxr + 2.2 * big, wyr - 2.5, wxr + 2.4 * big, wyr + 1.5); g.quadraticCurveTo(wxr, wyr + 3.5, wxr - 2.4 * big, wyr + 1.5); g.fill();
    g.fillStyle = '#7aeccc'; g.beginPath(); g.ellipse(wxr, wyr, 1.8 * big, 2.7 * big, 0, 0, TAU); g.fill(); g.fillStyle = '#f4fffa'; g.beginPath(); g.ellipse(wxr, wyr + 0.3, 0.9 * big, 1.5 * big, 0, 0, TAU); g.fill();
    for (let k = 0; k < 8; k++) { const ph = (t * 0.9 + k / 8) % 1, sd = Math.floor(t * 0.9 + k / 8), sx = wxr + Math.round((hash(k, sd) - 0.5) * 9 * (0.4 + ph)), sy = wyr - 3 - Math.round(ph * 12); if (ph < 0.9) rc(sx, sy, 1, 1, ph < 0.3 ? '#c4fff0' : ph < 0.6 ? '#7aeccc' : '#1f9a88'); }
  }
  if (done && ta > T_UP0) {   // the eyes: two slits that open, white and then ember, with a little glow round them. They are the figure's own, and light nothing.
    const e = smooth(T_UP0 + 0.5, T_UP1, ta), blink = (t % 4.1) > 3.98, ey = oy + 11, c = ta < T_UP1 + 0.4 ? '#fffbd4' : '#f89a38';
    if (e > 0.05 && ey <= FEET && !blink) {
      g.globalCompositeOperation = 'lighter'; for (const ex of [FX + 16, FX + 20]) { const gr = g.createRadialGradient(ex, ey + 0.5, 0.5, ex, ey + 0.5, 3.6); gr.addColorStop(0, `rgba(240,110,40,${0.12 * e})`); gr.addColorStop(1, 'rgba(240,110,40,0)'); g.fillStyle = gr; g.fillRect(ex - 4, ey - 4, 9, 9); } g.globalCompositeOperation = 'source-over';
      rc(FX + 15, ey, 2, 1, c); rc(FX + 15, ey - 1, 1, 1, '#e0641e'); rc(FX + 19, ey, 2, 1, c); rc(FX + 20, ey - 1, 1, 1, '#e0641e');
    }
  }
}

// ───────── the element ─────────
const SHEET = `
:host{display:inline-block;position:relative;vertical-align:middle;width:${W}px;aspect-ratio:1;line-height:0}
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
  connectedCallback() { if (!baked) { bakeStone(); bakeFigure(); baked = true; } this._aria(); LIVE.add(this); this._render(); wake(); }
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
  get value() { return this._s.done ? 1 : this._s.det ? this._s.p : null; }   // the progress it is showing, 1 once done, or null while it only spins
  get done() { return this._s.done; }
  _finish() { const s = this._s; s.done = true; s.p = 1; s.det = true; s.ta = 0; this._aria(); this.dispatchEvent(new CustomEvent('sigil:done', { bubbles: true, composed: true })); }
  advance(dt) {
    const s = this._s; s.time += dt;
    if (!s.done) {
      s.det = this._want !== null;
      s.p += clamp((s.det ? this._want : 0) - s.p, -dt * 3, dt * 1.6);   // a jump in progress is walked, not teleported
      if (s.det && this._want >= 1 && s.p >= 0.999) this._finish();
    } else s.ta += dt;
    // which runes are charged. With a value: the first p x 16 of them, clockwise from the top. Without one: the ones the wisp has just gone past, cooling behind it.
    const wa = wispAt(s).a;
    for (let i = 0; i < N; i++) {
      const target = s.done ? 1 : s.det ? clamp(s.p * N - i, 0, 1) : (() => { const behind = (((wa - RUNE_A(i)) % TAU) + TAU) % TAU; return behind < 4.4 ? Math.pow(1 - behind / 4.4, 1.3) : 0; })();
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
