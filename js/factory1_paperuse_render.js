/* factory1_paperuse_render.js — 1공장 사용량 [1층] 용지별 사용량 렌더링
   ────────────────────────────────────────────────────────────────
   입고 페이지(factory1_ipgo_render.js)의 스크롤 페이징 구조를 따르되,
   조회 전용이라 편집/메모/변경분 추적이 전부 빠졌습니다.

   입고와 다른 점이 하나 있습니다. 입고는 미래 날짜에 계획을 미리 적지만
   사용량은 이미 지난 실적이라 미래 행이 의미가 없습니다. 그래서 오늘을
   마지막 행으로 두고, 위로 스크롤해 과거를 불러오는 방향만 씁니다.
   ──────────────────────────────────────────────────────────────── */
(function () {
    'use strict';

    const App = window.Factory1PaperUse;
    if (!App) return;

    const state = App.state;
    const PANEL = App.PANELS[0];

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
        const bucket = (c.source === 'factory3') ? state.factory3 : state.usage;
        const row = bucket[dateStr];
        if (!row) return null;
        const v = row[c.erpCode];
        return (v === undefined) ? null : v;
    }

    /* ── 스크롤 잠금 ───────────────────────────────────────────── */
    function updateScrollLockUI() {
        const el = document.getElementById(PANEL.scrollId);
        if (!el) return;
        if (state.isScrollUnlocked) el.classList.remove('locked');
        else el.classList.add('locked');
    }

    function bindScrollToggle() {
        const toggle = document.getElementById('f1usPaperScrollToggle');
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
    function bindScroll() {
        const el = document.getElementById(PANEL.scrollId);
        if (!el) return;

        el.addEventListener('scroll', () => {
            if (!state.isScrollUnlocked) return;
            hideCursor();
            const threshold = 100;
            if (el.scrollTop <= threshold) App.loadRows('prev');
            if (el.scrollTop + el.clientHeight >= el.scrollHeight - threshold) App.loadRows('next');
        });
    }

    function scrollPanel(top) {
        const el = document.getElementById(PANEL.scrollId);
        if (el) el.scrollTop = Math.max(0, top);
    }

    /* 레이아웃이 확정된 뒤 위치를 다시 잡아야 하지만, 백그라운드 탭에서는
       requestAnimationFrame 이 실행되지 않아 위치 지정이 누락됩니다.
       → 즉시 한 번 적용하고 rAF 에서 한 번 더 보정합니다. */
    function applyScrollTwice(computeTop) {
        scrollPanel(computeTop());
        requestAnimationFrame(() => scrollPanel(computeTop()));
    }

    /* ── 셀 선택 커서 / 강조 ───────────────────────────────────── */
    function hideCursor() {
        const c = document.getElementById(PANEL.cursorId);
        if (c) c.classList.remove('active');
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

    function showCursor(td) {
        const cursorEl = document.getElementById(PANEL.cursorId);
        const panelEl = document.getElementById(PANEL.scrollId);
        if (!cursorEl || !panelEl || !td) return;

        const pos = getOffsetRelativeToPanel(td, panelEl);
        cursorEl.style.top = `${pos.top}px`;
        cursorEl.style.left = `${pos.left}px`;
        cursorEl.style.width = `${td.offsetWidth}px`;
        cursorEl.style.height = `${td.offsetHeight}px`;
        cursorEl.classList.add('active');
    }

    function clearHighlights() {
        const scrollPanelEl = document.getElementById(PANEL.scrollId);
        if (!scrollPanelEl) return;

        scrollPanelEl.querySelectorAll('.f1us-header-active')
            .forEach(el => el.classList.remove('f1us-header-active'));

        const body = document.getElementById(PANEL.bodyId);
        if (body) {
            body.querySelectorAll('.f1us-selected-row')
                .forEach(el => el.classList.remove('f1us-selected-row'));
            body.querySelectorAll('.f1us-selected-cell')
                .forEach(el => el.classList.remove('f1us-selected-cell'));
        }
        hideCursor();
    }

    function applyHighlight(dateStr, colNum) {
        clearHighlights();
        state.selectedDate = dateStr;
        state.selectedCol = colNum;

        /* 선택한 행의 날짜를 상단 공통 헤더에 반영합니다.
           두 번째 인자 false = 표를 다시 불러오지 않고 표시만 갱신.
           (true 로 주면 onDateChange 가 돌아 표가 통째로 다시 그려지면서
            방금 클릭한 위치로 스크롤이 튑니다) */
        if (dateStr && App.headerApi && App.headerApi.setCurrentDate) {
            App.headerApi.setCurrentDate(dateStr, false);
        }

        const body = document.getElementById(PANEL.bodyId);
        const scrollPanelEl = document.getElementById(PANEL.scrollId);
        if (!body || !scrollPanelEl) return;

        const row = body.querySelector(`tr[data-date="${dateStr}"]`);
        if (!row) return;
        row.classList.add('f1us-selected-row');

        // 날짜 칸을 클릭했을 때는 행만 강조하고 셀 커서는 띄우지 않습니다.
        if (colNum === null || colNum === undefined) return;

        const targetTd = row.querySelector(`td[data-col="${colNum}"]`);
        if (targetTd) {
            targetTd.classList.add('f1us-selected-cell');
            showCursor(targetTd);
        }

        const colDef = App.COLUMNS.find(c => String(c.col) === String(colNum));
        if (colDef) {
            const groupTh = scrollPanelEl.querySelector(`.f1us-group-th[data-group="${colDef.group}"]`);
            if (groupTh) groupTh.classList.add('f1us-header-active');
        }
        const leafTh = scrollPanelEl.querySelector(`.f1us-leaf-th[data-col="${colNum}"]`);
        if (leafTh) leafTh.classList.add('f1us-header-active');
    }

    function bindBodyClicks() {
        const body = document.getElementById(PANEL.bodyId);
        if (!body) return;

        body.addEventListener('click', (e) => {
            const td = e.target.closest('td');
            if (!td) return;
            const tr = td.closest('tr[data-date]');
            if (!tr) return;

            const dateStr = tr.getAttribute('data-date');

            // 날짜 셀 클릭 시에는 행만 강조 (입고 페이지와 동일한 동작)
            if (td.classList.contains('f1us-date-td')) {
                applyHighlight(dateStr, null);
                return;
            }
            applyHighlight(dateStr, td.getAttribute('data-col'));
        });
    }

    /* ── 행 렌더링 ─────────────────────────────────────────────── */
    function rowClasses(r) {
        return (r.date === yesterdayStr()) ? 'f1us-row-yesterday f1us-data-row' : 'f1us-data-row';
    }

    function rowHtml(r) {
        let cells = '';
        App.COLUMNS.forEach(c => {
            const sepCls = c.sep ? ' f1us-sep' : '';
            const mirrorCls = (c.source === 'factory3') ? ' f1us-mirror-cell' : '';
            cells += `<td class="f1us-data-cell${sepCls}${mirrorCls}" data-col="${c.col}">${fmtVal(r.values[c.col])}</td>`;
        });

        let dateCls = '';
        if (r.weekday === '토') dateCls = 'f1us-sat';
        else if (r.weekday === '일') dateCls = 'f1us-sun';

        return `<tr class="${rowClasses(r)}" data-date="${r.date}">
            <td class="f1us-date-td ${dateCls}">${fmtDateShort(r.date)}</td>
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

    // 스크롤 영역에 한 번에 보이는 행 수
    function visibleRowCount() {
        const panel = document.getElementById(PANEL.scrollId);
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

        const panel = document.getElementById(PANEL.scrollId);
        const body = document.getElementById(PANEL.bodyId);
        if (!panel || !body) { state.loading = false; return; }

        const latest = yesterdayStr();
        const minDate = addDays(todayStr(), -App.MAX_PAST_DAYS);

        let from, to;
        if (direction === 'prev') {
            const first = body.firstElementChild
                ? body.firstElementChild.getAttribute('data-date')
                : latest;
            from = addDays(first, -App.RANGE);
            to = addDays(first, -1);
        } else if (direction === 'next') {
            const last = body.lastElementChild
                ? body.lastElementChild.getAttribute('data-date')
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
            body.insertAdjacentHTML('afterbegin', rows.map(rowHtml).join(''));
            // 새로 붙은 높이만큼 밀어 화면이 튀지 않게 합니다.
            applyScrollTwice(() => prevScrollTop + (panel.scrollHeight - prevScrollHeight));

        } else if (direction === 'next') {
            body.insertAdjacentHTML('beforeend', rows.map(rowHtml).join(''));

        } else {
            body.innerHTML = rows.map(rowHtml).join('');

            /* 기준일을 맨 아랫줄에 두어 그 앞 4일이 함께 보이게 합니다.
               표가 5줄뿐이라 기준일을 위쪽에 두면 정작 비교할 과거가
               화면 밖으로 밀립니다. (아래로 스크롤하면 이후 날짜가 나옵니다) */
            const baseRow = body.querySelector(`tr[data-date="${state.baseDate}"]`) || body.lastElementChild;
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
                    const row = body.querySelector(`tr[data-date="${state.baseDate}"]`) || body.lastElementChild;
                    if (row) applyHighlight(row.getAttribute('data-date'), '1');
                }, 150);
            }
        }

        state.loading = false;
    };

    /* ── 진입점에서 호출 ───────────────────────────────────────── */
    App.initUI = function () {
        bindScrollToggle();
        bindScroll();
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
