#!/usr/bin/env node
// look.mjs: see an animation the way a reviewer should, as frames you can read one at a time.
//
//   node look.mjs "http://localhost:8000/sage/?film=1&state=reading" --times 0.4,1.6,2.75,3.0 --out reading.png
//
// Opens the page in headless Chrome, steps window.__film to each time (or just waits, if the page has no __film),
// and saves one sheet with every frame side by side. Then open the sheet and look at it before saying anything is done.
// Node 22 or later and Chrome. No installs. Options: --selector (what to capture, default "canvas"), --zoom, --cols,
// --width and --height for the window, --do "js to run after loading". Set CHROME if Chrome is somewhere unusual.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const args = process.argv.slice(2), url = args.find((a) => !a.startsWith('--'));
const opt = (name, fallback) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : fallback; };
if (!url) { console.error('usage: node look.mjs URL --times 0.5,1,2 [--selector canvas] [--out sheet.png] [--zoom 2] [--cols 4]'); process.exit(2); }
const times = opt('times', '0.5').split(',').map(Number), selector = opt('selector', 'canvas'), out = opt('out', 'sheet.png');
const zoom = +opt('zoom', 2), cols = +opt('cols', Math.min(4, times.length)), width = +opt('width', 900), height = +opt('height', 700), after = opt('do', '');
const CHROME = process.env.CHROME || ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync);
if (!CHROME) { console.error('Chrome not found. Set CHROME to its path.'); process.exit(2); }

const port = 9400 + Math.floor(Math.random() * 400);
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'look-'))}`, '--no-first-run', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let targets; for (let i = 0; i < 60 && !targets?.length; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); } catch { await sleep(200); } }
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl); await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0; const pending = new Map(), errors = [];
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text); });
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, (m) => res(m.result)); ws.send(JSON.stringify({ id: i, method, params })); });
const run = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.value;

await send('Runtime.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url }); await sleep(1500);
if (after) await run(after);
const stepped = await run('typeof window.__film === "object"');
// Each frame is drawn onto one sheet inside the page, so nothing but Chrome is needed to put them side by side.
await run(`(() => { window.__look = { shots: [], grab(t) { const el = ${JSON.stringify(selector)}.split(' >>> ').reduce((r, q, i) => (i ? r.shadowRoot : r).querySelector(q), document); if (!el) throw new Error('nothing matches ' + ${JSON.stringify(selector)}); const c = document.createElement('canvas'); c.width = el.width; c.height = el.height; c.getContext('2d').drawImage(el, 0, 0); this.shots.push([t, c]); } }; })()`);
let clock = 0;
for (const t of times) {
  if (stepped) await run(`(() => { const f = window.__film; if (f.seek) return f.seek(${t}); window.__lookT ??= 0; while (window.__lookT < ${t}) { f.step(60); window.__lookT += 1 / 60; } })()`);   // some pages only have step()
  else { await sleep(Math.max(0, (t - clock) * 1000)); clock = t; }
  await run(`window.__look.grab(${t})`);
}
const data = await run(`(() => { const s = window.__look.shots, w = s[0][1].width, h = s[0][1].height, z = ${zoom}, cols = ${cols}, rows = Math.ceil(s.length / cols), o = document.createElement('canvas'); o.width = (w * z + 8) * cols + 8; o.height = (h * z + 26) * rows + 8; const x = o.getContext('2d'); x.imageSmoothingEnabled = false; x.fillStyle = '#2b2b30'; x.fillRect(0, 0, o.width, o.height); x.font = '13px monospace'; s.forEach(([t, c], i) => { const px = 8 + (i % cols) * (w * z + 8), py = 8 + Math.floor(i / cols) * (h * z + 26); x.drawImage(c, px, py + 18, w * z, h * z); x.fillStyle = '#d0d0d8'; x.fillText(t.toFixed(2) + ' s', px, py + 12); }); return o.toDataURL('image/png'); })()`);
writeFileSync(out, Buffer.from(data.split(',')[1], 'base64'));
console.log(`${times.length} frames, ${stepped ? 'stepped with __film' : 'in real time (the page has no __film)'}, saved ${out}`);
console.log(errors.length ? 'script errors:\n  ' + errors.join('\n  ') : 'no script errors');
ws.close(); chrome.kill(); process.exit(errors.length ? 1 : 0);
