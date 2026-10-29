const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');
const source = fs.readFileSync(`${__dirname}/timeline.js`, 'utf8');
const STORAGE = 'antagningCourseTimelineData';
const PANEL = '#course-timelines-container';

function card({ code = 'KAU-49454', term = 'Våren 2027', name = '1700-talslitteratur', selected = true,
    hp = '7,5', pace = '25 %', start = 3, end = 22, legacy = false, disabled = false } = {}) {
    const action = legacy
        ? `<button class="toggleselection contained-button" data-id="VT2027-${code}">
            <span class="expand-text ${selected ? 'hide' : ''}">Lägg till</span>
            <span class="contract-text ${selected ? '' : 'hide'}">Ta bort</span></button>`
        : `<utsokt-button-${selected ? 'outlined class="remove-button extra-wide"' : 'contained class="extra-wide"'}>
            <button class="button-component ${selected ? 'outlined-button' : 'contained-button'}" ${disabled ? 'disabled' : ''}>
                <span class="button-text">${selected ? 'Ta bort' : 'Lägg till'}<span class="sr-only"> ${name}</span></span>
            </button></utsokt-button-${selected ? 'outlined' : 'contained'}>`;
    return `<div class="searchresultcard"><h3 class="headline4">${name}</h3>
        <div class="education-block-tags">Kurs ${hp} hp Studietakt ${pace}</div>
        <div class="card-more-info" style="display:none"><p>Förkunskapskrav: 90 hp och 100 % närvaro.</p>
            <div><span class="subtitle">Startperiod: </span>${term} Period 1</div>
            ${start === null ? '' : `<div><span class="subtitle">Startvecka: </span>Vecka ${start}</div>`}
            ${end === null ? '' : `<div><span class="subtitle">Slutvecka: </span>Vecka ${end}</div>`}
            <div><span class="subtitle">Anmälningskod: </span>${code}</div>
            <div><span class="subtitle">Omfattning: </span>${hp} högskolepoäng</div>
            <div><span class="subtitle">Studietakt: </span>${pace}</div>
        </div><button class="contained-button">Läs mer</button>${action}</div>`;
}

function selections(cards = '', count = 0) {
    return `<a class="selectionstab" aria-current="page" href="/se/my/selections">Mina val <span class="dynamic-content">(${count})</span></a>
        <section class="selections-page"><ul class="selection-cards">${cards}</ul></section>`;
}

async function page(t, html = '', cache, url = 'https://www.antagning.se/se/search') {
    const dom = new JSDOM(`<!doctype html><html><head><style>.hide {display:none}</style></head><body><main>${html}</main></body></html>`,
        { url, runScripts: 'outside-only', pretendToBeVisual: true });
    t.after(() => dom.window.close());
    if (cache !== undefined) dom.window.localStorage.setItem(STORAGE, typeof cache === 'string' ? cache : JSON.stringify(cache));
    dom.window.eval(source);
    await new Promise(resolve => dom.window.setTimeout(resolve, 0));
    return dom.window;
}

const rows = w => [...w.document.querySelectorAll(`${PANEL} [data-course-id]`)];
const ids = w => rows(w).map(row => row.dataset.courseId);
const main = w => w.document.querySelector('main');
async function until(check) {
    const deadline = Date.now() + 3000;
    for (;;) {
        try { check(); return; } catch (error) {
            if (Date.now() > deadline) throw error;
            await new Promise(resolve => setTimeout(resolve, 20));
        }
    }
}
const storedCourse = (code = 'KAU-49454', termKey = 'VT2027') => ({ id: `${termKey}:${code}`, code, termKey,
    name: 'Saved course', hp: 7.5, studietakt: 25, startWeek: 3, endWeek: 22, durationWeeks: 20, estimated: false });
const cached = (...courses) => ({ version: 2, courses });

 test('current remove component seeds a selected card without a button id', async t => {
    const w = await page(t, card());
    assert.deepEqual(ids(w), ['VT2027:KAU-49454']);
    assert.match(w.document.querySelector('.timeline-term-header').textContent, /7,5 hp/);
    assert.match(w.document.querySelector('.timeline-load-heading').textContent, /25 %/);
    assert.doesNotMatch(rows(w)[0].title, /uppskattat/);
});

test('selections survive search filters, other pages, back/forward, and full reload', async t => {
    const w = await page(t, card());
    main(w).innerHTML = card({ code: 'UU-05025', selected: false });
    w.history.pushState({}, '', '/se/search?query=another');
    await until(() => assert.equal(rows(w).length, 1));
    w.history.pushState({}, '', '/se/my/favourites');
    main(w).replaceChildren();
    w.dispatchEvent(new w.PopStateEvent('popstate'));
    const restored = await page(t, '', w.localStorage.getItem(STORAGE), 'https://www.antagning.se/se/start');
    assert.deepEqual(ids(restored), ['VT2027:KAU-49454']);
});

test('a route transition and incomplete Mina val list never erase the cache', async t => {
    const w = await page(t, '', cached(storedCourse()));
    w.history.pushState({}, '', '/se/my/selections');
    main(w).innerHTML = '<section class="selections-page">Loading...</section>';
    w.dispatchEvent(new w.PopStateEvent('popstate'));
    await new Promise(resolve => setTimeout(resolve, 150));
    assert.equal(rows(w).length, 1);
    main(w).innerHTML = selections('', 1);
    await new Promise(resolve => setTimeout(resolve, 150));
    assert.equal(rows(w).length, 1);
    main(w).innerHTML = selections(card(), 1);
    await until(() => assert.deepEqual(ids(w), ['VT2027:KAU-49454']));
});

test('fully rendered Mina val removes stale courses only when its count agrees', async t => {
    const w = await page(t, selections(card(), 1), cached(storedCourse(), storedCourse('STALE-1')), 'https://www.antagning.se/se/my/selections');
    assert.deepEqual(ids(w), ['VT2027:KAU-49454']);
});

test('an explicitly loaded empty Mina val list clears saved courses', async t => {
    const html = selections('', 0).replace('<ul class="selection-cards"></ul>', '<div class="mina-val-emptystate">Inga valda utbildningar</div>');
    const w = await page(t, html, cached(storedCourse()), 'https://www.antagning.se/se/my/selections');
    assert.equal(rows(w).length, 0);
    assert.equal(JSON.parse(w.localStorage.getItem(STORAGE)).courses.length, 0);
});

test('a disabled or ambiguous card prevents pruning during a state transition', async t => {
    const w = await page(t, selections(card({ disabled: true }), 0), cached(storedCourse()), 'https://www.antagning.se/se/my/selections');
    assert.equal(rows(w).length, 1);
});

test('confirmed button changes add and remove courses without per-button listeners', async t => {
    const w = await page(t, card({ selected: false }));
    const siteButton = main(w).querySelector('.button-component');
    siteButton.click(); // A click alone is not proof of successful selection.
    await new Promise(resolve => setTimeout(resolve, 150));
    assert.equal(rows(w).length, 0);
    main(w).innerHTML = card();
    await until(() => assert.equal(rows(w).length, 1));
    main(w).innerHTML = card({ selected: false });
    await until(() => assert.equal(rows(w).length, 0));
});

test('selection state changes on existing nodes are observed', async t => {
    const w = await page(t, card({ selected: false }));
    main(w).querySelector('.button-text').firstChild.nodeValue = 'Ta bort';
    await until(() => assert.equal(rows(w).length, 1));
    main(w).querySelector('.button-text').firstChild.nodeValue = 'Lägg till';
    await until(() => assert.equal(rows(w).length, 0));
});

test('legacy toggle buttons respect the visible action and Swedish decimal credits', async t => {
    const w = await page(t, card({ legacy: true }));
    assert.equal(rows(w).length, 1);
    main(w).querySelector('.expand-text').classList.remove('hide');
    main(w).querySelector('.contract-text').classList.add('hide');
    await until(() => assert.equal(rows(w).length, 0));
});

test('unrelated filled buttons and hidden removal buttons cannot change selections', async t => {
    const w = await page(t, card({ selected: false }).replace('</div><button class="contained-button">Läs mer',
        '</div><div hidden><button>Ta bort</button></div><button class="contained-button">Läs mer'));
    assert.equal(rows(w).length, 0);
    main(w).querySelector('button.contained-button').click();
    await new Promise(resolve => setTimeout(resolve, 150));
    assert.equal(rows(w).length, 0);
});

test('the same application code in different terms stays separate', async t => {
    const w = await page(t, card() + card({ term: 'Hösten 2027', start: 36, end: 45 }));
    assert.deepEqual(ids(w), ['VT2027:KAU-49454', 'HT2027:KAU-49454']);
    main(w).innerHTML = card({ selected: false });
    await until(() => assert.deepEqual(ids(w), ['HT2027:KAU-49454']));
});

test('a rerender updates changed course metadata without duplicates', async t => {
    const w = await page(t, card());
    main(w).innerHTML = card({ hp: '15', pace: '50 %' });
    await until(() => assert.match(rows(w)[0].textContent, /15 hp/));
    assert.equal(rows(w).length, 1);
    assert.match(w.document.querySelector('.timeline-load-heading').textContent, /50 %/);
});

test('panel removal and entire body replacement restore saved rows and expansion', async t => {
    const w = await page(t, card());
    w.document.querySelector('.timeline-toggle').click();
    w.document.querySelector(PANEL).remove();
    await until(() => assert.equal(rows(w).length, 1));
    assert.equal(w.document.querySelector('#course-timelines-body').hidden, false);
    w.document.body.replaceChildren(w.document.createElement('main'));
    await until(() => assert.equal(rows(w).length, 1));
    assert.equal(w.document.querySelector('.timeline-count').textContent, '(1 kurs)');
    w.eval(source);
    assert.equal(w.document.querySelector('#course-timelines-body').hidden, false);
});

test('double injection cannot duplicate the panel or the observer', async t => {
    const w = await page(t, card());
    const instance = w.__antagningTimeline;
    w.eval(source);
    assert.equal(w.__antagningTimeline, instance);
    assert.equal(w.document.querySelectorAll(PANEL).length, 1);
    assert.equal(rows(w).length, 1);
});

test('corrupt and invalid stored records do not break startup', async t => {
    const corrupt = await page(t, card(), '{broken');
    assert.equal(rows(corrupt).length, 1);
    const invalid = await page(t, '', cached(storedCourse(), { ...storedCourse('BAD'), hp: 'NaN' }, { ...storedCourse('WRONG'), termKey: 'ZZ2027' }));
    assert.deepEqual(ids(invalid), ['VT2027:KAU-49454']);
});

test('old grouped cache is restored with term-scoped identities', async t => {
    const old = { ...storedCourse(), id: 'KAU-49454' };
    delete old.code;
    delete old.termKey;
    const w = await page(t, '', { VT2027: [old] });
    assert.deepEqual(ids(w), ['VT2027:KAU-49454']);
});

test('storage events synchronize another tab without destroying off-page records', async t => {
    const w = await page(t, '', cached(storedCourse()));
    w.localStorage.setItem(STORAGE, JSON.stringify(cached(storedCourse(), storedCourse('UU-05025'))));
    w.dispatchEvent(new w.StorageEvent('storage', { key: STORAGE }));
    assert.equal(rows(w).length, 2);
    main(w).innerHTML = card({ code: 'NEW-3' });
    await until(() => assert.equal(rows(w).length, 3));
    assert.equal(JSON.parse(w.localStorage.getItem(STORAGE)).courses.length, 3);
});

test('cross-year course weeks wrap correctly and explicit dates override period guesses', async t => {
    const w = await page(t, card({ term: 'Hösten 2027', start: 46, end: 3, pace: '50 %' }));
    assert.equal(rows(w).length, 1);
    assert.match(rows(w)[0].title, /v\.46–3 \(2028\)/);
    assert.equal(JSON.parse(w.localStorage.getItem(STORAGE)).courses[0].durationWeeks, 10);
    assert.match(w.document.querySelector('.timeline-weeks').textContent, /2028/);
});

test('missing term or missing schedule data is not replaced with an invented current term', async t => {
    const w = await page(t, card({ term: 'Okänd termin' }));
    assert.equal(rows(w).length, 0);
    main(w).innerHTML = card({ pace: 'Okänd', start: null, end: null });
    await new Promise(resolve => setTimeout(resolve, 150));
    assert.equal(rows(w).length, 0);
});

test('estimated schedules and summer courses are supported', async t => {
    const w = await page(t, card({ start: null, end: null, pace: 'Halvfart' }) + card({ code: 'SUMMER', term: 'Sommar 2027', start: 23, end: 32 }));
    assert.equal(rows(w).length, 2);
    assert.match(rows(w)[0].title, /uppskattat/);
    assert.match(w.document.querySelectorAll('.timeline-term-header')[1].textContent, /ST 2027/);
});

test('initial zero-count list is a loading state, not a confirmed empty selection', async t => {
    const w = await page(t, selections('', 0), cached(storedCourse()), 'https://www.antagning.se/se/my/selections');
    assert.equal(rows(w).length, 1);
    main(w).innerHTML = selections(card(), 1);
    await until(() => assert.equal(rows(w).length, 1));
});

test('a storage quota failure retains the in-memory courses on subsequent pages', async t => {
    const w = await page(t);
    w.console.warn = () => {};
    w.Storage.prototype.setItem = () => { throw new Error('Quota exceeded'); };
    main(w).innerHTML = card();
    await until(() => assert.equal(rows(w).length, 1));
    main(w).innerHTML = card({ code: 'OTHER', selected: false });
    await new Promise(resolve => setTimeout(resolve, 150));
    assert.deepEqual(ids(w), ['VT2027:KAU-49454']);
});

test('CSS-hidden ancestor controls cannot override the visible action', async t => {
    const html = card({ selected: false }).replace('<button class="contained-button">Läs mer',
        '<div style="display:none"><button>Ta bort</button></div><button class="contained-button">Läs mer');
    const w = await page(t, html, cached(storedCourse()));
    assert.equal(rows(w).length, 0);
});

test('partial panel replacement is repaired without losing course data', async t => {
    const w = await page(t, card());
    w.document.querySelector('#course-timelines-body').remove();
    await until(() => assert.equal(rows(w).length, 1));
    assert.equal(w.document.querySelectorAll(PANEL).length, 1);
});

test('overlapping courses sum their load and removing the last course removes its term', async t => {
    const w = await page(t, card() + card({ code: 'UU-05025', pace: '50 %', end: 12 }));
    assert.match(w.document.querySelector('.timeline-load-row').textContent, /75 %/);
    main(w).innerHTML = card({ selected: false }) + card({ code: 'UU-05025', selected: false });
    await until(() => assert.equal(w.document.querySelectorAll('.timeline-term').length, 0));
});

test('storage sync does not immediately reverse another tab using stale rendered cards', async t => {
    const w = await page(t, card());
    w.localStorage.setItem(STORAGE, JSON.stringify(cached()));
    w.dispatchEvent(new w.StorageEvent('storage', { key: STORAGE }));
    await new Promise(resolve => setTimeout(resolve, 150));
    assert.equal(rows(w).length, 0);
});
