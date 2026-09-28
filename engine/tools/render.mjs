#!/usr/bin/env node
// render.mjs — deterministic frame-by-frame render of film.js.
//
//   node tools/render.mjs                      full render → out/silent.mp4
//   node tools/render.mjs --draft              fast preview render (30fps, no motion blur)
//   node tools/render.mjs --from 4 --to 6      re-render only those seconds, re-splice
//   node tools/render.mjs --size 1080x1080     another format from the same timeline
//   node tools/render.mjs --stills beats       one still per beat + out/contact.png
//   node tools/render.mjs --stills 0,1.5,3     specific times
//   node tools/render.mjs --stills every:0.5   every half second
//
// Options: --fps N --sub N (motion-blur subframes) --shutter 0.5 --workers N --crf 16 --chunk 1 --out file
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, readdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import os from 'node:os';
import { parseArgs, num } from './lib/args.mjs';
import { serve } from './lib/server.mjs';
import { launch, openFilm } from './lib/browser.mjs';
import { ffmpeg } from './lib/ff.mjs';

const a = parseArgs();
const t0 = Date.now();
const { server, url } = await serve(process.cwd());
const browser = await launch();
let exitCode = 0;

try {
  const probe = await openFilm(browser, url, { size: a.size });
  const meta = probe.meta;
  await probe.ctx.close();
  const size = `${meta.W}x${meta.H}`;
  mkdirSync('out', { recursive: true });

  if (a.stills) await stills(meta);
  else await video(meta, size);
} catch (e) {
  console.error('\n✖ ' + e.message);
  exitCode = 1;
} finally {
  await browser.close();
  server.close();
}
process.exit(exitCode);

// ---------------------------------------------------------------------------
async function video(meta, size) {
  const draft = !!a.draft;
  const fps = num(a.fps, draft ? 30 : meta.fps);
  const sub = num(a.sub, draft ? 1 : 4);
  const shutter = num(a.shutter, 0.5);
  const crf = num(a.crf, draft ? 23 : 16);
  const chunkSec = num(a.chunk, 1);
  const total = Math.round(meta.duration * fps);
  const perChunk = Math.max(1, Math.round(chunkSec * fps));
  const nChunks = Math.ceil(total / perChunk);
  const workers = Math.max(1, Math.min(num(a.workers, Math.max(1, Math.min(4, os.cpus().length - 1))), nChunks));
  const tag = `${size}@${fps}${draft ? '-draft' : ''}`;
  const dir = `out/.chunks/${tag}`;
  const out = a.out || `out/${draft ? 'draft' : 'silent'}${a.size ? '_' + size : ''}.mp4`;

  // cache manifest: any change of settings → full re-render
  const manifest = { fps, sub, shutter, crf, perChunk, total, size };
  const mfile = `${dir}/manifest.json`;
  let valid = existsSync(mfile) && JSON.stringify(JSON.parse(readFileSync(mfile, 'utf8'))) === JSON.stringify(manifest);
  if (!valid) { rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true }); writeFileSync(mfile, JSON.stringify(manifest)); }

  const name = (c) => `${dir}/c${String(c).padStart(4, '0')}.mp4`;
  let todo = [];
  if (a.from !== undefined || a.to !== undefined) {
    const f = num(a.from, 0), to = num(a.to, meta.duration);
    for (let c = 0; c < nChunks; c++) {
      const cs = (c * perChunk) / fps, ce = ((c + 1) * perChunk) / fps;
      if ((ce > f && cs < to) || !existsSync(name(c))) todo.push(c);
    }
  } else todo = [...Array(nChunks).keys()];

  console.log(`▶ ${meta.title}: ${size}, ${meta.duration}s @ ${fps}fps, ${sub}× subframes, ${todo.length}/${nChunks} chunks, ${workers} workers`);
  let done = 0, frames = 0;
  const queue = [...todo];
  const worker = async () => {
    const { page, ctx } = await openFilm(browser, url, { size: a.size });
    while (queue.length) {
      const c = queue.shift();
      const f0 = c * perChunk, f1 = Math.min(total, f0 + perChunk);
      await encodeChunk(page, name(c), f0, f1, { fps, sub, shutter, crf, draft });
      done++; frames += f1 - f0;
      const el = (Date.now() - t0) / 1000;
      process.stdout.write(`\r  chunk ${done}/${todo.length}  ·  ${frames} frames  ·  ${(frames / el).toFixed(1)} fps  ·  ${el.toFixed(0)}s   `);
    }
    await ctx.close();
  };
  await Promise.all(Array.from({ length: workers }, worker));
  process.stdout.write('\n');

  const list = `${dir}/list.txt`;
  writeFileSync(list, [...Array(nChunks).keys()].map((c) => `file '${name(c).split('/').pop()}'`).join('\n'));
  await ffmpeg(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', out]);
  console.log(`✔ ${out}  (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
}

async function encodeChunk(page, file, f0, f1, { fps, sub, shutter, crf, draft }) {
  const ff = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'image2pipe', '-framerate', String(fps), '-i', '-',
    '-c:v', 'libx264', '-preset', draft ? 'veryfast' : 'medium', '-crf', String(crf), '-pix_fmt', 'yuv420p',
    '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
    '-g', String(fps), '-video_track_timescale', String(fps * 1000), file], { stdio: ['pipe', 'inherit', 'inherit'] });
  const closed = new Promise((ok, fail) => ff.on('close', (c) => (c === 0 ? ok() : fail(new Error('ffmpeg exited ' + c)))));
  for (let f = f0; f < f1; f++) {
    const data = await page.evaluate(([t, s, sh, r]) => window.__frame(t, s, sh, r), [f / fps, sub, shutter, fps]);
    const buf = Buffer.from(data.slice(data.indexOf(',') + 1), 'base64');
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
  }
  ff.stdin.end();
  await closed;
}

// ---------------------------------------------------------------------------
async function stills(meta) {
  const spec = String(a.stills);
  let times;
  const beatsFile = existsSync('beats.json') ? JSON.parse(readFileSync('beats.json', 'utf8')) : null;
  if (spec === 'beats' || spec === 'downbeats') {
    if (!beatsFile) throw new Error('No beats.json — run tools/music.mjs or tools/beats.py first, or use --stills every:0.5');
    times = (spec === 'beats' ? beatsFile.beats : beatsFile.downbeats).filter((t) => t < meta.duration);
    // sample slightly after the beat so the hit has landed
    times = times.map((t) => Math.min(meta.duration - 1 / meta.fps, t + num(a.after, 0.12)));
  } else if (spec.startsWith('every:')) {
    const step = Number(spec.slice(6)); times = [];
    for (let t = 0; t < meta.duration; t += step) times.push(+t.toFixed(3));
  } else times = spec.split(',').map(Number);

  const dir = 'out/stills';
  rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
  const { page, ctx } = await openFilm(browser, url, { size: a.size });
  const urls = [];
  for (const t of times) {
    const d = await page.evaluate(([t, fps]) => window.__frame(t, 4, 0.5, fps), [t, meta.fps]);
    writeFileSync(`${dir}/t${t.toFixed(2).padStart(6, '0')}.png`, Buffer.from(d.split(',')[1], 'base64'));
    // keep only a small JPEG thumbnail for the contact sheet (full PNGs would exhaust browser memory)
    urls.push(await page.evaluate(async (src) => {
      const img = new Image(); img.src = src; await img.decode();
      const c = document.createElement('canvas'); c.width = 360; c.height = Math.round((360 * img.height) / img.width);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', 0.9);
    }, d));
  }
  await ctx.close();
  console.log(`✔ ${times.length} stills → ${dir}/`);

  // contact sheet with timestamps, composed in the browser (no font deps for ffmpeg)
  const vertical = meta.H > meta.W;
  const cols = num(a.cols, vertical ? 6 : 4), tw = vertical ? 270 : 480, th = Math.round((tw * meta.H) / meta.W);
  const cp = await browser.newPage();
  await cp.setContent('<canvas id=k></canvas>');
  const png = await cp.evaluate(async ([urls, times, cols, tw, th]) => {
    const rows = Math.ceil(urls.length / cols), pad = 8, lab = 26;
    const k = document.getElementById('k'); k.width = cols * (tw + pad) + pad; k.height = rows * (th + lab + pad) + pad;
    const g = k.getContext('2d'); g.fillStyle = '#111'; g.fillRect(0, 0, k.width, k.height);
    for (let i = 0; i < urls.length; i++) {
      const img = new Image(); img.src = urls[i]; await img.decode();
      const x = pad + (i % cols) * (tw + pad), y = pad + Math.floor(i / cols) * (th + lab + pad);
      g.drawImage(img, x, y + lab, tw, th);
      g.fillStyle = '#ddd'; g.font = '600 15px monospace'; g.fillText(`#${i + 1}  ${times[i].toFixed(2)}s`, x + 2, y + 18);
    }
    return k.toDataURL('image/png');
  }, [urls, times, cols, tw, th]);
  await cp.close();
  writeFileSync('out/contact.png', Buffer.from(png.split(',')[1], 'base64'));
  console.log('✔ out/contact.png');
}
