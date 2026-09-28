// ffmpeg helpers.
import { spawn, spawnSync } from 'node:child_process';

export function ffmpeg(args, { quiet = true } = {}) {
  return new Promise((ok, fail) => {
    const p = spawn('ffmpeg', ['-hide_banner', '-loglevel', quiet ? 'error' : 'info', '-y', ...args], { stdio: ['ignore', 'inherit', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => (err += d));
    p.on('close', (c) => (c === 0 ? ok(err) : fail(new Error(`ffmpeg failed (${c}):\n${err.slice(-2000)}`))));
  });
}
// Run ffmpeg and capture stderr (for filters that print stats).
export function ffmpegStats(args) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-y', ...args], { encoding: 'utf8', maxBuffer: 1 << 28 });
  return r.stderr || '';
}
export function probeDuration(file) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' });
  return Number(r.stdout.trim());
}
