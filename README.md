# R lookup

Open a restaurant by its R number from Chrome: click a bookmark, type the 5 digits, and the page opens. Works from any tab, even a blank new one. No Enter needed.

**Setup page:** https://tarroys.github.io/r-lookup/ — open it in Chrome and follow the steps (drag the bookmarks onto your bookmarks bar).

| Bookmark | Opens | Address-bar shortcut |
|---|---|---|
| AUI | Greendot Agent UI | `aui` |
| Wsheet | The restaurant's Wsheet | `ws` |
| Wira | The restaurant's page in Wira | `wr` |
| POS Preview | POS preview (APAC server) | `pp` |
| TMA | Tarro Manager with that restaurant selected (Home) | `tma` |

## How it works

Each bookmark is a small page stored inside the bookmark itself (a `data:` URL). Chrome opens such a page from a bookmark on any tab, including New Tab, while script bookmarklets (`javascript:`) can't run on Chrome's own pages. The page shows a box with **R** already filled in; after 5 digits it replaces itself with the restaurant's page, so Back skips it. Esc goes back (or closes the tab if it opened in a new one). Pasting a link or text like `NEW CHINA (R82788)` picks out the R number.

The address-bar shortcuts are Chrome's built-in site search: `chrome://settings/searchEngines` → Site search → Add, with the URLs listed on the setup page.

TMA uses Tarro Manager's own `?rNumber=` switch, which selects that restaurant the same way as picking it in the Restaurants list.

## Changing or adding a bookmark

1. Edit `DESTS` in `build.mjs`: name, address-bar shortcut, and the address up to where the R number goes.
2. Run `node build.mjs`. It rebuilds `index.html`.
3. Optional checks: `npm install`, then `CHROME_PATH=/path/to/chrome npm test` (Playwright in real Chrome; every web request is answered locally, nothing is sent to the real sites).
4. Commit and push. GitHub Pages republishes in about a minute. Teammates update by deleting the old bookmark and dragging the new one.

Typing opens the page at exactly 5 digits (`DIGITS` in `build.mjs`). If R numbers reach 6 digits, change it and rebuild; pasting works in the meantime.

## Files

- `index.html` — the setup page (built by `build.mjs`, served by GitHub Pages)
- `src/launcher.html` — the box page stored inside each bookmark
- `src/install-page.html` — template for the setup page
- `build.mjs` — builds the bookmarks and `index.html`
- `test.mjs` — end-to-end checks in Chrome
