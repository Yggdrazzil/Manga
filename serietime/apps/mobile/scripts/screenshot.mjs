import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const OUT = process.argv[2] ?? '/tmp/claude-0/-home-user-Manga/47acde2a-546c-53c0-b344-85c5cc030cf9/scratchpad/shots';
mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:4173';

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();

async function shot(name) {
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log('shot', name);
}

// Login
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
const pwd = page.locator('#password');
if (await pwd.count()) {
  await pwd.fill('demo1234');
  await page.getByRole('button', { name: /Se connecter|Créer le compte/ }).click();
  await page.waitForTimeout(1200);
}

const routes = [
  ['/shows', 'shows-a-voir'],
  ['/movies', 'movies'],
  ['/explore', 'explore'],
  ['/profile', 'profile'],
  ['/settings', 'settings'],
];
for (const [route, name] of routes) {
  await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
  await shot(name);
}

// Séries À venir tab
await page.goto(`${BASE}/shows`, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
await page.getByRole('tab', { name: 'À VENIR' }).click();
await shot('shows-a-venir');

// Import screen
await page.goto(`${BASE}/settings/import-tvtime`, { waitUntil: 'networkidle' });
await shot('import');

// Profile shows / movies
await page.goto(`${BASE}/profile/movies`, { waitUntil: 'networkidle' });
await shot('profile-movies');

await browser.close();
console.log('done');
