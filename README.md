# Antagning.se Course Timeline

A Chrome/Edge extension that keeps a course timeline visible while you move between Antagning.se search results, Mina val, and other pages.

## Install or reload

1. Open `chrome://extensions` (Chrome) or `edge://extensions` (Edge).
2. Enable Developer mode and use **Load unpacked** to select this folder.
3. If the extension is already installed from this folder, click its **Reload** button.
4. Refresh any Antagning.se tabs that were already open.

The **Kurstidslinje** button at the bottom of the page opens the panel. Your expanded/collapsed preference is saved.

## Behavior

- Reads confirmed selections from the site's Add/Remove controls, including the current Angular components and older toggle buttons.
- Reacts to DOM and navigation events; no polling timer or per-card event listeners.
- Keeps off-page courses during searches, filters, route changes, and refreshes.
- Removes a course when its card explicitly becomes unselected. A complete Mina val list can remove stale cached courses only when its selected-card count matches the site's count. The site's explicit empty state confirms an empty list; an initial empty loading list does not.
- Uses the term plus application code as the identity, so the same code in different terms does not collide.
- Restores the panel if the site replaces it and prevents duplicate startup.
- Validates saved records and accepts the previous grouped storage format.
- Saves course metadata in this browser's local storage for the current website origin. Browser storage events update other open tabs; this extension does not fetch the user's account or courses that have never been displayed.

## Timeline estimates

Explicit Startvecka and Slutvecka take priority. Otherwise, start period and credits/study pace estimate the schedule. Estimated rows are labeled **uppskattat**. Full time is modeled as 1.5 hp/week. Default overview boundaries are approximate: spring weeks 3–22, summer weeks 23–35, and autumn 20 weeks from week 36, continuing into the next year. Actual course weeks are shown in each row and its tooltip; courses continuing past the overview have a striped ending.

Unknown terms or insufficient schedule information are skipped instead of assigned an invented term.

## Development

- `manifest.json`: content-script registration; no extra extension permissions.
- `timeline.js`: course parsing, validated persistence, synchronization, and rendering.
- `timeline.css`: styles scoped to the panel.
- `test_dom.js`: automated DOM/navigation regression checks.
- `test_comprehensive.html`: interactive local demonstration.

Run the tests with Node.js 18 or newer:

```sh
npm install
npm test
```

To open the local demonstration with working navigation and storage, serve this directory with a local HTTP server and open `test_comprehensive.html`. No browser extension is required for the demonstration.
