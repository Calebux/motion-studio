#!/usr/bin/env node
// mix.mjs — music + sfx → loudness-normalized (-14 LUFS, -1 dBTP) → muxed with the picture.
//
//   node tools/mix.mjs                               out/silent.mp4 + out/music.wav + out/sfx.wav → out/final.mp4
//   node tools/mix.mjs --video out/silent_1080x1080.mp4
//   node tools/mix.mjs --track audio/track.wav       use a supplied track instead of out/music.wav
//   options: --music-gain 1 --sfx-gain 0.8 --no-sfx  --lufs -14  --fade 0.3 (seconds, audio fade-out)  --out file
import { existsSync, rmSync } from 'node:fs';
import { parseArgs, num } from './lib/args.mjs';
import { ffmpeg, ffmpegStats, probeDuration } from './lib/ff.mjs';

const a = parseArgs();
const video = a.video || 'out/silent.mp4';
if (!existsSync(video)) { console.error(`✖ ${video} not found. Run: node tools/render.mjs`); process.exit(1); }
const dur = probeDuration(video);
const music = a.track || (existsSync('out/music.wav') ? 'out/music.wav' : null);
const sfx = a['no-sfx'] ? null : existsSync('out/sfx.wav') ? 'out/sfx.wav' : null;
const out = a.out || video.replace('silent', 'final').replace('draft', 'final_draft');
const lufs = num(a.lufs, -14), fade = num(a.fade, 0.3);

if (!music && !sfx) {
  console.warn('⚠ no audio found (out/music.wav, out/sfx.wav or --track). Copying picture only.');
  await ffmpeg(['-i', video, '-c', 'copy', out]);
  console.log('✔ ' + out); process.exit(0);
}

const inputs = [], chains = [], labels = [];
if (music) { inputs.push('-i', music); chains.push(`[${labels.length}:a]aresample=48000,volume=${num(a['music-gain'], 1)}[m]`); labels.push('[m]'); }
if (sfx) { inputs.push('-i', sfx); chains.push(`[${labels.length}:a]aresample=48000,volume=${num(a['sfx-gain'], 0.8)}[s]`); labels.push('[s]'); }
const fadeF = fade > 0 ? `,afade=t=out:st=${Math.max(0, dur - fade)}:d=${fade}` : '';
const graph = `${chains.join(';')};${labels.join('')}amix=inputs=${labels.length}:normalize=0:duration=longest,apad,atrim=0:${dur}${fadeF}[a]`;
const tmp = 'out/.premix.wav';
await ffmpeg([...inputs, '-filter_complex', graph, '-map', '[a]', '-ac', '2', '-ar', '48000', '-c:a', 'pcm_f32le', tmp]);   // float: no clipping before loudnorm

// two-pass loudnorm for accurate integrated loudness
const stats = ffmpegStats(['-i', tmp, '-af', `loudnorm=I=${lufs}:TP=-1:LRA=11:print_format=json`, '-f', 'null', '-']);
const m = JSON.parse(stats.slice(stats.lastIndexOf('{'), stats.lastIndexOf('}') + 1));
const ln = `loudnorm=I=${lufs}:TP=-1:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
// Encode, then verify true peak on the decoded AAC and back off if the encoder overshot (it can, by several dB).
const truePeak = (f) => { const r = ffmpegStats(['-i', f, '-vn', '-af', 'ebur128=peak=true', '-f', 'null', '-']); const x = /True peak:\s+Peak:\s+(-?[\d.]+)/.exec(r.replace(/\n/g, ' ')); return x ? Number(x[1]) : null; };
let trim = 0, tp = null;
for (let pass = 0; pass < 4; pass++) {
  await ffmpeg(['-i', video, '-i', tmp, '-map', '0:v', '-map', '1:a', '-c:v', 'copy',
    '-af', `${ln},volume=${trim}dB,aresample=192000,alimiter=limit=0.8:level=false:attack=2:release=60,aresample=48000`,
    '-c:a', 'aac', '-b:a', '192k', '-cutoff', '18000', '-shortest', '-movflags', '+faststart', out]);
  tp = truePeak(out);
  if (tp === null || tp <= -1) break;
  trim -= tp + 1.3;                                   // pull down by the overshoot plus a little headroom
}
rmSync(tmp, { force: true });
console.log(`✔ ${out}  (audio: ${[music, sfx].filter(Boolean).join(' + ')}, measured ${m.input_i} → ${lufs} LUFS, true peak ${tp} dBTP${trim ? `, trimmed ${trim.toFixed(1)} dB` : ''})`);
