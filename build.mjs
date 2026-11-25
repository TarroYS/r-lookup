// Builds the R-lookup bookmarks (each one a small page stored inside the bookmark, as a data: URL)
// and the team setup page, which also lists the matching Chrome site-search shortcuts.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const VERSION = 'Version 4 · November 2026';
const DIGITS = 5;
const EXAMPLE = '85791';
const GREEN = 'rgb(21,128,61)';
const VIOLET = 'rgb(109,40,217)';
const GD = 'https://greendot.prod.letsdowonders.io/greendot/';
const DESTS = [
  { id: 'aui', label: 'AUI', key: 'aui', system: 'Greendot', what: 'Agent UI', base: GD + 'restaurant/', color: GREEN },
  { id: 'wsheet', label: 'Wsheet', key: 'ws', system: 'Greendot', what: "The restaurant's Wsheet", base: GD + 'wsheets/', color: GREEN },
  { id: 'wira', label: 'Wira', key: 'wr', system: 'Greendot', what: "The restaurant's page in Wira", base: GD + 'wira/restaurants/', color: GREEN },
  { id: 'pospreview', label: 'POS Preview', key: 'pp', system: 'Greendot', what: 'POS preview (APAC server)', base: 'https://greendot.apac.prod.letsdowonders.io/internal/restaurant-preview?platform1=rpos&r=', color: GREEN },
  { id: 'tma', label: 'TMA', key: 'tma', system: 'Tarro Manager', what: 'Tarro Manager, with that restaurant selected (Home)', base: 'https://app.wondersco.com/?rNumber=', color: VIOLET },
];

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const launcher = read('./src/launcher.html');

for (const d of DESTS) {
  d.title = `${d.label} · ${d.system}`;
  d.page = launcher
    .replaceAll('{{LABEL}}', esc(d.label))
    .replaceAll('{{TITLE}}', esc(d.title))
    .replaceAll('{{COLOR}}', d.color)
    .replaceAll('{{DIGITS}}', String(DIGITS))
    .replace('{{BASE_JSON}}', JSON.stringify(d.base));
  if (d.page.includes('{{')) throw new Error(`${d.label}: unfilled placeholder`);
  // base64 keeps the bookmark address free of characters a URL would treat specially (#, %, &, spaces).
  d.code = 'data:text/html;base64,' + Buffer.from(d.page, 'utf8').toString('base64');
  d.siteSearch = d.base + 'R%s';
  d.example = d.base + 'R' + EXAMPLE;
}

const dot = (d) => `<span class="dot" style="background:${d.color}"></span>`;
const pill = (d) => `<a class="bm" href="${esc(d.code)}" data-id="${d.id}" draggable="true">${dot(d)}${esc(d.label)}</a>`;
const systems = [...new Set(DESTS.map((d) => d.system))];
const bar = systems
  .map((s) => [`<span class="group">${esc(s)}</span>`, ...DESTS.filter((d) => d.system === s).map(pill)].join('\n        '))
  .join('\n        <span class="sep" aria-hidden="true"></span>\n        ');
const opens = DESTS.map((d) => `
        <div class="op" data-id="${d.id}"><div class="op-head"><b>${dot(d)}${esc(d.label)}</b><span class="muted">${esc(d.what)}</span></div><code>${esc(d.example)}</code></div>`).join('');
const siteSearchRows = DESTS.map((d) => `
        <div class="ss-row">
          <div class="ss-name">${dot(d)}${esc(d.label)}</div>
          <div class="ss-key">Shortcut <kbd>${esc(d.key)}</kbd></div>
          <div class="field"><input id="ss-${d.id}" readonly value="${esc(d.siteSearch)}" aria-label="${esc(d.label)} site search URL"><button class="copy" type="button" data-for="ss-${d.id}">Copy</button></div>
        </div>`).join('');
const copyRows = DESTS.map((d) => `
      <div class="code-row">
        <div class="code-head">${dot(d)}<b>${esc(d.label)}</b><span class="muted">${esc(d.what)}</span><button class="copy" type="button" data-for="code-${d.id}">Copy</button></div>
        <textarea id="code-${d.id}" readonly rows="2" spellcheck="false" aria-label="${esc(d.label)} bookmark">${esc(d.code)}</textarea>
      </div>`).join('');

const page = read('./src/install-page.html')
  .replace('<!--BAR-->', bar)
  .replace('<!--OPENS-->', opens)
  .replace('<!--SITE_SEARCH-->', siteSearchRows)
  .replace('<!--COPY_ROWS-->', copyRows)
  .replace('<!--VERSION-->', esc(VERSION));
if (/<!--[A-Z_]+-->/.test(page)) throw new Error('install page: unfilled placeholder');

mkdirSync(new URL('./dist/', import.meta.url), { recursive: true });
writeFileSync(new URL('./index.html', import.meta.url), page);
writeFileSync(new URL('./dist/launchers.json', import.meta.url), JSON.stringify(DESTS, null, 2));
for (const d of DESTS) console.log(`${d.label.padEnd(12)} bookmark ${d.code.length} chars   ${d.key.padEnd(4)} ${d.siteSearch}`);
console.log(`setup page: ${page.length} chars`);
