#!/usr/bin/env node
// preflight.mjs — check the studio toolchain and print exact fixes.
import { spawnSync } from 'node:child_process';
import os from 'node:os';

const mac = os.platform() === 'darwin';
const has = (cmd, args = ['-version']) => { const r = spawnSync(cmd, args, { encoding: 'utf8' }); return r.status === 0 ? (r.stdout || r.stderr) : null; };
let fail = 0, warn = 0;
const ok = (m) => console.log('✔ ' + m);
const bad = (m, fix) => { console.log('✖ ' + m + '\n    fix: ' + fix); fail++; };
const meh = (m, fix) => { console.log('⚠ ' + m + '\n    optional: ' + fix); warn++; };

const nodeMajor = Number(process.versions.node.split('.')[0]);
nodeMajor >= 20 ? ok(`node ${process.versions.node}`) : bad(`node ${process.versions.node} (need 20+)`, mac ? 'brew install node' : 'install Node 22 from nodejs.org');

const ff = has('ffmpeg');
if (!ff) bad('ffmpeg not found', mac ? 'brew install ffmpeg' : 'sudo apt install ffmpeg');
else {
  const enc = has('ffmpeg', ['-hide_banner', '-encoders']) || '';
  enc.includes('libx264') ? ok('ffmpeg ' + ff.split(' ')[2] + ' with libx264') : bad('ffmpeg lacks libx264', mac ? 'brew reinstall ffmpeg' : 'install a full ffmpeg build');
  has('ffprobe') ? ok('ffprobe') : bad('ffprobe not found', 'comes with ffmpeg');
}

try {
  const { launch } = await import('./lib/browser.mjs');
  const b = await launch(); const v = b.version(); await b.close();
  ok('headless chromium ' + v);
} catch (e) { bad('playwright/chromium: ' + e.message.split('\n')[0], 'npm i -D playwright && npx playwright install chromium'); }

const py = has('python3', ['-c', 'import numpy, librosa; print(librosa.__version__)']);
py ? ok('librosa ' + py.trim() + ' (for measuring supplied tracks)') : meh('librosa not installed — only needed to measure a supplied track (tools/beats.py)', 'pip3 install numpy librosa soundfile');

console.log(`\n${fail ? `✖ ${fail} blocking issue(s)` : '✔ studio ready'}${warn ? `, ${warn} optional` : ''}  ·  ${os.cpus().length} CPU cores → render uses ${Math.max(1, Math.min(4, os.cpus().length - 1))} workers`);
process.exit(fail ? 1 : 0);
