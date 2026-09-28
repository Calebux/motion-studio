#!/usr/bin/env python3
"""beats.py — measure a supplied track so the picture can lock to it.

    python3 tools/beats.py audio/track.wav            → beats.json
    python3 tools/beats.py audio/track.mp3 --out beats.json --offset 0

Writes { bpm, spb, duration, beats, downbeats, hits: { onset: [...] }, sections: [], source: 'measured' }.
Needs: pip install numpy librosa soundfile
"""
import sys, json, argparse

try:
    import numpy as np
    import librosa
except ImportError:
    sys.exit("✖ librosa not installed. Run: pip install numpy librosa soundfile\n"
             "  (Or skip measuring: synthesize a score with tools/music.mjs, which writes exact beats.)")

ap = argparse.ArgumentParser()
ap.add_argument("track")
ap.add_argument("--out", default="beats.json")
ap.add_argument("--offset", type=float, default=0.0, help="seconds to shift every time (if the film starts later in the track)")
ap.add_argument("--beats-per-bar", type=int, default=4)
args = ap.parse_args()

y, sr = librosa.load(args.track, sr=None, mono=True)
tempo, frames = librosa.beat.beat_track(y=y, sr=sr, units="frames")
bpm = float(np.atleast_1d(tempo)[0])
beats = librosa.frames_to_time(frames, sr=sr)

# Downbeat guess: pick the beat phase (0..3) with the strongest low-frequency onsets.
onset_env = librosa.onset.onset_strength(y=y, sr=sr, fmax=200)
strength = onset_env[np.clip(frames, 0, len(onset_env) - 1)]
bpb = args.beats_per_bar
phase = int(np.argmax([strength[p::bpb].mean() if len(strength[p::bpb]) else 0 for p in range(bpb)]))
downbeats = beats[phase::bpb]

onset = librosa.onset.onset_strength(y=y, sr=sr)
peaks = librosa.util.peak_pick(onset, pre_max=3, post_max=3, pre_avg=3, post_avg=5, delta=0.5, wait=10)
hits = librosa.frames_to_time(peaks, sr=sr)

shift = lambda arr: [round(float(t) - args.offset, 4) for t in arr if float(t) - args.offset >= 0]
out = {
    "bpm": round(bpm, 3), "spb": round(60 / bpm, 5), "duration": round(len(y) / sr - args.offset, 3),
    "beats": shift(beats), "downbeats": shift(downbeats),
    "hits": {"onset": shift(hits)}, "sections": [], "source": "measured",
}
json.dump(out, open(args.out, "w"), indent=1)
print(f"✔ {args.out}  ({bpm:.1f} BPM, {len(out['beats'])} beats, {len(out['downbeats'])} downbeats, {len(out['hits']['onset'])} onsets)")
print("  Check the grid by ear: start the film on a downbeat; if the downbeat guess is off, pass --offset.")
