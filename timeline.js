(() => {
    'use strict';

    // Content scripts can be injected again into the same document.
    if (window.__antagningTimeline) return;
    window.__antagningTimeline = { pending: true };

    const STORAGE_KEY = 'antagningCourseTimelineData';
    const PANEL_KEY = 'antagningCourseTimelineExpanded';
    const PANEL_ID = 'course-timelines-container';
    const CARD_SELECTOR = '.searchresultcard, .course-container';
    const IGNORED_BUTTON_SELECTOR = [
        '.favourite-toggle',
        '[data-cy="favourite-button"]',
        'utsokt-button-favourite button',
        '.info-toggle',
        'utsokt-button-info button',
        '.showmore-button',
        '.showmoreinfo',
        '.close-button'
    ].join(', ');
    const HP_PER_WEEK = 1.5;
    const WEEK_MS = 7 * 86400000;
    const MONDAY_EPOCH = Date.UTC(1970, 0, 5);
    const TERM_NAMES = { VT: 'Vårterminen', ST: 'Sommarterminen', HT: 'Höstterminen' };
    const TERM_MAP = {
        hösten: 'HT', autumn: 'HT', fall: 'HT', ht: 'HT',
        våren: 'VT', spring: 'VT', vt: 'VT',
        sommar: 'ST', sommaren: 'ST', summer: 'ST', st: 'ST'
    };
    const MONTHS = {
        jan: 0, feb: 1, mar: 2, apr: 3, may: 4, maj: 4, jun: 5, june: 5,
        jul: 6, july: 6, aug: 7, sep: 8, sept: 8, oct: 9, okt: 9, nov: 10, dec: 11
    };

    const number = value => new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 2 }).format(value);
    const text = element => element?.textContent.replace(/\s+/g, ' ').trim() || '';
    const numeric = value => Number(value.replace(',', '.'));

    function element(tag, className, content) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (content !== undefined) node.textContent = content;
        return node;
    }

    function field(card, ...labels) {
        const wanted = new Set(labels.map(label => label.toLowerCase()));
        for (const subtitle of card.querySelectorAll('.subtitle')) {
            const labelText = text(subtitle);
            if (!wanted.has(labelText.replace(/:$/, '').trim().toLowerCase())) continue;
            const rowText = text(subtitle.parentElement);
            if (rowText.startsWith(labelText)) return rowText.slice(labelText.length).trim();
        }
        return '';
    }

    function weeksInYear(year) {
        const december28 = new Date(Date.UTC(Number(year), 11, 28));
        const day = december28.getUTCDay() || 7;
        december28.setUTCDate(december28.getUTCDate() + 4 - day);
        return Math.ceil(((december28 - new Date(Date.UTC(december28.getUTCFullYear(), 0, 1))) / 86400000 + 1) / 7);
    }

    function isoWeek(date) {
        const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
        const day = utc.getUTCDay() || 7;
        utc.setUTCDate(utc.getUTCDate() + 4 - day);
        const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
        return {
            year: utc.getUTCFullYear(),
            week: Math.ceil(((utc - yearStart) / 86400000 + 1) / 7)
        };
    }

    function parseDayMonthWeek(textValue, termYear, termKey) {
        const match = textValue.match(/^\s*(\d{1,2})\s+([A-Za-z]+)(?:\s+(20\d{2}))?\s*$/);
        if (!match) return null;
        const month = MONTHS[match[2].toLowerCase()];
        if (month === undefined) return null;
        let year = match[3] ? Number(match[3]) : termYear;
        if (!match[3] && termKey.startsWith('HT') && month <= 5) year += 1;
        const iso = isoWeek(new Date(Date.UTC(year, month, Number(match[1]))));
        let week = iso.week;
        while (iso.year > termYear) {
            week += weeksInYear(iso.year - 1);
            iso.year -= 1;
        }
        return week;
    }

    function parseDateRange(textValue, termYear, termKey) {
        const parts = textValue.split(/\s+-\s+/);
        if (parts.length !== 2) return null;
        const start = parseDayMonthWeek(parts[0], termYear, termKey);
        const end = parseDayMonthWeek(parts[1], termYear, termKey);
        return start && end ? { start, end } : null;
    }

    function termConfig(termKey) {
        const start = { VT: 3, ST: 23, HT: 36 }[termKey.slice(0, 2)];
        return { start, end: start + (termKey.startsWith('ST') ? 13 : 20) - 1 };
    }

    function weekLabel(week, termKey) {
        let year = Number(termKey.slice(2));
        let remaining = week;
        let lastWeek = weeksInYear(year);
        if (remaining <= lastWeek) return String(remaining);
        while (remaining > lastWeek) {
            remaining -= lastWeek;
            year += 1;
            lastWeek = weeksInYear(year);
        }
        return `${remaining} (${year})`;
    }

    function formatWeekRange(startWeek, endWeek, termKey) {
        const start = weekLabel(startWeek, termKey);
        if (startWeek === endWeek) return `v.${start}`;
        return `v.${start}–${weekLabel(endWeek, termKey)}`;
    }

    function firstWeekIndex(termKey) {
        // ISO week 1 contains January 4. Count weeks from a known Monday.
        return Math.floor((Date.UTC(Number(termKey.slice(2)), 0, 4) - MONDAY_EPOCH) / WEEK_MS);
    }

    function weeklyLoad(courses) {
        const weeks = new Map();
        for (const course of courses) {
            const offset = firstWeekIndex(course.termKey) - 1;
            const hp = course.unit === 'fup' ? 0 : course.hp / course.durationWeeks;
            const percent = course.unit === 'fup'
                ? (course.paceEstimated === true ? 0 : course.studietakt)
                : hp / HP_PER_WEEK * 100;
            for (let week = course.startWeek; week <= course.endWeek; week++) {
                const key = offset + week;
                if (!weeks.has(key)) weeks.set(key, { hp: 0, percent: 0, unknown: false });
                const load = weeks.get(key);
                load.hp += hp;
                load.percent += percent;
                load.unknown ||= percent === 0;
            }
        }
        return weeks;
    }

    function identity(card) {
        const termText = field(card, 'Startperiod', 'Period') || text(card);
        const match = termText.match(/(Hösten|Våren|Sommar(?:en)?|Autumn|Spring|Summer|Fall)\s*(20\d{2})/i)
            || (card.querySelector('[data-id], button[id^="info-"]')?.getAttribute('data-id')
                || card.querySelector('button[id^="info-"]')?.id || '').match(/(HT|VT|ST)(20\d{2})/i);
        const term = match && TERM_MAP[match[1].toLowerCase()];
        const rawDataId = card.querySelector('button.toggleselection[data-id]')?.dataset.id;
        const code = field(card, 'Anmälningskod', 'Application code')
            || text(card).match(/(?:Anmälningskod|Application code):\s*([\w-]+)/i)?.[1]
            || (rawDataId ? rawDataId.replace(/^(?:HT|VT|ST)20\d{2}-/i, '') : '');
        if (!term || !code) return null;
        const termKey = `${term}${match[2]}`;
        return { id: `${termKey}:${code}`, code, termKey };
    }

    function parseStudietakt(card) {
        const explicitSource = field(card, 'Studietakt', 'Pace of study')
            || text(card.querySelector('.education-block-tags'));
        const paceWords = [['hel', 100], ['trekvarts', 75], ['halv', 50], ['kvarts', 25]];
        if (explicitSource) {
            const paceMatch = explicitSource.match(/(\d+(?:[.,]\d+)?)\s*%/);
            if (paceMatch) return numeric(paceMatch[1]);
            const wordHit = paceWords.find(([word]) => new RegExp(`${word}fart`, 'i').test(explicitSource));
            if (wordHit) return wordHit[1];
            return undefined;
        }
        // Without metadata containers, avoid matching unrelated percentages in prerequisite prose.
        const cardText = text(card);
        const labeledMatch = cardText.match(/(?:Studietakt|Pace of study):\s*(\d+(?:[.,]\d+)?)\s*%/i);
        if (labeledMatch) return numeric(labeledMatch[1]);
        return paceWords.find(([word]) => new RegExp(`${word}fart`, 'i').test(cardText))?.[1];
    }

    function readCourse(card) {
        const key = identity(card);
        const name = text(card.querySelector('.headline4, h3, h2'));
        // Read credits from the metadata, never from prerequisite prose.
        const points = field(card, 'Omfattning', 'Credits/length')
            || text(card.querySelector('.education-block-tags, .universal_medium'));
        const hpMatch = points.match(/(\d+(?:[.,]\d+)?)\s*(?:hp|högskolepoäng|fup|förutbildningspoäng|access\s+credits?|credits?)\b/i);
        if (!key || !name || !hpMatch) return null;
        const hp = numeric(hpMatch[1]);
        const unit = /\b(?:fup|förutbildningspoäng|access\s+credits?)\b/i.test(hpMatch[0]) ? 'fup' : 'hp';
        let studietakt = parseStudietakt(card);
        const config = termConfig(key.termKey);
        const termYear = Number(key.termKey.slice(2));
        const startText = field(card, 'Startvecka', 'Course starts');
        const endText = field(card, 'Slutvecka', 'Course dates');
        const rangeWeeks = parseDateRange(endText, termYear, key.termKey);
        const startMatch = startText.match(/^(?:Vecka|Week)\s*(\d{1,2})\b|^\s*(\d{1,2})\s*$/i);
        const endMatch = endText.match(/^(?:Vecka|Week)\s*(\d{1,2})\b|^\s*(\d{1,2})\s*$/i);
        const singleStartDate = !startMatch && !rangeWeeks ? parseDayMonthWeek(startText, termYear, key.termKey) : null;
        const hasExplicitStart = Boolean(startMatch || rangeWeeks?.start || singleStartDate);
        const hasExplicitEnd = Boolean(endMatch || rangeWeeks?.end);
        let startWeek = startMatch ? Number(startMatch[1] || startMatch[2])
            : rangeWeeks?.start ?? singleStartDate
            ?? config.start + (/Period\s*2/i.test(field(card, 'Startperiod', 'Period') || text(card)) ? 10 : 0);
        let endWeek = endMatch ? Number(endMatch[1] || endMatch[2]) : (rangeWeeks?.end ?? null);
        if (startMatch && (startWeek < 1 || startWeek > 53)) return null;
        if (endMatch && (endWeek < 1 || endWeek > 53)) return null;
        if (key.termKey.startsWith('HT')) {
            const lastWeek = weeksInYear(termYear);
            // Wrap only early-year weeks (< 20) into the next year so week 34/35 starts stay in autumn.
            if (startWeek < 20) startWeek += lastWeek;
            if (endWeek !== null && endWeek < startWeek) endWeek += lastWeek;
        }
        if (endWeek !== null && endWeek < startWeek) return null;
        const durationWeeks = endWeek !== null ? endWeek - startWeek + 1
            : studietakt > 0 ? Math.ceil(hp / HP_PER_WEEK * 100 / studietakt) : 0;
        const paceEstimated = !studietakt;
        if (paceEstimated && durationWeeks) studietakt = hp / durationWeeks / HP_PER_WEEK * 100;
        const course = {
            ...key,
            name,
            hp,
            unit,
            studietakt,
            paceEstimated,
            startWeek,
            durationWeeks,
            endWeek: startWeek + durationWeeks - 1,
            estimated: !hasExplicitStart || !hasExplicitEnd
        };
        return validCourse(course) ? course : null;
    }

    function validCourse(course) {
        return course && /^(VT|HT|ST)20\d{2}$/.test(course.termKey)
            && typeof course.code === 'string' && course.code.length > 0 && course.code.length < 200
            && course.id === `${course.termKey}:${course.code}`
            && typeof course.name === 'string' && course.name.trim().length > 0
            && Number.isFinite(course.hp) && course.hp > 0
            && (course.unit === undefined || course.unit === 'hp' || course.unit === 'fup')
            && Number.isFinite(course.studietakt) && course.studietakt > 0 && course.studietakt <= 400
            && (course.paceEstimated === undefined || typeof course.paceEstimated === 'boolean')
            && Number.isInteger(course.startWeek) && course.startWeek >= 1 && course.startWeek <= 106
            && Number.isInteger(course.durationWeeks) && course.durationWeeks > 0 && course.durationWeeks <= 520
            && course.endWeek === course.startWeek + course.durationWeeks - 1;
    }

    function decode(raw) {
        const courses = new Map();
        try {
            const data = JSON.parse(raw || 'null');
            if (!data || typeof data !== 'object') return courses;
            const values = data.version === 2 && Array.isArray(data.courses) ? data.courses
                : Object.entries(data).flatMap(([termKey, schedules]) => Array.isArray(schedules)
                    ? schedules.map(course => ({ ...course, code: course.id, id: `${termKey}:${course.id}`, termKey, estimated: true })) : []);
            for (const course of values) if (validCourse(course)) courses.set(course.id, course);
        } catch { /* A corrupt cache must not prevent startup. */ }
        return courses;
    }

    // true/false mean confirmed selected/unselected; null means no reliable signal.
    function selectionState(card) {
        const actions = new Set();
        for (const button of card.querySelectorAll('button')) {
            if (button.disabled || button.getAttribute('aria-disabled') === 'true'
                || button.classList.contains('ispending') || button.getAttribute('aria-busy') === 'true'
                || button.matches(IGNORED_BUTTON_SELECTOR)
                || button.closest('[hidden], [aria-hidden="true"], .hide')) continue;
            let state = null;
            if (button.matches('.toggleselection')) {
                const removeLabel = button.querySelector('.contract-text');
                const addLabel = button.querySelector('.expand-text');
                if (removeLabel && addLabel) {
                    const shown = node => !node.closest('.hide, [hidden], [aria-hidden="true"]') && getComputedStyle(node).display !== 'none';
                    if (shown(removeLabel) !== shown(addLabel)) state = shown(removeLabel);
                }
            }
            if (state === null) {
                const label = button.getAttribute('aria-label') || text(button.querySelector('.button-text')) || text(button);
                if (/^(?:Ta bort|Remove)(?!\s+(?:favorit|favourite))\b/i.test(label)) state = true;
                else if (/^(?:Lägg till|Select)\b/i.test(label)) state = false;
            }
            if (state === null) continue;
            let hidden = false;
            for (let node = button; node; node = node.parentElement) {
                const style = getComputedStyle(node);
                if (style.display === 'none' || style.visibility === 'hidden') { hidden = true; break; }
            }
            if (!hidden) actions.add(state);
        }
        return actions.size === 1 ? [...actions][0] : null;
    }

    class CourseTimeline {
        constructor() {
            this.courses = this.readStored();
            this.expanded = this.readValue(PANEL_KEY) === 'true';
            this.timer = null;
            this.root = null;
            this.header = null;
            this.headerObserver = null;
            this.storageFailed = false;
            this.sync = this.sync.bind(this);
            this.schedule = this.schedule.bind(this);
            this.updateStickyOffset = this.updateStickyOffset.bind(this);
        }

        readValue(key) {
            try { return localStorage.getItem(key); } catch { return null; }
        }

        readStored() { return decode(this.readValue(STORAGE_KEY)); }

        start() {
            this.ensurePanel();
            // Ignore our own rendering so it cannot trigger a render/observer loop.
            this.observer = new MutationObserver(records => {
                if (!this.body?.isConnected || records.some(record => !this.root?.contains(record.target))) this.schedule();
            });
            this.observer.observe(document.documentElement, {
                subtree: true, childList: true, characterData: true, attributes: true,
                attributeFilter: ['class', 'style', 'disabled', 'hidden', 'aria-disabled', 'aria-hidden', 'aria-busy', 'aria-pressed']
            });
            document.addEventListener('click', this.schedule, true);
            document.addEventListener('visibilitychange', this.schedule);
            for (const event of ['popstate', 'hashchange', 'pageshow', 'focus']) window.addEventListener(event, this.schedule);
            window.addEventListener('scroll', this.updateStickyOffset, { passive: true });
            window.addEventListener('resize', this.updateStickyOffset, { passive: true });
            window.navigation?.addEventListener('navigatesuccess', this.schedule);
            window.addEventListener('storage', event => {
                if (event.key === STORAGE_KEY || event.key === null) {
                    this.storageFailed = false;
                    this.courses = this.readStored();
                    this.render();
                }
            });
            this.sync();
        }

        schedule() {
            if (this.timer !== null) return;
            this.timer = setTimeout(() => { this.timer = null; this.sync(); }, 100);
        }

        findHeader() {
            return document.querySelector('huvudmeny-huvudmeny') || document.querySelector('header');
        }

        updateStickyOffset() {
            if (!this.root) return;
            const header = this.header?.isConnected ? this.header : this.findHeader();
            const bottom = header ? Math.max(0, Number(header.getBoundingClientRect().bottom.toFixed(2))) : 0;
            this.root.style.setProperty('--timeline-sticky-top', `${bottom}px`);
        }

        mountPanel() {
            const header = this.findHeader();
            if (header && header.parentElement) {
                if (this.root.previousElementSibling !== header || this.root.parentElement !== header.parentElement) {
                    header.insertAdjacentElement('afterend', this.root);
                }
            } else {
                const host = document.querySelector('app-root') || document.body;
                if (host && (this.root.parentElement !== host || host.firstElementChild !== this.root)) {
                    host.prepend(this.root);
                }
            }
            if (header !== this.header) {
                this.headerObserver?.disconnect();
                this.header = header;
                if (header && typeof ResizeObserver === 'function') {
                    this.headerObserver = new ResizeObserver(this.updateStickyOffset);
                    this.headerObserver.observe(header);
                }
            }
            this.updateStickyOffset();
        }

        ensurePanel() {
            if (this.root?.isConnected && this.body?.isConnected && this.root.contains(this.body)) {
                this.mountPanel();
                return;
            }
            document.getElementById(PANEL_ID)?.remove();
            this.root = element('aside', '', undefined);
            this.root.id = PANEL_ID;
            this.root.setAttribute('aria-label', 'Kurstidslinje');
            const toggle = element('button', 'timeline-toggle');
            toggle.type = 'button';
            toggle.setAttribute('aria-controls', 'course-timelines-body');
            const inner = element('span', 'timeline-toggle-inner');
            const mark = element('span', 'timeline-mark');
            mark.setAttribute('aria-hidden', 'true');
            mark.append(element('span'), element('span'), element('span'));
            this.summary = element('span', 'timeline-count');
            const title = element('span', 'timeline-toggle-label');
            title.append(element('span', 'timeline-title', 'Kurstidslinje'), this.summary);
            const action = element('span', 'timeline-toggle-action');
            const icon = element('span', 'timeline-toggle-icon');
            icon.setAttribute('aria-hidden', 'true');
            this.actionText = element('span');
            action.append(this.actionText, icon);
            inner.append(mark, title, action);
            toggle.append(inner);
            this.body = element('div', 'timeline-body');
            this.body.id = 'course-timelines-body';
            this.content = element('div', 'timeline-content');
            this.help = element('details', 'timeline-help');
            this.help.append(element('summary', '', 'Om veckor och beräkningar'), element('p', '',
                'Belastningen räknas över alla valda kurser. Högskolepoäng fördelas jämnt över kursveckorna och 1,5 hp per vecka motsvarar heltid. För kurser med förutbildningspoäng används angiven studietakt. Veckovyn följer ungefärliga terminsgränser.'));
            const clear = element('button', 'timeline-clear', 'Läs in kurser på nytt');
            clear.type = 'button';
            clear.addEventListener('click', () => this.clearSaved());
            const refresh = element('div', 'timeline-refresh');
            refresh.append(element('p', '', 'Läser in kurserna på sidan igen och tömmer sparade uppgifter från andra sidor. Öppna Mina val för att läsa in hela listan.'), clear);
            this.help.append(refresh);
            this.status = element('p', 'timeline-status');
            this.status.setAttribute('role', 'status');
            this.body.append(this.content, this.help, this.status);
            this.toggle = toggle;
            toggle.addEventListener('click', () => this.setExpanded(!this.expanded));
            this.root.addEventListener('keydown', event => {
                if (event.key !== 'Escape' || !this.expanded || event.defaultPrevented) return;
                event.stopPropagation();
                this.setExpanded(false);
                this.toggle.focus();
            });
            this.root.append(toggle, this.body);
            this.header = null;
            this.mountPanel();
            this.render();
        }

        updateToggle() {
            this.toggle.setAttribute('aria-expanded', String(this.expanded));
            this.root.classList.toggle('timeline-expanded', this.expanded);
            this.body.hidden = !this.expanded;
            this.actionText.textContent = this.expanded ? 'Dölj planering' : 'Visa planering';
            this.summary.textContent = `${this.courses.size} ${this.courses.size === 1 ? 'vald kurs' : 'valda kurser'}`;
        }

        setExpanded(expanded) {
            this.expanded = expanded;
            try { localStorage.setItem(PANEL_KEY, String(expanded)); } catch { /* In-memory UI still works. */ }
            this.updateToggle();
            if (expanded && this.root.getBoundingClientRect().top < (this.header?.getBoundingClientRect().bottom || 0)) {
                this.root.scrollIntoView?.({ block: 'start' });
            }
        }

        clearSaved() {
            this.courses = new Map();
            this.storageFailed = false;
            try { localStorage.removeItem(STORAGE_KEY); } catch { /* In-memory UI still works. */ }
            this.sync();
            this.render();
            this.status.textContent = `Kurserna på sidan har lästs in. ${this.summary.textContent}.`;
        }

        sync() {
            this.ensurePanel();
            const changes = new Map();
            const cards = [...document.querySelectorAll(CARD_SELECTOR)];
            for (const card of cards) {
                const key = identity(card);
                const selected = selectionState(card);
                if (!key || selected === null) continue;
                if (selected) {
                    const course = readCourse(card);
                    if (course) changes.set(key.id, course);
                } else changes.set(key.id, null);
            }

            // Absence in search results, filters, or a loading route is NOT removal.
            // Only a fully rendered Mina val list with a matching count is authoritative.
            const selectionPage = document.querySelector('.selections-page');
            const list = selectionPage?.querySelector('.selection-cards');
            const emptyState = selectionPage?.querySelector('.mina-val-emptystate');
            const countText = text(document.querySelector('a.selectionstab[aria-current="page"] .dynamic-content'));
            const countMatch = countText.match(/^\((\d+)\)$/);
            if (/\/my\/selections\/?$/.test(location.pathname) && (list || emptyState) && countMatch
                && !selectionPage.closest('[aria-busy="true"]') && !selectionPage.querySelector('[aria-busy="true"], utsokt-skeleton-block, .externalsearch-missing-hits')) {
                const listCards = list ? [...list.querySelectorAll(CARD_SELECTOR)] : [];
                const selectedIds = new Set();
                let complete = true;
                let selectedCount = 0;
                for (const card of listCards) {
                    const selected = selectionState(card);
                    const key = identity(card);
                    if (selected === null || !key) complete = false;
                    if (selected === true) {
                        selectedCount++;
                        if (key) selectedIds.add(key.id);
                    }
                }
                const loaded = selectedCount > 0 || listCards.length > 0 || Boolean(emptyState);
                if (loaded && complete && selectedCount === Number(countMatch[1])) {
                    // Include storage so a tab with an older view does not resurrect stale courses.
                    const known = new Map([...this.readStored(), ...this.courses]);
                    for (const id of known.keys()) if (!selectedIds.has(id)) changes.set(id, null);
                }
            }
            this.commit(changes);
        }

        commit(changes) {
            let next;
            try { next = this.storageFailed ? new Map(this.courses) : decode(localStorage.getItem(STORAGE_KEY)); }
            catch { next = new Map(this.courses); }
            for (const [id, course] of changes) {
                if (course) next.set(id, course);
                else next.delete(id);
            }
            const encode = courses => JSON.stringify({ version: 2, courses: [...courses.values()].sort((a, b) => a.id.localeCompare(b.id)) });
            const raw = encode(next);
            const changed = raw !== encode(this.courses);
            this.courses = next;
            if (changed) {
                try { localStorage.setItem(STORAGE_KEY, raw); }
                catch (error) {
                    this.storageFailed = true;
                    console.warn('Kurstidslinje: kunde inte spara valen.', error);
                }
                this.render();
            }
        }

        render() {
            if (!this.body?.isConnected) return;
            this.updateToggle();
            const active = document.activeElement;
            const focusId = this.content.contains(active) ? active.id : '';
            const openDetails = new Set([...this.content.querySelectorAll('details[open]')].map(detail => detail.id));
            this.help.hidden = this.courses.size === 0;
            const content = document.createDocumentFragment();
            this.status.textContent = '';
            if (!this.courses.size) {
                const empty = element('div', 'timeline-empty');
                const search = element('a', 'timeline-link', 'Hitta utbildningar');
                search.href = '/se/search';
                search.id = 'timeline-find-courses';
                empty.append(element('h2', '', 'Inga kurser i din planering'), element('p', '',
                    'Välj Lägg till vid en kurs på Antagning.se. Då visas kursens veckor och studietakt här.'), search);
                content.append(empty);
            } else {
                const terms = new Map();
                for (const course of this.courses.values()) {
                    if (!terms.has(course.termKey)) terms.set(course.termKey, []);
                    terms.get(course.termKey).push(course);
                }
                const order = key => Number(key.slice(2)) * 10 + { VT: 1, ST: 2, HT: 3 }[key.slice(0, 2)];
                const termKeys = [...terms.keys()].sort((a, b) => order(a) - order(b));
                const load = weeklyLoad(this.courses.values());
                if (termKeys.length > 1) {
                    const nav = element('nav', 'timeline-nav');
                    nav.setAttribute('aria-label', 'Hoppa till termin');
                    nav.append(element('span', '', 'Hoppa till'));
                    for (const key of termKeys) {
                        const link = element('a', 'timeline-link', `${key.slice(0, 2)} ${key.slice(2)}`);
                        link.id = `timeline-link-${key}`;
                        link.href = `#timeline-term-${key}`;
                        link.addEventListener('click', event => {
                            event.preventDefault();
                            const target = document.getElementById(`timeline-term-${key}`);
                            target.focus({ preventScroll: true });
                            target.scrollIntoView?.({ block: 'start' });
                        });
                        nav.append(link);
                    }
                    content.append(nav);
                }
                for (const termKey of termKeys) {
                    const term = this.renderTerm(termKey, terms.get(termKey), load);
                    const detail = term.querySelector('details');
                    detail.open = openDetails.has(detail.id);
                    content.append(term);
                }
            }
            this.content.replaceChildren(content);
            if (focusId || (this.help.hidden && this.help.contains(active))) {
                (document.getElementById(focusId) || this.toggle).focus({ preventScroll: true });
            }
        }

        renderTerm(termKey, termCourses, load) {
            const courses = [...termCourses].sort((a, b) => a.startWeek - b.startWeek || a.endWeek - b.endWeek || a.name.localeCompare(b.name, 'sv'));
            const config = termConfig(termKey);
            const length = config.end - config.start + 1;
            const section = element('section', 'timeline-term');
            const title = element('h2', '', `${TERM_NAMES[termKey.slice(0, 2)]} ${termKey.slice(2)}`);
            title.id = `timeline-term-${termKey}`;
            title.tabIndex = -1;
            section.setAttribute('aria-labelledby', title.id);
            const header = element('div', 'timeline-term-header');
            const credits = { hp: 0, fup: 0 };
            for (const course of courses) credits[course.unit === 'fup' ? 'fup' : 'hp'] += course.hp;
            const totals = Object.entries(credits).filter(([, value]) => value > 0)
                .map(([unit, value]) => `${number(value)} ${unit}`).join(' + ');
            const stats = element('p', 'timeline-term-stats', `${courses.length} ${courses.length === 1 ? 'kurs' : 'kurser'} · ${totals}`);
            header.append(title, stats);
            if (credits.hp > 45) header.append(element('span', 'timeline-credit-warning', 'Över 45 hp'));

            const termLoad = this.renderLoad(termKey, courses, config, load);
            const axis = element('div', 'timeline-chart-header');
            const weeks = element('div', 'timeline-weeks');
            const ticks = termKey.startsWith('ST')
                ? [config.start, config.start + 6, config.end]
                : [config.start, config.start + 5, config.start + 10, config.start + 15, config.end];
            for (const tick of ticks) {
                const label = element('span', '', `v.${weekLabel(tick, termKey)}`);
                label.style.setProperty('--tick-position', `${(tick - config.start + 0.5) / length * 100}%`);
                weeks.append(label);
            }
            axis.setAttribute('aria-hidden', 'true');
            axis.append(element('span', '', 'Kurser'), weeks);
            const list = element('ul', 'timeline-courses');
            list.setAttribute('role', 'list');
            for (const course of courses) {
                const row = element('li', 'course-timeline-item');
                row.dataset.courseId = course.id;
                const unit = course.unit === 'fup' ? 'fup' : 'hp';
                const info = element('div', 'course-info');
                const hasPace = unit !== 'fup' || course.paceEstimated !== true;
                const paceText = hasPace ? `${number(course.studietakt)} %${course.paceEstimated ? ' uppskattad studietakt' : ' studietakt'}` : 'Studietakt saknas';
                const meta = element('div', 'course-meta');
                meta.append(element('span', '', `${number(course.hp)} ${unit}`), element('span', '', paceText),
                    element('span', 'course-schedule', `${formatWeekRange(course.startWeek, course.endWeek, termKey)}${course.estimated ? ' (uppskattat)' : ''}`));
                if (course.startWeek < config.start || course.endWeek > config.end) {
                    meta.append(element('span', 'timeline-boundary', 'Veckor utanför veckovyn'));
                }
                info.append(element('span', 'course-label', course.name), meta);
                const track = element('div', 'course-track');
                track.setAttribute('aria-hidden', 'true');
                track.style.setProperty('--week-size', `${100 / length}%`);
                const bar = element('div', 'course-progress');
                const start = Math.max(config.start, course.startWeek);
                const end = Math.min(config.end, course.endWeek);
                if (end >= start) {
                    bar.style.left = `${(start - config.start) / length * 100}%`;
                    bar.style.width = `${(end - start + 1) / length * 100}%`;
                    if (course.estimated) bar.classList.add('timeline-estimated');
                    if (course.startWeek < config.start) bar.classList.add('timeline-underflow');
                    if (course.endWeek > config.end) bar.classList.add('timeline-overflow');
                    track.append(bar);
                }
                row.append(info, track);
                list.append(row);
            }
            section.append(header, termLoad.overview, axis, list, termLoad.details);
            return section;
        }

        renderLoad(termKey, courses, config, load) {
            const offset = firstWeekIndex(termKey) - 1;
            const activeWeeks = new Set();
            for (const course of courses) {
                for (let week = course.startWeek; week <= course.endWeek; week++) activeWeeks.add(week);
            }
            const periods = [];
            let totalHp = 0;
            let totalPercent = 0;
            let peak = 0;
            let incomplete = false;
            for (const week of [...activeWeeks].sort((a, b) => a - b)) {
                const current = load.get(offset + week);
                const previous = periods.at(-1);
                if (previous && previous.end + 1 === week && Math.abs(previous.percent - current.percent) < 0.00001
                    && Math.abs(previous.hp - current.hp) < 0.00001 && previous.unknown === current.unknown) {
                    previous.end = week;
                } else periods.push({ start: week, end: week, ...current });
                if (week >= config.start && week <= config.end) {
                    totalHp += current.hp;
                    totalPercent += current.percent;
                }
                peak = Math.max(peak, current.percent);
                incomplete ||= current.unknown;
            }
            const overloaded = periods.filter(period => period.percent > 100.05);
            const warningCount = overloaded.reduce((sum, { start, end }) => sum + end - start + 1, 0);
            const overview = element('div', `timeline-overview${warningCount ? ' timeline-overview-warning' : ''}`);
            const headline = warningCount ? `Över heltid i ${warningCount} ${warningCount === 1 ? 'vecka' : 'veckor'}` : 'Högsta belastning';
            const knownPeak = peak > 0 ? `${incomplete ? 'minst ' : ''}${number(peak)} %` : 'Okänd';
            overview.append(element('strong', '', headline), element('span', 'timeline-peak', knownPeak));
            if (warningCount) {
                const firstRanges = overloaded.slice(0, 2).map(period => formatWeekRange(period.start, period.end, termKey)).join(', ');
                const remaining = overloaded.length - 2;
                overview.append(element('span', 'timeline-overview-note', `${firstRanges}${remaining > 0 ? ` och ${remaining} till` : ''}`));
            } else if (incomplete) {
                overview.append(element('span', 'timeline-overview-note', 'Studietakt saknas för vissa veckor'));
            }

            const details = element('details', 'timeline-load');
            details.id = `timeline-load-${termKey}`;
            const disclosure = element('summary', '', 'Belastning per vecka');
            disclosure.id = `timeline-load-toggle-${termKey}`;
            details.append(disclosure);
            const length = config.end - config.start + 1;
            const average = `${number(totalPercent / length)} % · ${number(totalHp)} hp under veckorna i vyn`;
            details.append(element('p', 'timeline-load-heading', `Genomsnitt i veckovyn: ${incomplete ? 'minst ' : ''}${average}`));
            const rows = element('ul', 'timeline-load-list');
            rows.setAttribute('role', 'list');
            for (const period of periods) {
                const isOverload = period.percent > 100.05;
                const row = element('li', `timeline-load-row${isOverload ? ' is-overload' : ''}`);
                const label = period.unknown && period.percent === 0 ? 'Studietakt saknas'
                    : `${period.unknown ? 'Minst ' : ''}${number(period.percent)} %${isOverload ? ' · Över heltid' : ''}`;
                row.append(element('span', '', formatWeekRange(period.start, period.end, termKey)), element('span', '', label));
                rows.append(row);
            }
            details.append(rows);
            return { overview, details };
        }
    }

    function initialize() {
        const timeline = new CourseTimeline();
        window.__antagningTimeline = timeline;
        timeline.start();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
    else initialize();
})();
