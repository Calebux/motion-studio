#!/usr/bin/env node
// serve.mjs — live preview with a scrubber, beat ticks and music. Space = play/pause, ←/→ = frame step.
//   node tools/serve.mjs [--port 5173] [--size 1080x1080]
import { serve } from './lib/server.mjs';
import { parseArgs, num } from './lib/args.mjs';
const a = parseArgs();
const { url } = await serve(process.cwd(), num(a.port, 5173));
console.log(`▶ preview: ${url}/index.html${a.size ? '?size=' + a.size : ''}\n  (Ctrl+C to stop. Reload after editing film.js.)`);
