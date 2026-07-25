/* factory1_ipgo_render.js — 1공장 입고 UI 렌더링 및 제어
   ────────────────────────────────────────────────────────────────
   현재는 레이아웃 확인 단계입니다. 행은 날짜만 실제로 채우고
   품목/계획 값은 모두 빈 값('-')으로 표시합니다. DB 연동 시
   buildRows() 내부만 실제 조회 결과로 교체하면 됩니다.

   좌측(입고 대장)과 우측(별쇄 계획표) 두 패널은 행이 1:1로 대응되며
   스크롤이 서로 동기화되어 같이 움직입니다.
   ──────────────────────────────────────────────────────────────── */
(function () {
    'use strict';

    const App = window.Factory1Ipgo;
    if (!App) return;

    const state = App.state;
    const PANELS = App.PANELS;
    const LEDGER = PANELS[0];   // 좌측: 입고 대장 (스크롤 페이징 기준 패널)

    function panelByIdx(idx) {
        return PANELS.find(p => String(p.idx) === String(idx)) || LEDGER;
    }

    function columnsOf(idx) {
        return String(idx) === '2' ? App.PLAN_COLUMNS : App.COLUMNS;
    }

    function pad(n) { return String(n).padStart(2, '0'); }

    function todayStr() {
        const t = new Date();
        return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
    }

    function addDays(dateStr, diff) {
        const d = new Date(dateStr + 'T00:00:00');
        d.setDate(d.getDate() + diff);
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    }

    function fmtDateShort(dateStr) {
        const d = new Date(dateStr + 'T00:00:00');
        return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} (${App.WD_KR[d.getDay()]})`;
    }

    function weekdayKr(dateStr) {
        const d = new Date(dateStr + 'T00:00:00');
        return App.WD_KR[d.getDay()];
    }

    function fmtVal(v) {
        if (v === '' || v === null || v === undefined) return '<span class="f1ip-empty">-</span>';
        const n = Number(v);
        if (isNaN(n)) return '<span class="f1ip-empty">-</span>';
        return n.toLocaleString();
    }

    App.setReadOnlyMode = function (isReadOnly) {
        const wrapper = App.elements.wrapper;
        if (!wrapper) return;
    };

    /* ────────────────────────────────────────────────────────────
       스크롤 잠금 / 패널 간 스크롤 동기화
       ──────────────────────────────────────────────────────────── */
    function updateScrollLockUI() {
        PANELS.forEach(p => {
            const el = document.getElementById(p.scrollId);
            if (!el) return;
            if (state.isScrollUnlocked) el.classList.remove('locked');
            else el.classList.add('locked');
        });
    }

    function bindScrollToggle() {
        const toggle = document.getElementById('ipgoScrollToggle');
        if (!toggle) return;

        toggle.checked = !!state.isScrollUnlocked;
        updateScrollLockUI();

        toggle.addEventListener('change', (e) => {
            state.isScrollUnlocked = e.target.checked;
            updateScrollLockUI();
        });
    }

    function bindScrollSync() {
        PANELS.forEach(p => {
            const el = document.getElementById(p.scrollId);
            if (!el) return;

            // 스크롤 잠금 상태 시 마우스 휠 동작 차단
            el.addEventListener('wheel', (e) => {
                if (!state.isScrollUnlocked) e.preventDefault();
            }, { passive: false });

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
                if (el.scrollTop + el.clientHeight >= el.scrollHeight - threshold) App.loadRows('next');
                if (el.scrollTop <= threshold) App.loadRows('prev');
            });
        });
    }

    function scrollAllPanels(top, smooth) {
        PANELS.forEach(p => {
            const el = document.getElementById(p.scrollId);
            if (!el) return;
            if (smooth) el.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
            else el.scrollTop = Math.max(0, top);
        });
    }

    /* 레이아웃이 확정된 뒤 위치를 다시 잡아야 하지만, 백그라운드 탭에서는
       requestAnimationFrame 이 실행되지 않아 위치 지정이 누락됩니다.
       → 즉시 한 번 적용하고, rAF에서 한 번 더 보정합니다. */
    function applyScrollTwice(computeTop, smooth) {
        scrollAllPanels(computeTop(), smooth);
        requestAnimationFrame(() => scrollAllPanels(computeTop(), smooth));
    }

    /* ────────────────────────────────────────────────────────────
       셀 선택 커서 / 강조
       ──────────────────────────────────────────────────────────── */
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
        cursorEl.style.width = td.offsetWidth + 'px';
        cursorEl.style.height = td.offsetHeight + 'px';
        cursorEl.style.left = pos.left + 'px';
        cursorEl.style.top = pos.top + 'px';
        cursorEl.classList.add('active');
    }

    function clearHighlights() {
        document.querySelectorAll('.f1ip-selected-row').forEach(el => el.classList.remove('f1ip-selected-row'));
        document.querySelectorAll('.f1ip-selected-cell').forEach(el => el.classList.remove('f1ip-selected-cell'));
        document.querySelectorAll('.f1ip-header-active').forEach(el => el.classList.remove('f1ip-header-active'));
        hideCursors();
    }

    function applyHighlight(panelIdx, dateStr, colNum) {
        clearHighlights();
        state.selectedDate = dateStr;
        state.selectedPanel = panelIdx;
        state.selectedCol = colNum;

        // 행 강조는 두 패널 모두 적용 (같은 날짜 행이 함께 강조됨)
        PANELS.forEach(p => {
            const body = document.getElementById(p.bodyId);
            if (!body) return;
            const row = body.querySelector(`tr[data-date="${dateStr}"]`);
            if (row) row.classList.add('f1ip-selected-row');
        });

        if (colNum === null || colNum === undefined) return;

        const panel = panelByIdx(panelIdx);
        const body = document.getElementById(panel.bodyId);
        const scrollPanel = document.getElementById(panel.scrollId);
        if (!body || !scrollPanel) return;

        const row = body.querySelector(`tr[data-date="${dateStr}"]`);
        if (!row) return;

        const targetTd = row.querySelector(`td[data-col="${colNum}"]`);
        if (targetTd) {
            targetTd.classList.add('f1ip-selected-cell');
            showCursor(panelIdx, targetTd);
        }

        // 헤더 강조는 "선택한 열의 1레벨 + 2레벨" 두 칸만
        const colDef = columnsOf(panelIdx).find(c => String(c.col) === String(colNum));
        if (colDef) {
            const groupTh = scrollPanel.querySelector(`.f1ip-group-th[data-group="${colDef.group}"]`);
            if (groupTh) groupTh.classList.add('f1ip-header-active');
        }

        const leafTh = scrollPanel.querySelector(`.f1ip-leaf-th[data-col="${colNum}"]`);
        if (leafTh) leafTh.classList.add('f1ip-header-active');
    }

    function bindBodyClicks() {
        PANELS.forEach(p => {
            const body = document.getElementById(p.bodyId);
            if (!body) return;

            body.addEventListener('click', e => {
                const td = e.target.closest('td');
                if (!td) return;
                const tr = td.closest('tr[data-date]');
                if (!tr) return;

                // 날짜 셀 클릭 시에는 행만 강조
                if (td.classList.contains('f1ip-date-td')) {
                    applyHighlight(p.idx, tr.getAttribute('data-date'), null);
                    return;
                }
                applyHighlight(p.idx, tr.getAttribute('data-date'), td.getAttribute('data-col'));
            });
        });
    }

    function bindKeyboardNav() {
        document.addEventListener('keydown', e => {
            if (!state.selectedDate || state.selectedCol === null) return;
            if (!App.elements.wrapper || !document.body.contains(App.elements.wrapper)) return;
            if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
            e.preventDefault();

            let panelIdx = Number(state.selectedPanel) || 1;
            let colNum = Number(state.selectedCol);
            const dateStr = state.selectedDate;

            const body = document.getElementById(panelByIdx(panelIdx).bodyId);
            if (!body) return;
            const currentRow = body.querySelector(`tr[data-date="${dateStr}"]`);
            if (!currentRow) return;

            const maxCol = columnsOf(panelIdx).length;

            if (e.key === 'ArrowUp') {
                const prev = currentRow.previousElementSibling;
                if (prev && prev.getAttribute('data-date')) applyHighlight(panelIdx, prev.getAttribute('data-date'), String(colNum));
            } else if (e.key === 'ArrowDown') {
                const next = currentRow.nextElementSibling;
                if (next && next.getAttribute('data-date')) applyHighlight(panelIdx, next.getAttribute('data-date'), String(colNum));
            } else if (e.key === 'ArrowLeft') {
                colNum--;
                if (colNum < 1) {
                    // 우측 패널 첫 열에서 왼쪽 → 좌측 패널 마지막 열로 이동
                    if (panelIdx > 1) { panelIdx--; colNum = columnsOf(panelIdx).length; }
                    else colNum = 1;
                }
                applyHighlight(panelIdx, dateStr, String(colNum));
            } else if (e.key === 'ArrowRight') {
                colNum++;
                if (colNum > maxCol) {
                    // 좌측 패널 마지막 열에서 오른쪽 → 우측 패널 첫 열로 이동
                    if (panelIdx < PANELS.length) { panelIdx++; colNum = 1; }
                    else colNum = maxCol;
                }
                applyHighlight(panelIdx, dateStr, String(colNum));
            }
        });
    }

    /* ────────────────────────────────────────────────────────────
       행 렌더링
       ──────────────────────────────────────────────────────────── */
    function rowClasses(r) {
        const isToday = (r.date === todayStr());
        return isToday ? 'f1ip-row-today f1ip-data-row' : 'f1ip-data-row';
    }

    function dateCellHtml(r, extraCls) {
        let dateCls = '';
        if (r.weekday === '토') dateCls = 'f1ip-sat';
        else if (r.weekday === '일') dateCls = 'f1ip-sun';
        return `<td class="f1ip-date-td ${dateCls} ${extraCls || ''}">${fmtDateShort(r.date)}</td>`;
    }

    /* 좌측: 입고 대장 행 */
    function ledgerRowHtml(r) {
        let cells = '';
        App.COLUMNS.forEach(c => {
            const sepCls = c.sep ? ' f1ip-sep' : '';
            cells += `<td class="f1ip-data-cell${sepCls}" data-col="${c.col}">${fmtVal(r.values[c.col])}</td>`;
        });

        return `<tr class="${rowClasses(r)}" data-date="${r.date}">
            ${dateCellHtml(r)}
            ${cells}
        </tr>`;
    }

    /* 우측: 별쇄 계획표 행 (날짜 셀은 좁은 화면에서만 표시) */
    function planRowHtml(r) {
        let cells = '';
        App.PLAN_COLUMNS.forEach(c => {
            cells += `<td class="f1ip-data-cell" data-col="${c.col}">${fmtVal(r.plan[c.col])}</td>`;
        });

        return `<tr class="${rowClasses(r)}" data-date="${r.date}">
            ${dateCellHtml(r, 'f1ip-responsive-date')}
            ${cells}
        </tr>`;
    }

    function htmlFor(panelIdx, rows) {
        const fn = String(panelIdx) === '2' ? planRowHtml : ledgerRowHtml;
        return rows.map(fn).join('');
    }

    /* 레이아웃 확인용 빈 행 생성 — DB 연동 시 이 함수를 실제 조회로 교체 */
    function buildRows(from, to) {
        const rows = [];
        for (let d = from; d <= to; d = addDays(d, 1)) {
            rows.push({ date: d, weekday: weekdayKr(d), values: {}, plan: {} });
        }
        return rows;
    }

    App.loadRows = async function (direction) {
        if (state.loading) return;
        if (direction === 'next' && !state.hasNext) return;
        if (direction === 'prev' && !state.hasPrev) return;

        state.loading = true;

        const ledgerPanel = document.getElementById(LEDGER.scrollId);
        const ledgerBody = document.getElementById(LEDGER.bodyId);
        if (!ledgerPanel || !ledgerBody) { state.loading = false; return; }

        const today = todayStr();
        const minDate = addDays(today, -App.MAX_PAST_DAYS);
        const maxDate = addDays(today, App.FUTURE_ROWS_BELOW_TODAY);

        let baseDate = state.baseDate || today;
        if (direction !== 'none' && ledgerBody.children.length > 0) {
            if (direction === 'next') baseDate = ledgerBody.lastElementChild.getAttribute('data-date');
            else if (direction === 'prev') baseDate = ledgerBody.firstElementChild.getAttribute('data-date');
        }

        let from, to;
        if (direction === 'next') {
            from = addDays(baseDate, 1);
            to = addDays(baseDate, App.RANGE);
        } else if (direction === 'prev') {
            from = addDays(baseDate, -App.RANGE);
            to = addDays(baseDate, -1);
        } else {
            from = addDays(baseDate, -App.RANGE);
            to = addDays(baseDate, App.RANGE);
        }

        if (to > maxDate) to = maxDate;
        if (from < minDate) from = minDate;

        if (from > to) {
            if (direction === 'next') state.hasNext = false;
            if (direction === 'prev') state.hasPrev = false;
            state.loading = false;
            return;
        }

        const rows = buildRows(from, to);
        const prevScrollHeight = ledgerPanel.scrollHeight;
        const prevScrollTop = ledgerPanel.scrollTop;

        if (direction === 'none') {
            PANELS.forEach(p => {
                const body = document.getElementById(p.bodyId);
                if (body) body.innerHTML = htmlFor(p.idx, rows);
            });

            // 오늘 행이 '아래에서 두 번째 줄'에 오도록 스크롤
            // (오늘 아래로 FUTURE_ROWS_BELOW_TODAY 만큼의 행이 남습니다)
            const todayRow = ledgerBody.querySelector(`tr[data-date="${today}"]`) || ledgerBody.lastElementChild;
            if (todayRow) {
                applyScrollTwice(() => {
                    const rowH = todayRow.offsetHeight;
                    const keepBelow = App.FUTURE_ROWS_BELOW_TODAY * rowH;
                    return todayRow.offsetTop + rowH + keepBelow - ledgerPanel.clientHeight;
                }, true);
            }

            if (state.isInitialLoad) {
                state.isInitialLoad = false;
                setTimeout(() => {
                    const row = ledgerBody.querySelector(`tr[data-date="${today}"]`) || ledgerBody.lastElementChild;
                    if (row) applyHighlight(1, row.getAttribute('data-date'), '1');
                }, 150);
            }

        } else if (direction === 'next') {
            PANELS.forEach(p => {
                const body = document.getElementById(p.bodyId);
                if (body) body.insertAdjacentHTML('beforeend', htmlFor(p.idx, rows));
            });

        } else if (direction === 'prev') {
            PANELS.forEach(p => {
                const body = document.getElementById(p.bodyId);
                if (body) body.insertAdjacentHTML('afterbegin', htmlFor(p.idx, rows));
            });

            applyScrollTwice(() => prevScrollTop + (ledgerPanel.scrollHeight - prevScrollHeight), false);
        }

        state.loading = false;
    };

    /* ────────────────────────────────────────────────────────────
       공통 라우터 훅
       ──────────────────────────────────────────────────────────── */
    App.loadData = async function (dateStr) {
        if (App.headerApi && App.headerApi.isEditMode && App.headerApi.isEditMode()) {
            App.headerApi.toggleEditMode();
        }

        state.baseDate = dateStr || state.baseDate || todayStr();
        state.hasNext = true;
        state.hasPrev = true;
        state.isInitialLoad = true;

        await App.loadRows('none');
        state.isChanged = false;
    };

    App.saveData = async function () {
        // 입고 DB 연동 전이므로 저장 동작 없음
        state.isChanged = false;
        if (App.headerApi && App.headerApi.toggleEditMode) App.headerApi.toggleEditMode();
    };

    App.initUI = function () {
        bindScrollToggle();
        bindScrollSync();
        bindBodyClicks();
        bindKeyboardNav();
    };

})();
