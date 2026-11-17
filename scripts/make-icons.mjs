// Renders public/icons/favicon.svg to the PNG sizes the manifest needs.
// Uses the Playwright/Chromium that is available in the dev environment.
import { createRequire } from 'node:module';

// resolve Playwright from the project or a global install (CommonJS resolution honours NODE_PATH)
const { chromium } = createRequire(import.meta.url)('playwright');
import { readFileSync } from 'node:fs';

const svg = readFileSync(new URL('../public/icons/favicon.svg', import.meta.url), 'utf8');
const out = (name) => new URL(`../public/icons/${name}`, import.meta.url).pathname;

const targets = [
  { name: 'icon-192.png', size: 192, pad: 0 },
  { name: 'icon-512.png', size: 512, pad: 0 },
  { name: 'apple-touch-icon.png', size: 180, pad: 0 },
  // maskable: keep the artwork inside the 80% safe zone
  { name: 'icon-maskable-512.png', size: 512, pad: 0.12 }
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const t of targets) {
  await page.setViewportSize({ width: t.size, height: t.size });
  const inner = Math.round(t.size * (1 - t.pad * 2));
  await page.setContent(
    `<body style="margin:0;background:#0a0a12;display:grid;place-items:center;width:${t.size}px;height:${t.size}px">
       <div style="width:${inner}px;height:${inner}px">${svg.replace('<svg ', '<svg width="100%" height="100%" ')}</div>
     </body>`
  );
  await page.screenshot({ path: out(t.name), omitBackground: false });
  console.log('wrote', t.name);
}
await browser.close();
