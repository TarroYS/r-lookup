// Version 3 checks in real Chrome. Every web request is answered locally (stub pages), so nothing leaves the machine.
// page.goto() is a browser-initiated navigation, the same kind as clicking a bookmark.

import { readFileSync, mkdirSync } from 'node:fs';


import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';

const D = JSON.parse(readFileSync(new URL('./dist/launchers.json', import.meta.url), 'utf8'));
const by = Object.fromEntries(D.map((d) => [d.id, d]));
const INSTALL = new URL('./index.html', import.meta.url).href;
const SHOTS = fileURLToPath(new URL('./shots/', import.meta.url));
mkdirSync(SHOTS, { recursive: true });

const lines = [];
let fails = 0;
const ok = (name, cond, extra = '') => {
  if (!cond) fails++;
  lines.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  [' + extra + ']' : ''}`);
};

const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await context.route('**/*', async (route) => {
  const url = route.request().url();
  if (url.startsWith('file:') || url.startsWith('data:')) return route.continue();
  if (/fonts\.g/.test(url)) return route.abort();
  await route.fulfill({ status: 200, contentType: 'text/html', body: `<!doctype html><title>stub</title><h1>Stub page</h1><p>${url}</p>` });
});
const page = await context.newPage();
const errors = [];
const watch = (p) => {
  p.on('pageerror', (e) => errors.push(String(e)));
  p.on('console', (m) => { if (m.type() === 'error' && !/fonts|ERR_FAILED|Not allowed to navigate top frame/.test(m.text())) errors.push(m.text()); });
};
watch(page);
const waitFor = (p, url) => p.waitForURL((u) => u.href === url, { timeout: 4000 }).catch(() => {});
const focusedBox = (p) => p.evaluate(() => document.activeElement && document.activeElement.id === 'n');
const PREV = 'https://example.test/previous-page';

// 1. Install page carries exactly the built bookmarks and site-search addresses.
await page.goto(INSTALL);
const pills = await page.$$eval('a.bm', (as) => as.map((a) => ({ id: a.dataset.id, text: a.textContent.trim(), href: a.href, title: a.getAttribute('title') })));
ok('install page: 5 bookmarks', pills.length === 5);
for (const p of pills) {
  const d = by[p.id];
  ok(`install page: "${d.label}" name = link text; dragged address = the built page`, p.text === d.label && p.title === null && p.href === d.code);
}
const boxes = await page.$$eval('textarea, input[readonly]', (els) => Object.fromEntries(els.map((e) => [e.id, e.value])));
ok('install page: copy boxes hold the same bookmarks', D.every((d) => boxes['code-' + d.id] === d.code));
ok('install page: site-search URLs listed', D.every((d) => boxes['ss-' + d.id] === d.siteSearch) && boxes['ss-settings'] === 'chrome://settings/searchEngines');
ok('site search: typing 82788 after the shortcut gives the same address as the bookmark', D.every((d) => d.siteSearch.replace('%s', '82788') === d.base + 'R82788'));
const examples = await page.$$eval('.op', (els) => Object.fromEntries(els.map((e) => [e.dataset.id, e.querySelector('code').textContent])));
ok('install page: "What each bookmark opens" examples match the bookmarks', D.every((d) => examples[d.id] === d.base + 'R85791'), JSON.stringify(examples.pospreview));
const names = pills.map((p) => p.text).join(', ');
ok('install page: bookmarks are AUI, Wsheet, Wira, POS Preview, TMA', names === 'AUI, Wsheet, Wira, POS Preview, TMA', names);

// 2. Install page preview: clicking a bookmark shows the same page in the drawn browser; 5 digits show where it would go.
await page.click('a.bm[data-id="wsheet"]');
const frame = page.frameLocator('iframe.demo');
await frame.locator('#n').waitFor();
await page.screenshot({ path: SHOTS + 'v4-install-preview.png' });
await frame.locator('#n').pressSequentially('82788');
await page.waitForTimeout(200);
ok('preview: shows where it would go, install page stays', (await page.textContent('#result code')) === by.wsheet.base + 'R82788' && page.url() === INSTALL && (await page.locator('iframe.demo').count()) === 0);
await page.click('a.bm[data-id="aui"]');
await frame.locator('#n').waitFor();
await frame.locator('#n').press('Escape');
await page.waitForTimeout(150);
ok('preview: Esc closes it', (await page.locator('iframe.demo').count()) === 0 && page.url() === INSTALL);
await page.screenshot({ path: SHOTS + 'v4-install-after.png' });

// 3. Each bookmark, opened the way Chrome opens a bookmark, from a previous page.
for (const d of D) {
  await page.goto(PREV);
  await page.goto(d.code);
  const t = await page.title();
  const focused = await focusedBox(page);
  await page.keyboard.type('8278');
  await page.waitForTimeout(200);
  const waited = page.url().startsWith('data:');
  await page.keyboard.type('8');
  await waitFor(page, d.base + 'R82788');
  const opened = page.url() === d.base + 'R82788';
  await page.goBack();
  ok(`${d.label}: tab title, cursor in box, waits at 4, opens at 5, Back skips the box`, t === `${d.label} · R lookup` && focused && waited && opened && page.url() === PREV, `${t} | ${page.url()}`);
}

// 4. Paste, letters, Enter on a short number, clicks elsewhere.
await page.goto(PREV);
await page.goto(by.tma.code);
await page.keyboard.insertText('*NEW CHINA* (R82788)');
await waitFor(page, by.tma.base + 'R82788');
ok('paste: "*NEW CHINA* (R82788)" opens R82788', page.url() === by.tma.base + 'R82788', page.url());

await page.goto(by.wsheet.code);
await page.evaluate(() => {
  const n = document.getElementById('n');
  n.value = 'https://greendot.prod.letsdowonders.io/greendot/restaurant/R123456';
  n.dispatchEvent(new InputEvent('input', { inputType: 'insertFromPaste', bubbles: true }));
});
await waitFor(page, by.wsheet.base + 'R123456');
ok('paste: a link with a 6-digit R number opens it whole', page.url() === by.wsheet.base + 'R123456', page.url());

await page.goto(by.wira.code);
await page.keyboard.type('r82a7');
const cleaned = await page.inputValue('#n');
await page.keyboard.press('Enter');
await waitFor(page, by.wira.base + 'R827');
ok('letters are dropped as you type; Enter opens a short number', cleaned === '827' && page.url() === by.wira.base + 'R827', `${cleaned} ${page.url()}`);

await page.goto(by.aui.code);
await page.mouse.click(40, 700);
ok('clicking elsewhere on the page keeps the cursor in the box', await focusedBox(page));
await page.screenshot({ path: SHOTS + 'v4-box-light.png' });

// 5. Esc: back to where you were; in a tab of its own, it closes the tab.
await page.goto(PREV);
await page.goto(by.aui.code);
await page.keyboard.press('Escape');
await page.waitForURL(PREV, { timeout: 3000 }).catch(() => {});
ok('Esc takes you back to the previous page', page.url() === PREV, page.url());

// Open a tab directly at the bookmark, as Cmd+Shift+click does (a plain new test tab would start with a blank page in its history).
const { targetInfo } = await (await context.newCDPSession(page)).send('Target.getTargetInfo');
const soloPage = context.waitForEvent('page');
await (await browser.newBrowserCDPSession()).send('Target.createTarget', { url: by.aui.code, browserContextId: targetInfo.browserContextId });
const solo = await soloPage;
watch(solo);
await solo.waitForLoadState();
const soloInfo = await solo.evaluate(() => ({ len: history.length, focused: document.activeElement?.id === 'n' }));
const closed = solo.waitForEvent('close', { timeout: 3000 }).then(() => true).catch(() => false);
await solo.keyboard.press('Escape').catch(() => {}); // the tab closes before the key comes back up
ok('opened in a tab of its own: cursor in box, Esc closes that tab', soloInfo.len === 1 && soloInfo.focused && (await closed), JSON.stringify(soloInfo));

// 6. Why the install page shows a preview: a website can't open these pages itself.
await page.goto(PREV);
await page.evaluate((u) => { location.href = u; }, by.aui.code);
await page.waitForTimeout(500);
ok('a website opening one of these pages is blocked by Chrome (bookmarks are not)', page.url() === PREV);

ok('no script errors', errors.length === 0, errors.join(' | '));

// Screenshots: dark box, install page light/dark/phone.
const dark = await browser.newContext({ viewport: { width: 1000, height: 640 }, colorScheme: 'dark' });
const dp = await dark.newPage();
await dp.goto(by.tma.code);
await dp.keyboard.type('827');
await dp.screenshot({ path: SHOTS + 'v4-box-dark.png' });
await dark.close();
const shot = async (opts, path) => {
  const ctx = await browser.newContext(opts);
  await ctx.route(/fonts\.g/, (r) => r.abort());
  const p = await ctx.newPage();
  await p.goto(INSTALL);
  await p.screenshot({ path: SHOTS + path, fullPage: true });
  return { ctx, p };
};
await (await shot({ viewport: { width: 1280, height: 900 } }, 'v4-install-light.png')).ctx.close();
await (await shot({ viewport: { width: 1280, height: 900 }, colorScheme: 'dark' }, 'v4-install-dark.png')).ctx.close();
const phone = await shot({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, 'v4-install-phone.png');
await phone.p.tap('a.bm[data-id="aui"]');
await phone.p.frameLocator('iframe.demo').locator('#n').waitFor();
await phone.p.screenshot({ path: SHOTS + 'v4-install-phone-preview.png' });
await phone.ctx.close();

await browser.close();
console.log(lines.join('\n'));
console.log(`\n${fails === 0 ? 'ALL PASS' : fails + ' FAILURE(S)'} (${lines.length} checks)`);
