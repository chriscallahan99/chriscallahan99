/* Render promo/index.html to video, frame by frame.

   Usage (from repo root, with a static server running on :8765):
     python3 -m http.server 8765 &
     node scripts/render_promo.js [landscape|portrait] [out.webm]

   Needs the `playwright` npm package and an ffmpeg with libvpx
   (set FFMPEG=/path/to/ffmpeg if it isn't on PATH). */

const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { chromium } = require('playwright');

const FPS = 30;
const SIZES = {
  landscape: { width: 1280, height: 720, scale: 1.5 }, // 1920x1080
  portrait: { width: 540, height: 960, scale: 2 },     // 1080x1920
};

const shape = process.argv[2] || 'landscape';
const out = process.argv[3] || `priced-promo-${shape}.webm`;
const size = SIZES[shape];
if (!size) throw new Error(`Unknown shape "${shape}" (use landscape or portrait)`);

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: size.width, height: size.height },
    deviceScaleFactor: size.scale,
  });
  await page.goto('http://localhost:8765/promo/?capture');
  await page.evaluate(() => window.promo.ready);
  const duration = await page.evaluate(() => window.promo.DURATION);

  // Frames go into one concatenated MJPEG file (works even with minimal
  // ffmpeg builds that lack the pipe: protocol), then get encoded to VP8.
  const tmp = path.join(os.tmpdir(), `priced-promo-${process.pid}.mjpeg`);
  const fd = fs.openSync(tmp, 'w');
  const frames = Math.round((duration / 1000) * FPS);
  for (let f = 0; f < frames; f++) {
    await page.evaluate((t) => window.promo.render(t), (f * 1000) / FPS);
    fs.writeSync(fd, await page.screenshot({ type: 'jpeg', quality: 95 }));
  }
  fs.closeSync(fd);

  const result = spawnSync(process.env.FFMPEG || 'ffmpeg', [
    '-y', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', 'file:' + tmp,
    '-c:v', 'libvpx', '-b:v', '12M', '-crf', '4', '-deadline', 'good', '-cpu-used', '1',
    '-auto-alt-ref', '0', out,
  ], { stdio: 'inherit' });
  fs.unlinkSync(tmp);
  if (result.status !== 0) throw new Error(`ffmpeg exited ${result.status}`);
  await browser.close();
  console.log(`wrote ${out} (${frames} frames, ${size.width * size.scale}x${size.height * size.scale})`);
})();
