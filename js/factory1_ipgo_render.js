/* factory1_ipgo_render.js — 1공장 입고 UI 렌더링 및 제어
   ────────────────────────────────────────────────────────────────
   현재는 레이아웃 확인 단계입니다. 행은 날짜만 실제로 채우고
   품목 값은 모두 빈 값('-')으로 표시합니다. DB 연동 시
   loadRows() 내부의 행 생성 부분만 실제 조회 결과로 교체하면 됩니다.
   ──────────────────────────────────────────────────────────────── */
(function () {
    'use strict';

    const App = window.Factory1Ipgo;
    if (!App) return;

    const state = App.state;
    const PANEL_ID = 'f1ipScrollPanel';
    const BODY_ID = 'f1ipBody';

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
       스크롤 잠금 / 해제
       ──────────────────────────────────────────────────────────── */
    function updateScrollLockUI() {
        const el = document.getElementById(PANEL_ID);
        if (!el) return;
        if (state.isScrollUnlocked) el.classList.remove('locked');
        else el.classList.add('locked');
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

    function bindScroll() {
        const el = document.getElementById(PANEL_ID);
        if (!el) return;

        // 스크롤 잠금 상태 시 마우스 휠 동작 차단
        el.addEventListener('wheel', (e) => {
            if (!state.isScrollUnlocked) e.preventDefault();
        }, { passive: false });

        el.addEventListener('scroll', () => {
            if (!state.isScrollUnlocked) return;
            hideCursor();

            const threshold = 100;
            if (el.scrollTop + el.clientHeight >= el.scrollHeight - threshold) App.loadRows('next');
            if (el.scrollTop <= threshold) App.loadRows('prev');
        });
    }

    /* ────────────────────────────────────────────────────────────
       셀 선택 커서 / 강조
       ──────────────────────────────────────────────────────────── */
    function hideCursor() {
        const c = document.getElementById('f1ipCursor');
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
        const cursorEl = document.getElementById('f1ipCursor');
        const panelEl = document.getElementById(PANEL_ID);
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
        hideCursor();
    }

    function applyHighlight(dateStr, colNum) {
        clearHighlights();
        state.selectedDate = dateStr;
        state.selectedCol = colNum;

        const body = document.getElementById(BODY_ID);
        if (!body) return;

        const row = body.querySelector(`tr[data-date="${dateStr}"]`);
        if (row) row.classList.add('f1ip-selected-row');
        if (!row || colNum === null) return;

        const targetTd = row.querySelector(`td[data-col="${colNum}"]`);
        if (targetTd) {
            targetTd.classList.add('f1ip-selected-cell');
            showCursor(targetTd);
        }

        // 헤더 강조는 "선택한 열의 1레벨(거래처) + 2레벨" 두 칸만
        const panel = document.getElementById(PANEL_ID);
        if (!panel) return;

        const colDef = App.COLUMNS.find(c => String(c.col) === String(colNum));
        if (colDef) {
            const groupTh = panel.querySelector(`.f1ip-group-th[data-group="${colDef.group}"]`);
            if (groupTh) groupTh.classList.add('f1ip-header-active');
        }

        const leafTh = panel.querySelector(`.f1ip-leaf-th[data-col="${colNum}"]`);
        if (leafTh) leafTh.classList.add('f1ip-header-active');
    }

    function bindBodyClicks() {
        const body = document.getElementById(BODY_ID);
        if (!body) return;

        body.addEventListener('click', e => {
            const td = e.target.closest('td');
            if (!td) return;
            const tr = td.closest('tr[data-date]');
            if (!tr) return;

            // 날짜 셀 클릭 시에는 행만 강조
            if (td.classList.contains('f1ip-date-td')) {
                applyHighlight(tr.getAttribute('data-date'), null);
                return;
            }
            applyHighlight(tr.getAttribute('data-date'), td.getAttribute('data-col'));
        });
    }

    function bindKeyboardNav() {
        document.addEventListener('keydown', e => {
            if (!state.selectedDate || state.selectedCol === null) return;
            if (!App.elements.wrapper || !document.body.contains(App.elements.wrapper)) return;
            if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
            e.preventDefault();

            let colNum = Number(state.selectedCol);
            const dateStr = state.selectedDate;
            const maxCol = App.COLUMNS.length;

            const body = document.getElementById(BODY_ID);
            if (!body) return;
            const currentRow = body.querySelector(`tr[data-date="${dateStr}"]`);
            if (!currentRow) return;

            if (e.key === 'ArrowUp') {
                const prev = currentRow.previousElementSibling;
                if (prev && prev.getAttribute('data-date')) applyHighlight(prev.getAttribute('data-date'), String(colNum));
            } else if (e.key === 'ArrowDown') {
                const next = currentRow.nextElementSibling;
                if (next && next.getAttribute('data-date')) applyHighlight(next.getAttribute('data-date'), String(colNum));
            } else if (e.key === 'ArrowLeft') {
                applyHighlight(dateStr, String(Math.max(1, colNum - 1)));
            } else if (e.key === 'ArrowRight') {
                applyHighlight(dateStr, String(Math.min(maxCol, colNum + 1)));
            }
        });
    }

    /* ────────────────────────────────────────────────────────────
       행 렌더링
       ──────────────────────────────────────────────────────────── */
    function rowHtml(r) {
        const isToday = (r.date === todayStr());
        const trCls = isToday ? 'f1ip-row-today f1ip-data-row' : 'f1ip-data-row';

        let dateCls = '';
        if (r.weekday === '토') dateCls = 'f1ip-sat';
        else if (r.weekday === '일') dateCls = 'f1ip-sun';

        let cells = '';
        App.COLUMNS.forEach(c => {
            const sepCls = c.sep ? ' f1ip-sep' : '';
            cells += `<td class="f1ip-data-cell${sepCls}" data-col="${c.col}">${fmtVal(r.values[c.col])}</td>`;
        });

        return `<tr class="${trCls}" data-date="${r.date}">
            <td class="f1ip-date-td ${dateCls}">${fmtDateShort(r.date)}</td>
            ${cells}
        </tr>`;
    }

    /* 레이아웃 확인용 빈 행 생성 — DB 연동 시 이 함수를 실제 조회로 교체 */
    function buildRows(from, to) {
        const rows = [];
        for (let d = from; d <= to; d = addDays(d, 1)) {
            rows.push({ date: d, weekday: weekdayKr(d), values: {} });
        }
        return rows;
    }

    App.loadRows = async function (direction) {
        if (state.loading) return;
        if (direction === 'next' && !state.hasNext) return;
        if (direction === 'prev' && !state.hasPrev) return;

        state.loading = true;

        const panel = document.getElementById(PANEL_ID);
        const body = document.getElementById(BODY_ID);
        if (!panel || !body) { state.loading = false; return; }

        const today = todayStr();
        const minDate = addDays(today, -App.MAX_PAST_DAYS);

        let baseDate = state.baseDate || today;
        if (direction !== 'none' && body.children.length > 0) {
            if (direction === 'next') baseDate = body.lastElementChild.getAttribute('data-date');
            else if (direction === 'prev') baseDate = body.firstElementChild.getAttribute('data-date');
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

        if (to > today) to = today;
        if (from < minDate) from = minDate;

        if (from > to) {
            if (direction === 'next') state.hasNext = false;
            if (direction === 'prev') state.hasPrev = false;
            state.loading = false;
            return;
        }

        const rows = buildRows(from, to);
        const html = rows.map(rowHtml).join('');
        const prevScrollHeight = panel.scrollHeight;
        const prevScrollTop = panel.scrollTop;

        if (direction === 'none') {
            body.innerHTML = html;

            // 최신 행(하단)이 보이도록 스크롤
            let targetRow = body.querySelector(`tr[data-date="${today}"]`) || body.lastElementChild;
            if (targetRow) {
                requestAnimationFrame(() => {
                    const top = targetRow.offsetTop + targetRow.offsetHeight - panel.clientHeight;
                    panel.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
                });
            }

            if (state.isInitialLoad) {
                state.isInitialLoad = false;
                setTimeout(() => {
                    const row = body.querySelector(`tr[data-date="${today}"]`) || body.lastElementChild;
                    if (row) applyHighlight(row.getAttribute('data-date'), '1');
                }, 150);
            }

        } else if (direction === 'next') {
            body.insertAdjacentHTML('beforeend', html);

        } else if (direction === 'prev') {
            body.insertAdjacentHTML('afterbegin', html);
            requestAnimationFrame(() => {
                const diff = panel.scrollHeight - prevScrollHeight;
                panel.scrollTop = prevScrollTop + diff;
            });
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
        bindScroll();
        bindBodyClicks();
        bindKeyboardNav();
    };

})();
