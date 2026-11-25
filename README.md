# Antagning.se Course Timeline

A Chrome/Edge (Manifest V3) extension that keeps a visual course timeline and weekly study-load summary visible while you move between Antagning.se search results, **Mina val**, and other pages.

## Install or reload

1. Open `chrome://extensions` (Chrome) or `edge://extensions` (Edge).
2. Enable **Developer mode** and click **Load unpacked**, selecting this repository folder.
3. If the extension is already installed from this folder, click **Reload**.
4. Refresh any open `antagning.se` tabs.

Click the **Kurstidslinje** bar directly below the site header to expand or collapse the timeline (press `Escape` while expanded to collapse). The bar stays pinned under the header as you scroll. Your expanded/collapsed preference and selected courses are stored per browser origin in `localStorage`.

## Behavior

- **Current & legacy Antagning.se support**: Reads confirmed selections from Antagning.se's current Angular components (`utsokt-button-contained` / `utsokt-button-outlined`) as well as legacy `button.toggleselection` controls. Ignores favourite toggle buttons (`utsokt-button-favourite`), info popovers, and pending spinner states (`ispending`).
- **Event-driven synchronization**: Uses `MutationObserver` and browser navigation events (`popstate`, `hashchange`, `pageshow`, `focus`, `navigatesuccess`) with no polling timers or per-card event listeners.
- **Persistent across pages & tabs**: Keeps off-page selections across searches, filter changes, route transitions, and reloads, and synchronizes open tabs via `storage` events.
- **Safe reconciliation on Mina val**: Removes a course immediately when its card explicitly changes to unselected. On `/my/selections`, stale cached entries are pruned only once the list finishes loading and its selected-card count matches the page tab counter (or the explicit `.mina-val-emptystate` is shown).
- **Term-scoped identities**: Identifies courses by `<TERM><YEAR>:<APPLICATION_CODE>` so identical application codes in different terms do not collide.
- **Self-healing panel**: Restores the panel automatically if the site replaces DOM nodes and guards against duplicate script injection.

## Timeline & study load estimates

- Explicit **Startvecka** and **Slutvecka** take priority. Otherwise, **Startperiod** and credits/study pace estimate the course schedule, and estimated rows are labeled **uppskattat**.
- Supports both `hp` (*högskolepoäng*) and `fup` (*förutbildningspoäng*), as well as intensive courses over 100% pace.
- Default overview windows: spring (`VT`) weeks 3–22, summer (`ST`) weeks 23–35, and autumn (`HT`) 20 weeks starting week 36 (wrapping into the following year; courses starting in weeks 34–35 stay in the current autumn term).
- Full-time study pace (`100 %`) corresponds to `1.5 hp/week`. Overlapping weeks above `100 %` and term totals above `45 hp` are highlighted; courses extending outside the term window display striped boundaries.
- Use **Rensa cache** inside the panel to clear saved off-page courses and re-read the current page.

## Files

- `manifest.json`: Manifest V3 extension definition (no extra permissions requested).
- `timeline.js`: Course metadata parsing, validated `localStorage` persistence, synchronization, and timeline/load rendering.
- `timeline.css`: Scoped styles for the bottom drawer panel.
- `icons/` & `icon.svg`: Extension icons (`16x16`, `48x48`, `128x128`).
- `test_dom.js`: Automated `node:test` + `jsdom` regression suite.
- `antagning.html`: Real saved Antagning.se search page HTML fixture used by tests.
- `test_comprehensive.html`: Interactive local demonstration page.

## Development & testing

Run the automated test suite with Node.js 18 or newer:

```sh
npm install
npm test
```

To inspect the interactive demonstration locally, serve this directory over HTTP (for example `npx serve .` or `python -m http.server`) and open `test_comprehensive.html`.
