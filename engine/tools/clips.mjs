#!/usr/bin/env node
// clips.mjs — turn video files into frame sequences the film can draw deterministically.
//
//   node tools/clips.mjs refs/kick.mp4 --name kick                    → assets/clips/kick/0001.jpg … + meta.json
//   node tools/clips.mjs demo.mp4 --name reveal --from 47 --to 51     trim
//   node tools/clips.mjs a.mp4 --name a --width 1280 --fps 30         (defaults: source fps, width ≤ 1280)
//   node tools/clips.mjs --all refs/videos                             every video in a folder (name = file name)
//
// In film.js:  clips: { kick: 'assets/clips/kick' }   then   g.drawImage(ctx.clip('kick', localT), …)
// ctx.clip(name, t, speed) picks the frame for local time t (speed < 1 = slow motion; hold t for hit-stop).
import { mkdirSync, writeFileSync, rmSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { basename, extname, join } from 'node:path';
import { parseArgs, num } from './lib/args.mjs';
import { ffmpeg } from './lib/ff.mjs';

const a = parseArgs();
const slug = (s) => s.toLowerCase().replace(/\.[^.]+$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const jobs = a.all
  ? readdirSync(a.all).filter((f) => /\.(mp4|mov|webm|m4v|mkv)$/i.test(f)).map((f) => ({ src: join(a.all, f), name: slug(f) }))
  : [{ src: a._[0], name: a.name || slug(basename(a._[0] || '')) }];
if (!jobs[0]?.src) { console.error('usage: node tools/clips.mjs <video> --name <name> [--from s --to s --width px --fps n]'); process.exit(1); }

for (const { src, name } of jobs) {
  const pr = JSON.parse(spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate', '-of', 'json', src], { encoding: 'utf8' }).stdout || '{}');
  const st = pr.streams?.[0];
  if (!st) { console.error(`✖ cannot read ${src}`); continue; }
  const [n, d] = st.r_frame_rate.split('/').map(Number);
  const fps = num(a.fps, Math.round((n / d) * 1000) / 1000);
  const width = Math.min(num(a.width, 1280), st.width);
  const dir = `assets/clips/${name}`;
  rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
  const trim = [];
  if (a.from !== undefined) trim.push('-ss', String(a.from));
  if (a.to !== undefined) trim.push('-to', String(a.to));
  await ffmpeg([...trim, '-i', src, '-vf', `fps=${fps},scale=${width}:-2:flags=lanczos`, '-q:v', String(num(a.q, 2)), `${dir}/%04d.jpg`]);
  const frames = readdirSync(dir).filter((f) => f.endsWith('.jpg')).length;
  const h = Math.round((width * st.height) / st.width / 2) * 2;
  writeFileSync(`${dir}/meta.json`, JSON.stringify({ src: basename(src), fps, frames, w: width, h, ext: 'jpg', duration: +(frames / fps).toFixed(3) }, null, 1));
  console.log(`✔ ${dir}  ${frames} frames @ ${fps}fps  ${width}×${h}  (${(frames / fps).toFixed(2)}s)`);
}
