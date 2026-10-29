(() => {
    'use strict';

    // Content scripts can be injected again into the same document.
    if (window.__antagningTimeline) return;
    window.__antagningTimeline = { pending: true };

    const STORAGE_KEY = 'antagningCourseTimelineData';
    const PANEL_KEY = 'antagningCourseTimelineExpanded';
    const PANEL_ID = 'course-timelines-container';
    const CARD_SELECTOR = '.searchresultcard, .course-container';
    const HP_PER_WEEK = 1.5;
    const COLORS = new Map([[100, '#4caf50'], [75, '#26a69a'], [50, '#ffa726'],
        [25, '#5c6bc0'], [20, '#7e57c2'], [10, '#ef5350']]);
    const number = value => new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 2 }).format(value);
    const text = element => element?.textContent.replace(/\s+/g, ' ').trim() || '';
    const numeric = value => Number(value.replace(',', '.'));

    function element(tag, className, content) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (content !== undefined) node.textContent = content;
        return node;
    }

    function field(card, label) {
        const subtitle = [...card.querySelectorAll('.subtitle')]
            .find(node => text(node).replace(/:$/, '').trim().toLowerCase() === label.toLowerCase());
        return subtitle ? text(subtitle.parentElement).slice(text(subtitle).length).trim() : '';
    }

    function weeksInYear(year) {
        const december28 = new Date(Date.UTC(Number(year), 11, 28));
        const day = december28.getUTCDay() || 7;
        december28.setUTCDate(december28.getUTCDate() + 4 - day);
        return Math.ceil(((december28 - new Date(Date.UTC(december28.getUTCFullYear(), 0, 1))) / 86400000 + 1) / 7);
    }

    function termConfig(termKey) {
        const start = { VT: 3, ST: 23, HT: 36 }[termKey.slice(0, 2)];
        return { start, end: start + (termKey.startsWith('ST') ? 13 : 20) - 1 };
    }

    function weekLabel(week, termKey) {
        const lastWeek = weeksInYear(termKey.slice(2));
        return week > lastWeek ? `${week - lastWeek} (${Number(termKey.slice(2)) + 1})` : String(week);
    }

    function identity(card) {
        const termText = field(card, 'Startperiod') || text(card);
        const match = termText.match(/(Hösten|Våren|Sommar(?:en)?)\s*(20\d{2})/i)
            || (card.querySelector('[data-id], button[id^="info-"]')?.getAttribute('data-id')
                || card.querySelector('button[id^="info-"]')?.id || '').match(/(HT|VT|ST)(20\d{2})/);
        const term = match && ({ hösten: 'HT', våren: 'VT', sommar: 'ST', sommaren: 'ST' }[match[1].toLowerCase()] || match[1]);
        const code = field(card, 'Anmälningskod') || text(card).match(/Anmälningskod:\s*([\w-]+)/i)?.[1]
            || card.querySelector('button.toggleselection[data-id]')?.dataset.id;
        if (!term || !code) return null;
        const termKey = `${term}${match[2]}`;
        return { id: `${termKey}:${code}`, code, termKey };
    }

    function readCourse(card) {
        const key = identity(card);
        const name = text(card.querySelector('.headline4, h3, h2'));
        // Read credits from the metadata, never from prerequisite prose.
        const points = field(card, 'Omfattning') || text(card.querySelector('.education-block-tags, .universal_medium'));
        const hpMatch = points.match(/(\d+(?:[.,]\d+)?)\s*(?:hp\b|högskolepoäng)/i);
        if (!key || !name || !hpMatch) return null;
        const hp = numeric(hpMatch[1]);
        const paceText = field(card, 'Studietakt') || text(card.querySelector('.education-block-tags')) || text(card);
        const paceWords = [['hel', 100], ['trekvarts', 75], ['halv', 50], ['kvarts', 25]];
        const paceMatch = paceText.match(/(\d+(?:[.,]\d+)?)\s*%/);
        let studietakt = paceMatch ? numeric(paceMatch[1]) : paceWords.find(([word]) => new RegExp(`${word}fart`, 'i').test(paceText))?.[1];
        const config = termConfig(key.termKey);
        const startText = field(card, 'Startvecka');
        const startMatch = startText.match(/(?:Vecka\s*)?(\d{1,2})/i);
        let startWeek = startMatch ? Number(startMatch[1])
            : config.start + (/Period\s*2/i.test(field(card, 'Startperiod') || text(card)) ? 10 : 0);
        const endMatch = field(card, 'Slutvecka').match(/(?:Vecka\s*)?(\d{1,2})/i);
        let endWeek = endMatch ? Number(endMatch[1]) : null;
        if (startMatch && (startWeek < 1 || startWeek > 53)) return null;
        if (endMatch && (endWeek < 1 || endWeek > 53)) return null;
        if (key.termKey.startsWith('HT')) {
            const lastWeek = weeksInYear(key.termKey.slice(2));
            if (startWeek < config.start) startWeek += lastWeek;
            if (endWeek !== null && endWeek < startWeek) endWeek += lastWeek;
        }
        if (endWeek !== null && endWeek < startWeek) return null;
        const durationWeeks = endWeek !== null ? endWeek - startWeek + 1
            : studietakt > 0 ? Math.ceil(hp / HP_PER_WEEK * 100 / studietakt) : 0;
        if (!studietakt && durationWeeks) studietakt = hp / durationWeeks / HP_PER_WEEK * 100;
        const course = { ...key, name, hp, studietakt, startWeek, durationWeeks,
            endWeek: startWeek + durationWeeks - 1, estimated: !startMatch || !endMatch };
        return validCourse(course) ? course : null;
    }

    function validCourse(course) {
        return course && /^(VT|HT|ST)20\d{2}$/.test(course.termKey)
            && typeof course.code === 'string' && course.code.length > 0 && course.code.length < 200
            && course.id === `${course.termKey}:${course.code}`
            && typeof course.name === 'string' && course.name.trim().length > 0
            && Number.isFinite(course.hp) && course.hp > 0
            && Number.isFinite(course.studietakt) && course.studietakt > 0 && course.studietakt <= 100
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
            if (button.disabled || button.getAttribute('aria-disabled') === 'true' || button.closest('[hidden], [aria-hidden="true"], .hide')) continue;
            let hidden = false;
            for (let node = button; node; node = node.parentElement) {
                const style = getComputedStyle(node);
                if (style.display === 'none' || style.visibility === 'hidden') { hidden = true; break; }
            }
            if (hidden) continue;
            const label = button.getAttribute('aria-label') || text(button.querySelector('.button-text')) || text(button);
            if (button.matches('.toggleselection')) {
                const removeLabel = button.querySelector('.contract-text');
                const addLabel = button.querySelector('.expand-text');
                if (removeLabel && addLabel) {
                    const shown = node => !node.closest('.hide, [hidden], [aria-hidden="true"]') && getComputedStyle(node).display !== 'none';
                    if (shown(removeLabel) !== shown(addLabel)) actions.add(shown(removeLabel));
                } else if (/^Ta bort\b/i.test(label)) actions.add(true);
                else if (/^Lägg till\b/i.test(label)) actions.add(false);
            } else if (/^Ta bort\b/i.test(label)) actions.add(true);
            else if (/^Lägg till\b/i.test(label)) actions.add(false);
        }
        return actions.size === 1 ? [...actions][0] : null;
    }

    class CourseTimeline {
        constructor() {
            this.courses = this.readStored();
            this.expanded = this.readValue(PANEL_KEY) === 'true';
            this.timer = null;
            this.root = null;
            this.storageFailed = false;
            this.sync = this.sync.bind(this);
            this.schedule = this.schedule.bind(this);
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

        ensurePanel() {
            if (this.root?.isConnected && this.body?.isConnected && this.root.contains(this.body)) return;
            document.getElementById(PANEL_ID)?.remove();
            this.root = element('aside', '', undefined);
            this.root.id = PANEL_ID;
            this.root.setAttribute('aria-label', 'Kurstidslinje');
            const toggle = element('button', 'timeline-toggle');
            toggle.type = 'button';
            toggle.setAttribute('aria-controls', 'course-timelines-body');
            toggle.append(element('span', 'timeline-title', 'Kurstidslinje'));
            this.summary = element('span', 'timeline-count');
            this.icon = element('span', 'timeline-toggle-icon');
            this.icon.setAttribute('aria-hidden', 'true');
            toggle.append(this.summary, this.icon);
            this.body = element('div', 'timeline-body');
            this.body.id = 'course-timelines-body';
            this.toggle = toggle;
            toggle.addEventListener('click', () => {
                this.expanded = !this.expanded;
                try { localStorage.setItem(PANEL_KEY, String(this.expanded)); } catch { /* In-memory UI still works. */ }
                this.updateToggle();
            });
            this.root.append(toggle, this.body);
            document.body.append(this.root);
            this.render();
        }

        updateToggle() {
            this.toggle.setAttribute('aria-expanded', String(this.expanded));
            this.body.hidden = !this.expanded;
            this.icon.textContent = this.expanded ? '▾' : '▴';
            this.summary.textContent = this.courses.size ? `(${this.courses.size} ${this.courses.size === 1 ? 'kurs' : 'kurser'})` : '';
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
                && !selectionPage.closest('[aria-busy="true"]') && !selectionPage.querySelector('[aria-busy="true"]')) {
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
            const content = document.createDocumentFragment();
            if (!this.courses.size) {
                content.append(element('p', 'timeline-empty', 'Lägg till kurser på Antagning.se för att se din tidslinje.'));
            } else {
                content.append(element('p', 'timeline-note', 'Veckor används från kursinformationen när den finns. Annars uppskattas längden från poäng och studietakt. Terminsöversikten använder ungefärliga terminsgränser.'));
                const legend = element('div', 'timeline-legend');
                for (const [pace, color] of COLORS) {
                    const item = element('span', 'timeline-legend-item');
                    const swatch = element('span', 'timeline-swatch');
                    swatch.style.backgroundColor = color;
                    item.append(swatch, document.createTextNode(`${pace} %`));
                    legend.append(item);
                }
                content.append(legend);
                const terms = new Map();
                for (const course of this.courses.values()) {
                    if (!terms.has(course.termKey)) terms.set(course.termKey, []);
                    terms.get(course.termKey).push(course);
                }
                const order = key => Number(key.slice(2)) * 10 + { VT: 1, ST: 2, HT: 3 }[key.slice(0, 2)];
                for (const termKey of [...terms.keys()].sort((a, b) => order(a) - order(b))) {
                    content.append(this.renderTerm(termKey, terms.get(termKey)));
                }
            }
            this.body.replaceChildren(content);
        }

        renderTerm(termKey, courses) {
            const config = termConfig(termKey);
            const length = config.end - config.start + 1;
            const section = element('section', 'timeline-term');
            const header = element('div', 'timeline-term-header');
            header.append(element('h3', '', `${termKey.slice(0, 2)} ${termKey.slice(2)}`),
                element('span', '', `Totalt: ${number(courses.reduce((sum, course) => sum + course.hp, 0))} hp`));
            const weeks = element('div', 'timeline-weeks');
            weeks.append(element('span', '', `v.${weekLabel(config.start, termKey)}`),
                element('span', '', `v.${weekLabel(config.start + 10, termKey)}`),
                element('span', '', `v.${weekLabel(config.end, termKey)}`));
            section.append(header, weeks);
            for (const course of courses) {
                const row = element('div', 'course-timeline-item');
                row.dataset.courseId = course.id;
                const label = `${course.name} (${number(course.hp)} hp) — v.${weekLabel(course.startWeek, termKey)}–${weekLabel(course.endWeek, termKey)}${course.estimated ? ' (uppskattat)' : ''}`;
                row.title = label;
                const bar = element('div', 'course-progress');
                const start = Math.max(config.start, course.startWeek);
                const end = Math.min(config.end, course.endWeek);
                bar.style.left = `${Math.min(100, Math.max(0, (start - config.start) / length * 100))}%`;
                bar.style.width = `${Math.max(0, (end - start + 1) / length * 100)}%`;
                bar.style.backgroundColor = COLORS.get(course.studietakt) || '#607d8b';
                if (course.endWeek > config.end) bar.classList.add('timeline-overflow');
                bar.setAttribute('aria-hidden', 'true');
                row.append(bar, element('span', 'course-label', label));
                section.append(row);
            }
            section.append(this.renderLoad(termKey, courses, config));
            return section;
        }

        renderLoad(termKey, courses, config) {
            const load = Array.from({ length: config.end - config.start + 1 }, (_, index) => {
                const week = config.start + index;
                return courses.filter(course => course.startWeek <= week && course.endWeek >= week)
                    .reduce((sum, course) => sum + course.hp / course.durationWeeks, 0);
            });
            const total = load.reduce((sum, hp) => sum + hp, 0);
            const summary = element('div', 'timeline-load');
            const heading = element('div', 'timeline-load-heading');
            heading.append(element('strong', '', 'Studietakt'), element('span', '',
                `Genomsnitt: ${number(total / load.length / HP_PER_WEEK * 100)} % — ${number(total)} hp inom terminen`));
            summary.append(heading, element('p', 'timeline-note', '100 % motsvarar 1,5 hp/vecka. Streckat slut på en stapel betyder att kursen fortsätter efter översiktens terminsgräns.'));
            for (let i = 0; i < load.length;) {
                let end = i;
                while (end + 1 < load.length && Math.abs(load[end + 1] - load[i]) < 0.00001) end++;
                if (load[i] > 0) {
                    const row = element('div', 'timeline-load-row');
                    row.append(element('span', '', `v.${weekLabel(config.start + i, termKey)}–${weekLabel(config.start + end, termKey)}`),
                        element('span', '', `${number(load[i] / HP_PER_WEEK * 100)} % — ${number(load[i])} hp/v`));
                    summary.append(row);
                }
                i = end + 1;
            }
            return summary;
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
