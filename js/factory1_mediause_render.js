/* factory1_mediause_render.js — 1공장 사용량 [2층] 매체별 사용량 렌더링
   ────────────────────────────────────────────────────────────────
   1층(factory1_paperuse_render.js)과 같은 규격입니다. 열 정의만 다르고
   스크롤 페이징 · 셀 커서 · 어제 강조는 동일하게 동작합니다.

   패널이 둘입니다. 좌측이 1공장, 우측이 3공장이며 스크롤이 서로
   동기화되어 같은 날짜 줄이 나란히 붙어 다닙니다.

   1층과 다른 점은 하나입니다. 상단 공통 헤더(달력)는 1층 모듈이
   소유하므로, 여기서는 그 API 를 빌려 쓰기만 합니다.
   ──────────────────────────────────────────────────────────────── */
(function () {
    'use strict';

    const App = window.Factory1MediaUse;
    if (!App) return;

    const state = App.state;
    const PANELS = App.PANELS;
    const MAIN = PANELS[0];   // 좌측 1공장 — 스크롤 페이징의 기준 패널

    function panelByIdx(idx) {
        return PANELS.find(p => String(p.idx) === String(idx)) || MAIN;
    }

    function columnsOf(idx) {
        return App.COLUMNS.filter(c => String(c.panel) === String(idx));
    }

    // 상단 헤더는 1층 모듈이 초기화합니다. 아직 없을 수도 있어 매번 확인합니다.
    function headerApi() {
        return (window.Factory1PaperUse && window.Factory1PaperUse.headerApi) || null;
    }

    /* ── 날짜 · 숫자 유틸 ──────────────────────────────────────── */
    function pad(n) { return String(n).padStart(2, '0'); }

    function todayStr() {
        const t = new Date();
        return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
    }

    /* 사용량 표의 기준은 '오늘'이 아니라 '어제'입니다.
       야간 배치가 어제까지의 급지 실적만 가져오므로 오늘 행은 언제나
       비어 있습니다. 표의 마지막 행도, 파란 강조도 어제에 맞춥니다. */
    function yesterdayStr() {
        const t = new Date();
        t.setDate(t.getDate() - 1);
        return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
    }

    function addDays(dateStr, diff) {
        const d = new Date(dateStr + 'T00:00:00');
        d.setDate(d.getDate() + diff);
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    }

    function fmtDateShort(dateStr) {
        const d = new Date(dateStr + 'T00:00:00');
        return `${d.getMonth() + 1}/${d.getDate()}(${App.WD_KR[d.getDay()]})`;
    }

    function weekdayKr(dateStr) {
        const d = new Date(dateStr + 'T00:00:00');
        return App.WD_KR[d.getDay()];
    }

    // 값이 없는 칸은 0 이 아니라 '–' 입니다. (사용 실적이 없는 날과 0 을 구분)
    function fmtVal(v) {
        if (v === null || v === undefined || v === '' || isNaN(v)) {
            return '<span class="f1us-empty">–</span>';
        }
        return Number(v).toLocaleString('ko-KR');
    }

    function colValue(dateStr, c) {
        if (!c.mediaCode) return null;
        const bucket = (c.source === 'factory3') ? state.factory3 : state.usage;
        const row = bucket[dateStr];
        if (!row) return null;
        const v = row[c.mediaCode];
        return (v === undefined) ? null : v;
    }

    /* ── 스크롤 잠금 / 패널 간 동기화 ──────────────────────────── */
    function updateScrollLockUI() {
        PANELS.forEach(p => {
            const el = document.getElementById(p.scrollId);
            if (!el) return;
            if (state.isScrollUnlocked) el.classList.remove('locked');
            else el.classList.add('locked');
        });
    }

    function bindScrollToggle() {
        const toggle = document.getElementById('f1usMediaScrollToggle');
        if (!toggle) return;

        toggle.checked = !!state.isScrollUnlocked;
        updateScrollLockUI();

        toggle.addEventListener('change', (e) => {
            state.isScrollUnlocked = e.target.checked;
            updateScrollLockUI();
        });
    }

    /* 잠금 상태의 내부 스크롤 차단은 CSS(.f1us-scroll-area.locked)가 맡습니다.
       여기서 wheel 을 preventDefault 하면 페이지 전체 스크롤까지 막힙니다. */
    function bindScrollSync() {
        PANELS.forEach(p => {
            const el = document.getElementById(p.scrollId);
            if (!el) return;

            el.addEventListener('scroll', () => {
                if (!state.isScrollUnlocked) return;
                if (state.syncLock) return;
                state.syncLock = true;

                const srcTop = el.scrollTop;
                PANELS.filter(x => x.scrollId !== p.scrollId).forEach(t => {
                    const tEl = document.getElementById(t.scrollId);
                    if (tEl) tEl.scrollTop = srcTop;
                });

                hideCursors();
                state.syncLock = false;

                const threshold = 100;
                if (el.scrollTop <= threshold) App.loadRows('prev');
                if (el.scrollTop + el.clientHeight >= el.scrollHeight - threshold) App.loadRows('next');
            });
        });
    }

    function scrollAllPanels(top) {
        PANELS.forEach(p => {
            const el = document.getElementById(p.scrollId);
            if (el) el.scrollTop = Math.max(0, top);
        });
    }

    /* 레이아웃이 확정된 뒤 위치를 다시 잡아야 하지만, 백그라운드 탭에서는
       requestAnimationFrame 이 실행되지 않아 위치 지정이 누락됩니다.
       → 즉시 한 번 적용하고 rAF 에서 한 번 더 보정합니다. */
    function applyScrollTwice(computeTop) {
        scrollAllPanels(computeTop());
        requestAnimationFrame(() => scrollAllPanels(computeTop()));
    }

    /* ── 셀 선택 커서 / 강조 ───────────────────────────────────── */
    function hideCursors() {
        PANELS.forEach(p => {
            const c = document.getElementById(p.cursorId);
            if (c) c.classList.remove('active');
        });
    }

    function getOffsetRelativeToPanel(el, panelEl) {
        let top = 0, left = 0;
        let current = el;
        while (current && current !== panelEl) {
            top += current.offsetTop;
            left += current.offsetLeft;
            current = current.offsetParent;
        }
        return { top, left };
    }

    function showCursor(panelIdx, td) {
        const panel = panelByIdx(panelIdx);
        const cursorEl = document.getElementById(panel.cursorId);
        const panelEl = document.getElementById(panel.scrollId);
        if (!cursorEl || !panelEl || !td) return;

        const pos = getOffsetRelativeToPanel(td, panelEl);
        cursorEl.style.top = `${pos.top}px`;
        cursorEl.style.left = `${pos.left}px`;
        cursorEl.style.width = `${td.offsetWidth}px`;
        cursorEl.style.height = `${td.offsetHeight}px`;
        cursorEl.classList.add('active');
    }

    function clearHighlights() {
        PANELS.forEach(p => {
            const scrollEl = document.getElementById(p.scrollId);
            if (scrollEl) {
                scrollEl.querySelectorAll('.f1us-header-active')
                    .forEach(el => el.classList.remove('f1us-header-active'));
            }
            const body = document.getElementById(p.bodyId);
            if (body) {
                body.querySelectorAll('.f1us-selected-row')
                    .forEach(el => el.classList.remove('f1us-selected-row'));
                body.querySelectorAll('.f1us-selected-cell')
                    .forEach(el => el.classList.remove('f1us-selected-cell'));
            }
        });
        hideCursors();
    }

    function applyHighlight(panelIdx, dateStr, colNum) {
        clearHighlights();
        state.selectedDate = dateStr;
        state.selectedCol = colNum;
        state.selectedPanel = panelIdx;

        /* 선택한 행의 날짜를 상단 공통 헤더에 반영합니다.
           두 번째 인자 false = 표를 다시 불러오지 않고 표시만 갱신.
           (true 로 주면 onDateChange 가 돌아 1·2층이 통째로 다시 그려지면서
            방금 클릭한 위치로 스크롤이 튑니다) */
        const api = headerApi();
        if (dateStr && api && api.setCurrentDate) {
            api.setCurrentDate(dateStr, false);
        }

        // 행 강조는 두 패널 모두에 겁니다. 같은 날짜 줄이 나란히 보입니다.
        PANELS.forEach(p => {
            const body = document.getElementById(p.bodyId);
            if (!body) return;
            const row = body.querySelector(`tr[data-date="${dateStr}"]`);
            if (row) row.classList.add('f1us-selected-row');
        });

        // 날짜 칸을 클릭했을 때는 행만 강조하고 셀 커서는 띄우지 않습니다.
        if (colNum === null || colNum === undefined) return;

        const panel = panelByIdx(panelIdx);
        const body = document.getElementById(panel.bodyId);
        const scrollEl = document.getElementById(panel.scrollId);
        if (!body || !scrollEl) return;

        const row = body.querySelector(`tr[data-date="${dateStr}"]`);
        if (!row) return;

        const targetTd = row.querySelector(`td[data-col="${colNum}"]`);
        if (targetTd) {
            targetTd.classList.add('f1us-selected-cell');
            showCursor(panelIdx, targetTd);
        }

        const colDef = columnsOf(panelIdx).find(c => String(c.col) === String(colNum));
        if (colDef) {
            const groupTh = scrollEl.querySelector(`.f1us-group-th[data-group="${colDef.group}"]`);
            if (groupTh) groupTh.classList.add('f1us-header-active');
        }
        const leafTh = scrollEl.querySelector(`.f1us-leaf-th[data-col="${colNum}"]`);
        if (leafTh) leafTh.classList.add('f1us-header-active');
    }

    function bindBodyClicks() {
        PANELS.forEach(p => {
            const body = document.getElementById(p.bodyId);
            if (!body) return;

            body.addEventListener('click', (e) => {
                const td = e.target.closest('td');
                if (!td) return;
                const tr = td.closest('tr[data-date]');
                if (!tr) return;

                const dateStr = tr.getAttribute('data-date');

                // 날짜 셀 클릭 시에는 행만 강조 (1층과 동일한 동작)
                if (td.classList.contains('f1us-date-td')) {
                    applyHighlight(p.idx, dateStr, null);
                    return;
                }
                applyHighlight(p.idx, dateStr, td.getAttribute('data-col'));
            });
        });
    }

    /* ── 행 렌더링 ─────────────────────────────────────────────── */
    function rowClasses(r) {
        return (r.date === yesterdayStr()) ? 'f1us-row-yesterday f1us-data-row' : 'f1us-data-row';
    }

    function rowHtml(panelIdx, r) {
        let cells = '';
        columnsOf(panelIdx).forEach(c => {
            const sepCls = c.sep ? ' f1us-sep' : '';
            const mirrorCls = (c.source === 'factory3') ? ' f1us-mirror-cell' : '';
            cells += `<td class="f1us-data-cell${sepCls}${mirrorCls}" data-col="${c.col}">${fmtVal(r.values[c.col])}</td>`;
        });

        // 날짜 열이 없는 패널(우측)은 데이터 칸만 그립니다.
        // 행 자체에는 data-date 를 남겨 두어야 강조와 선택이 동작합니다.
        let dateTd = '';
        if (!panelByIdx(panelIdx).noDate) {
            let dateCls = '';
            if (r.weekday === '토') dateCls = 'f1us-sat';
            else if (r.weekday === '일') dateCls = 'f1us-sun';
            dateTd = `<td class="f1us-date-td ${dateCls}">${fmtDateShort(r.date)}</td>`;
        }

        return `<tr class="${rowClasses(r)}" data-date="${r.date}">
            ${dateTd}
            ${cells}
        </tr>`;
    }

    function buildRows(from, to) {
        const rows = [];
        for (let d = from; d <= to; d = addDays(d, 1)) {
            const values = {};
            App.COLUMNS.forEach(c => { values[c.col] = colValue(d, c); });
            rows.push({ date: d, weekday: weekdayKr(d), values });
        }
        return rows;
    }

    // 스크롤 영역에 한 번에 보이는 행 수 (기준 패널로 잽니다)
    function visibleRowCount() {
        const panel = document.getElementById(MAIN.scrollId);
        if (!panel) return 10;
        const thead = panel.querySelector('thead');
        const theadH = thead ? thead.getBoundingClientRect().height : 0;
        const rowEl = panel.querySelector('tbody tr');
        const rowH = (rowEl && rowEl.offsetHeight) || 44;
        return Math.max(1, Math.floor((panel.clientHeight - theadH) / rowH));
    }

    App.loadRows = async function (direction) {
        if (state.loading) return;
        if (direction === 'prev' && !state.hasPrev) return;
        if (direction === 'next' && !state.hasNext) return;

        state.loading = true;

        const panel = document.getElementById(MAIN.scrollId);
        const mainBody = document.getElementById(MAIN.bodyId);
        if (!panel || !mainBody) { state.loading = false; return; }

        const latest = yesterdayStr();
        const minDate = addDays(todayStr(), -App.MAX_PAST_DAYS);

        let from, to;
        if (direction === 'prev') {
            const first = mainBody.firstElementChild
                ? mainBody.firstElementChild.getAttribute('data-date')
                : latest;
            from = addDays(first, -App.RANGE);
            to = addDays(first, -1);
        } else if (direction === 'next') {
            const last = mainBody.lastElementChild
                ? mainBody.lastElementChild.getAttribute('data-date')
                : latest;
            from = addDays(last, 1);
            to = addDays(last, App.RANGE);
        } else {
            const base = state.baseDate || latest;
            from = addDays(base, -App.RANGE);
            to = addDays(base, App.RANGE);
        }

        /* 어제까지만 만듭니다. 오늘 행은 실적이 아직 안 들어와 항상 비어 있어
           표에 넣으면 "왜 오늘은 빈칸이냐"는 오해만 남습니다. */
        if (to > latest) to = latest;
        if (from < minDate) from = minDate;

        if (from > to) {
            if (direction === 'prev') state.hasPrev = false;
            if (direction === 'next') state.hasNext = false;
            state.loading = false;
            return;
        }

        const key = `${from}~${to}`;
        if (!state.fetched.has(key)) {
            await App.fetchRange(from, to);
            state.fetched.add(key);
        }

        const rows = buildRows(from, to);
        const prevScrollHeight = panel.scrollHeight;
        const prevScrollTop = panel.scrollTop;

        if (direction === 'prev') {
            PANELS.forEach(p => {
                const body = document.getElementById(p.bodyId);
                if (body) body.insertAdjacentHTML('afterbegin', rows.map(r => rowHtml(p.idx, r)).join(''));
            });
            // 새로 붙은 높이만큼 밀어 화면이 튀지 않게 합니다.
            applyScrollTwice(() => prevScrollTop + (panel.scrollHeight - prevScrollHeight));

        } else if (direction === 'next') {
            PANELS.forEach(p => {
                const body = document.getElementById(p.bodyId);
                if (body) body.insertAdjacentHTML('beforeend', rows.map(r => rowHtml(p.idx, r)).join(''));
            });

        } else {
            PANELS.forEach(p => {
                const body = document.getElementById(p.bodyId);
                if (body) body.innerHTML = rows.map(r => rowHtml(p.idx, r)).join('');
            });

            /* 기준일을 맨 아랫줄에 두어 그 앞 4일이 함께 보이게 합니다.
               (1층과 같은 규칙이라 두 층의 날짜 줄이 서로 맞습니다) */
            const baseRow = mainBody.querySelector(`tr[data-date="${state.baseDate}"]`) || mainBody.lastElementChild;
            if (baseRow) {
                applyScrollTwice(() => {
                    const thead = panel.querySelector('thead');
                    const theadH = thead ? thead.getBoundingClientRect().height : 0;
                    const rowH = baseRow.offsetHeight || 44;
                    const rowTop = getOffsetRelativeToPanel(baseRow, panel).top;
                    return Math.round(rowTop - theadH - (visibleRowCount() - 1) * rowH);
                });
            }

            if (state.isInitialLoad) {
                state.isInitialLoad = false;
                setTimeout(() => {
                    const row = mainBody.querySelector(`tr[data-date="${state.baseDate}"]`) || mainBody.lastElementChild;
                    if (row) applyHighlight(1, row.getAttribute('data-date'), '1');
                }, 150);
            }
        }

        state.loading = false;
    };

    /* ── 진입점에서 호출 ───────────────────────────────────────── */
    App.initUI = function () {
        bindScrollToggle();
        bindScrollSync();
        bindBodyClicks();
    };

    // 상단 달력에서 날짜를 바꾸면 그 날짜를 마지막 행으로 두고 다시 그립니다.
    App.loadData = function (dateStr) {
        state.baseDate = dateStr || yesterdayStr();
        state.hasPrev = true;
        state.hasNext = true;
        clearHighlights();
        App.loadRows('none');
    };

})();
