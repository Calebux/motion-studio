#!/usr/bin/env node
// critique.mjs — make the film reviewable by eye AND by numbers.
//
//   node tools/critique.mjs                      reviews out/final.mp4 (or out/silent.mp4)
//   node tools/critique.mjs out/draft.mp4
//   node tools/critique.mjs --at 4.2             adds a 12-frame strip around 4.2s (catch pops/overlaps)
//
// Writes out/review/: contact.png (2 fps), phone.png (1 fps at 360px), strip.png, report.md, report.json
// Automated checks: dead time, loop seam, cut-to-beat sync, loudness/true peak, format.
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { parseArgs, num } from './lib/args.mjs';
import { ffmpeg, ffmpegStats } from './lib/ff.mjs';

const a = parseArgs();
const file = a._[0] || (existsSync('out/final.mp4') ? 'out/final.mp4' : 'out/silent.mp4');
if (!existsSync(file)) { console.error(`✖ ${file} not found`); process.exit(1); }
const dir = 'out/review';
mkdirSync(dir, { recursive: true });

// ---- probe ----------------------------------------------------------------
const pr = JSON.parse(spawnSync('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', file], { encoding: 'utf8' }).stdout);
const v = pr.streams.find((s) => s.codec_type === 'video'), au = pr.streams.find((s) => s.codec_type === 'audio');
const dur = Number(pr.format.duration), W = v.width, H = v.height;
const [fn, fd] = v.r_frame_rate.split('/').map(Number), fps = fn / fd;
const vertical = H > W;

// ---- sheets ---------------------------------------------------------------
const cols = vertical ? 8 : 5, tw = vertical ? 240 : 384;
const rows = Math.ceil((dur * 2) / cols);
await ffmpeg(['-i', file, '-vf', `fps=2,scale=${tw}:-2,tile=${cols}x${rows}:padding=6:margin=6:color=0x111111`, '-frames:v', '1', `${dir}/contact.png`]);
const prow = Math.ceil(dur / 6);
await ffmpeg(['-i', file, '-vf', `fps=1,scale=360:-2,tile=6x${prow}:padding=6:margin=6:color=0x111111`, '-frames:v', '1', `${dir}/phone.png`]);
if (a.at !== undefined) {
  const at = Math.max(0, num(a.at, 0) - 6 / fps);
  await ffmpeg(['-ss', String(at), '-i', file, '-vf', `scale=${vertical ? 200 : 320}:-2,tile=12x1:padding=4:color=0x111111`, '-frames:v', '1', `${dir}/strip.png`]);
}

// ---- motion per frame → dead time ----------------------------------------
const mstats = ffmpegStats(['-i', file, '-vf', 'scale=180:-2,format=gray,tblend=all_mode=difference,signalstats,metadata=print:key=lavfi.signalstats.YAVG', '-an', '-f', 'null', '-']);
const motion = [...mstats.matchAll(/YAVG=([\d.]+)/g)].map((m) => Number(m[1]));
const still = num(a.still, 0.08), minDead = num(a.dead, 1.2);
const dead = [];
let run = -1;
for (let i = 0; i <= motion.length; i++) {
  const quiet = i < motion.length && motion[i] < still;
  if (quiet && run < 0) run = i;
  if (!quiet && run >= 0) { const len = (i - run) / fps; if (len >= minDead) dead.push([+(run / fps).toFixed(2), +(i / fps).toFixed(2)]); run = -1; }
}

// ---- cuts → beat sync -----------------------------------------------------
// Visual "hits": peaks of scene-change score, clustered (a wipe spreads over several frames).
const cstats = ffmpegStats(['-i', file, '-vf', `scale=180:-2,select='gt(scene,${num(a.scene, 0.1)})',metadata=print`, '-an', '-f', 'null', '-']);
const raw = [...cstats.matchAll(/pts_time:([\d.]+)[\s\S]*?scene_score=([\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
const cuts = [];
for (let i = 0; i < raw.length;) {
  let j = i, best = raw[i];
  while (j + 1 < raw.length && raw[j + 1][0] - raw[j][0] < 0.15) { j++; if (raw[j][1] > best[1]) best = raw[j]; }
  if (best[1] >= num(a.cut, 0.14)) cuts.push(best[0]);
  i = j + 1;
}
let sync = null;
if (existsSync('beats.json')) {
  const b = JSON.parse(readFileSync('beats.json', 'utf8'));
  // Cuts should land on beats or on strong hits — not on hats/arps (they'd make every time look "on grid").
  const strong = ['kick', 'snare', 'clap', 'impact', 'onset'];
  const grid = [...(b.beats || []), ...strong.flatMap((k) => b.hits?.[k] || [])].sort((x, y) => x - y);
  const off = cuts.map((c) => {
    let best = Infinity; for (const g of grid) if (Math.abs(g - c) < Math.abs(best)) best = g - c;
    return { t: +c.toFixed(3), offBeatMs: Math.round(-best * 1000) };
  });
  sync = { cuts: off, offGrid: off.filter((o) => Math.abs(o.offBeatMs) > 1000 / fps + 1) };
}

// ---- loop seam --------------------------------------------------------------
let seam = null;
{
  await ffmpeg(['-i', file, '-vf', 'select=eq(n\\,0)', '-frames:v', '1', `${dir}/.first.png`]);
  await ffmpeg(['-sseof', String(-2 / fps), '-i', file, '-update', '1', `${dir}/.last.png`]);
  const s = ffmpegStats(['-i', `${dir}/.first.png`, '-i', `${dir}/.last.png`, '-lavfi', 'ssim', '-f', 'null', '-']);
  const m = /All:([\d.]+)/.exec(s);
  seam = m ? Number(m[1]) : null;
}

// ---- audio ------------------------------------------------------------------
let audio = null;
if (au) {
  const s = ffmpegStats(['-i', file, '-vn', '-af', 'ebur128=peak=true', '-f', 'null', '-']);
  const I = /I:\s+(-?[\d.]+) LUFS/.exec(s.slice(s.lastIndexOf('Summary'))), TP = /Peak:\s+(-?[\d.]+) dBFS/.exec(s.slice(s.lastIndexOf('Summary')));
  audio = { lufs: I ? Number(I[1]) : null, truePeak: TP ? Number(TP[1]) : null };
}

// ---- report -----------------------------------------------------------------
const flags = [];
if (dead.length) flags.push(`Dead time (nothing moving ≥ ${minDead}s): ${dead.map(([s, e]) => `${s}–${e}s`).join(', ')}`);
if (sync?.offGrid.length) flags.push(`Cuts off the beat grid: ${sync.offGrid.map((o) => `${o.t}s (${o.offBeatMs > 0 ? '+' : ''}${o.offBeatMs}ms)`).join(', ')}`);
if (!au) flags.push('No audio track. Run tools/music.mjs / tools/sfx.mjs then tools/mix.mjs.');
if (audio?.lufs !== null && audio && Math.abs(audio.lufs + 14) > 1.5) flags.push(`Loudness ${audio.lufs} LUFS (target -14).`);
if (audio?.truePeak > -0.5) flags.push(`True peak ${audio.truePeak} dBFS (target ≤ -1).`);
const firstMotion = motion.slice(0, Math.round(fps * 0.5)).reduce((x, y) => x + y, 0);
if (firstMotion < still * fps * 0.1) flags.push('Nothing moves in the first 0.5s — the hook starts late.');

const report = { file, W, H, fps: +fps.toFixed(3), duration: +dur.toFixed(3), cuts: cuts.map((c) => +c.toFixed(3)), dead, sync, loopSeamSSIM: seam, audio, flags };
writeFileSync(`${dir}/report.json`, JSON.stringify(report, null, 1));
const md = `# Review — ${file}

${W}×${H} · ${fps.toFixed(2)} fps · ${dur.toFixed(2)}s · audio: ${au ? `${audio?.lufs} LUFS, TP ${audio?.truePeak} dBFS` : 'none'}

## Automated flags
${flags.length ? flags.map((f) => '- ' + f).join('\n') : '- none'}

## Numbers
- Cuts detected: ${cuts.length ? cuts.map((c) => c.toFixed(2) + 's').join(', ') : 'none'}
- Loop seam SSIM (first vs last frame): ${seam ?? 'n/a'} ${seam !== null ? (seam > 0.97 ? '(seamless)' : '(visible seam if this is meant to loop)') : ''}

## Look at these
- ${dir}/contact.png — 2 frames/second. Composition, variety, pacing.
- ${dir}/phone.png — 1 frame/second at 360px wide. Readability at phone size.
${a.at !== undefined ? `- ${dir}/strip.png — 12 consecutive frames around ${a.at}s. Pops, overlaps, sliding.\n` : ''}
## Score (fill in after looking — every score must reach 8)
| Criterion | Score | Worst problem (timestamp) |
|---|---|---|
| Hook in first 2s | | |
| Readability at phone size | | |
| Motion quality (springs, no dead frames) | | |
| Variety (new thing every 2–4s) | | |
| Composition | | |
| Brand accuracy | | |
| Sound sync | | |
`;
writeFileSync(`${dir}/report.md`, md);
console.log(md.split('## Score')[0].trim());
