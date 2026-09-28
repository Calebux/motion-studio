// WAV read/write helpers (16-bit PCM, mono or stereo).
import { writeFileSync, readFileSync } from 'node:fs';

export function writeWav(path, channels, sr = 48000) {
  const n = channels[0].length, ch = channels.length;
  const b = Buffer.alloc(44 + n * 2 * ch);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2 * ch, 4); b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(ch, 22);
  b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2 * ch, 28); b.writeUInt16LE(2 * ch, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(n * 2 * ch, 40);
  let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) {
    b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, channels[c][i])) * 32767), o); o += 2;
  }
  writeFileSync(path, b);
}

export function readWav(path) {
  const b = readFileSync(path);
  let o = 12, fmt, data;
  while (o < b.length) {
    const id = b.toString('ascii', o, o + 4), size = b.readUInt32LE(o + 4);
    if (id === 'fmt ') fmt = { ch: b.readUInt16LE(o + 10), sr: b.readUInt32LE(o + 12), bits: b.readUInt16LE(o + 22) };
    if (id === 'data') data = { off: o + 8, size };
    o += 8 + size + (size % 2);
  }
  if (!fmt || !data || fmt.bits !== 16) throw new Error('Only 16-bit PCM WAV supported: ' + path);
  const n = data.size / 2 / fmt.ch, chans = Array.from({ length: fmt.ch }, () => new Float32Array(n));
  for (let i = 0; i < n; i++) for (let c = 0; c < fmt.ch; c++) chans[c][i] = b.readInt16LE(data.off + (i * fmt.ch + c) * 2) / 32768;
  return { sr: fmt.sr, channels: chans };
}
