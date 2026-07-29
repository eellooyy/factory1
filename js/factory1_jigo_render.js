/* factory1_jigo_render.js — 1공장 지고 재고 렌더링
   ────────────────────────────────────────────────────────────────
   사용량 페이지(factory1_paperuse_render.js)의 스크롤 페이징 구조에
   입고 페이지(factory1_ipgo_render.js)의 셀 편집/변경분 추적을 얹은 형태입니다.

   패널이 아니라 '층'이 둘입니다. B5 가 위, B6 가 아래이고 스크롤이 서로
   동기화되어 같은 날짜 줄이 항상 나란히 옵니다. 두 표를 세로로 쌓는 이유가
   바로 이 비교이므로, 스크롤이 어긋나면 레이아웃의 의미가 사라집니다.

   사용량과 다른 점
     - 사용량은 어제가 마지막 줄입니다(야간 배치가 어제까지만 가져오므로).
       여기는 사람이 직접 세어 넣는 값이라 오늘도, 내일도 줄이 있습니다.
     - 조회 전용이 아니라 입력 화면입니다. 수정 모드에서 칸이 <input> 으로
       바뀌고, 원본과 달라진 칸만 dirty 에 담깁니다.

   입고와 다른 점
     - 표시 단위 스위처(R/L ↔ Kg)가 있습니다. 저장은 언제나 롤이고 Kg 은
       표시할 때만 곱합니다. 그래서 수정 모드에 들어가면 단위를 R/L 로
       되돌리고 스위처를 잠급니다. Kg 칸에 숫자를 치면 그게 롤로 저장되어
       조용히 틀린 값이 들어가기 때문입니다.
   ──────────────────────────────────────────────────────────────── */
(function () {
    'use strict';

    const App = window.Factory1JigoInv;
    if (!App) return;

    const state = App.state;
    const FLOORS = App.FLOORS;
    const MAIN = FLOORS[0];   // B5 — 스크롤 페이징의 기준 표

    function floorByKey(key) {
        return FLOORS.find(f => f.key === key) || MAIN;
    }

    /* ── 날짜 유틸 ─────────────────────────────────────────────── */
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
        return `${d.getMonth() + 1}/${d.getDate()}(${App.WD_KR[d.getDay()]})`;
    }

    function weekdayKr(dateStr) {
        const d = new Date(dateStr + 'T00:00:00');
        return App.WD_KR[d.getDay()];
    }

    // 표의 마지막 줄 — 오늘 + 미래 편집 허용 일수(기본 0 = 오늘이 마지막 줄)
    function latestStr() {
        return addDays(todayStr(), App.EDIT_FUTURE_DAYS);
    }

    /* 기준일 — 오늘 아침에 적을 재고가 속한 날, 즉 어제입니다.
       (왜 어제인지는 factory1_jigo_constant.js 의 BASE_OFFSET_DAYS 설명 참고)
       화면을 열면 이 줄이 잡히고 푸른색으로 강조됩니다. 달력으로 다른 날짜를
       봐도 이 강조는 어제 줄에 그대로 남습니다 — "지금 채워야 할 줄"이니까요. */
    function baseDayStr() {
        return addDays(todayStr(), App.BASE_OFFSET_DAYS);
    }
    App.baseDayStr = baseDayStr;

    /* ── 값 유틸 ───────────────────────────────────────────────── */
    function normVal(v) {
        if (v === null || v === undefined || v === '') return 0;
        const n = Number(String(v).replace(/[^\d.-]/g, ''));
        return isNaN(n) ? 0 : n;
    }

    /* 0 과 미입력을 똑같이 '–' 로 그립니다.
       재고는 매일 전량을 다시 세는 값이라, 한 칸을 빠뜨리면 그 층 합계가
       전일 대비 크게 어긋나 재고실사 화면에서 바로 드러납니다. 그래서 화면에서는
       둘을 구분하지 않고 0 을 지워 표를 비웁니다. (숫자가 적을수록 잘 읽힙니다) */
    function fmtVal(v) {
        if (v === null || v === undefined || v === '' || isNaN(v) || Number(v) === 0) {
            return '<span class="f1jg-empty">–</span>';
        }
        return Number(v).toLocaleString('ko-KR');
    }

    function cellKey(floorKey, dateStr, itemCode) {
        return `${floorKey}|${dateStr}|${itemCode}`;
    }

    function cachedVal(floorKey, dateStr, itemCode) {
        const row = state.values[floorKey] && state.values[floorKey][dateStr];
        return row ? row[itemCode] : undefined;
    }

    function snapOf(floorKey, dateStr, itemCode) {
        const row = state.snapshot[floorKey] && state.snapshot[floorKey][dateStr];
        return row ? row[itemCode] : undefined;
    }

    function isCarried(floorKey, dateStr, itemCode) {
        const row = state.carried[floorKey] && state.carried[floorKey][dateStr];
        return !!(row && row[itemCode]);
    }

    /* F.T 3종은 'FT 일지'가 입력 주인입니다. 여기서는 입력칸을 만들지 않고
       저장 대상에서도 빠집니다. (입고 페이지의 별관 참조 열과 같은 처리) */
    function isReadonlyCol(c) {
        return !!c.readonly;
    }

    /* 표시 단위를 적용한 값. Kg 계수를 아직 모르는 열은 Kg 모드에서 '–' 입니다.
       (factory1_paper_item.roll_kg 를 붙이면 전 열이 채워집니다) */
    function displayVal(itemCode, roll) {
        if (roll === null || roll === undefined || roll === '') return null;
        if (state.unit !== 'KG') return roll;
        const perRoll = App.ROLL_KG[itemCode];
        return perRoll ? Number(roll) * perRoll : null;
    }

    /* 수정 가능 구간: 오늘 기준 -EDIT_PAST_DAYS ~ +EDIT_FUTURE_DAYS */
    function isEditableDate(dateStr) {
        const t = todayStr();
        return dateStr >= addDays(t, -App.EDIT_PAST_DAYS)
            && dateStr <= addDays(t, App.EDIT_FUTURE_DAYS);
    }

    function isEditMode() {
        return !!(App.headerApi && App.headerApi.isEditMode && App.headerApi.isEditMode());
    }

    /* ────────────────────────────────────────────────────────────
       승계(carry-forward)
       ────────────────────────────────────────────────────────────
       값이 어쩌다 한 번만 바뀌는 열은 매일 적지 않습니다. 비어 있는 날은
       직전에 적어 둔 값을 그대로 이어서 보여주고, 그 칸은 '오늘 실제로 센 값'과
       구분되게 옅게 그립니다.

       ※ 지금 이 페이지에는 carry 열이 하나도 없어(48.8g 이 매일 직접 입력으로
         바뀌었습니다) applyCarry 가 첫 줄에서 빠져나갑니다. 나라사랑 페이지의
         급지대 잔량이 같은 구조를 쓸 예정이라 지우지 않고 둡니다.
       ──────────────────────────────────────────────────────────── */
    function lastKnownBefore(floorKey, dateStr, itemCode) {
        const bucket = state.values[floorKey] || {};
        const dates = Object.keys(bucket).filter(d => d < dateStr).sort();
        for (let i = dates.length - 1; i >= 0; i--) {
            // 앞선 계산이 승계로 채워 둔 칸은 원본이 아니므로 건너뜁니다
            if (isCarried(floorKey, dates[i], itemCode)) continue;
            const v = bucket[dates[i]][itemCode];
            if (v !== undefined && v !== null && v !== '') return v;
        }

        /* 불러온 구간 안에 직전 값이 없는 경우입니다. 48.8g 은 한 달에 한 번만
           바뀌므로 이쪽이 오히려 보통이고, 여기서 포기하면 한 달 내내 빈칸이
           됩니다. 조회 범위와 별개로 읽어 둔 '직전 1건'을 씁니다. */
        const seed = state.carrySeed[floorKey] && state.carrySeed[floorKey][itemCode];
        if (seed && seed.date < dateStr) return seed.value;

        return undefined;
    }

    /* from~to 구간의 carry 열을 앞에서부터 채웁니다.
       구간 앞쪽에 이미 조회해 둔 날짜가 있으면 거기서 이어받습니다.

       여러 번 불러도 같은 결과가 나와야 합니다. 앞선 계산이 승계로 채운 칸을
       '사람이 적은 값'으로 오해하면, 값을 고쳐도 옛날 숫자가 계속 이어집니다.
       그래서 승계 표시가 붙은 칸은 매번 지우고 다시 계산합니다. */
    function applyCarry(from, to) {
        const carryCols = App.COLUMNS.filter(c => c.carry);
        if (!carryCols.length) return;

        FLOORS.forEach(f => {
            carryCols.forEach(c => {
                let last = lastKnownBefore(f.key, from, c.itemCode);

                for (let d = from; d <= to; d = addDays(d, 1)) {
                    const wasCarried = isCarried(f.key, d, c.itemCode);
                    const raw = wasCarried ? undefined : cachedVal(f.key, d, c.itemCode);

                    if (raw !== undefined && raw !== null && raw !== '') {
                        last = raw;
                        continue;   // 그날 직접 적은 값 — 승계 표시를 하지 않습니다
                    }

                    // 지난번에 승계로 채워 둔 값은 지우고 다시 정합니다
                    if (wasCarried) {
                        delete state.values[f.key][d][c.itemCode];
                        delete state.carried[f.key][d][c.itemCode];
                    }

                    if (last === undefined) continue;   // 이어받을 값이 아직 없습니다

                    if (!state.values[f.key][d]) state.values[f.key][d] = {};
                    if (!state.carried[f.key][d]) state.carried[f.key][d] = {};
                    state.values[f.key][d][c.itemCode] = last;
                    state.carried[f.key][d][c.itemCode] = true;
                }
            });
        });
    }

    /* 화면에 그려져 있는 구간의 승계를 다시 계산하고 다시 칠합니다.
       승계 열의 값을 고치면 그 뒤 날짜가 전부 새 값을 이어받아야 하는데,
       그건 다음 조회 때가 아니라 지금 눈에 보여야 합니다. */
    function refreshCarry() {
        const body = document.getElementById(MAIN.bodyId);
        if (!body || !body.firstElementChild) return;

        applyCarry(
            body.firstElementChild.getAttribute('data-date'),
            body.lastElementChild.getAttribute('data-date')
        );
    }

    /* 데이터 조회(App.fetchRange)는 factory1_jigo_api.js 에 있습니다.
       읽는 곳이 둘입니다 — factory1_jigo_real(1~9열)과 factory1_ft_jigo(10~12열). */

    /* ── 스크롤 잠금 / 층 간 동기화 ────────────────────────────── */
    function updateScrollLockUI() {
        FLOORS.forEach(f => {
            const el = document.getElementById(f.scrollId);
            if (!el) return;
            el.classList.toggle('locked', !state.isScrollUnlocked);
        });
    }

    function bindScrollToggle() {
        const toggle = document.getElementById('f1jgScrollToggle');
        if (!toggle) return;

        toggle.checked = !!state.isScrollUnlocked;
        updateScrollLockUI();

        toggle.addEventListener('change', (e) => {
            state.isScrollUnlocked = e.target.checked;
            updateScrollLockUI();
        });
    }

    /* 잠금 상태의 내부 스크롤 차단은 CSS(.f1jg-scroll-area.locked)가 맡습니다.
       여기서 wheel 을 preventDefault 하면 페이지 전체 스크롤까지 막힙니다. */
    function bindScrollSync() {
        FLOORS.forEach(f => {
            const el = document.getElementById(f.scrollId);
            if (!el) return;

            el.addEventListener('scroll', () => {
                if (!state.isScrollUnlocked) return;
                if (state.syncLock) return;
                state.syncLock = true;

                const srcTop = el.scrollTop;
                FLOORS.filter(x => x.scrollId !== f.scrollId).forEach(t => {
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

    function scrollAllFloors(top) {
        FLOORS.forEach(f => {
            const el = document.getElementById(f.scrollId);
            if (el) el.scrollTop = Math.max(0, top);
        });
    }

    /* 레이아웃이 확정된 뒤 위치를 다시 잡아야 하지만, 백그라운드 탭에서는
       requestAnimationFrame 이 실행되지 않아 위치 지정이 누락됩니다.
       → 즉시 한 번 적용하고 rAF 에서 한 번 더 보정합니다. */
    function applyScrollTwice(computeTop) {
        scrollAllFloors(computeTop());
        requestAnimationFrame(() => scrollAllFloors(computeTop()));
    }

    /* ── 셀 선택 커서 / 강조 ───────────────────────────────────── */
    function hideCursors() {
        FLOORS.forEach(f => {
            const c = document.getElementById(f.cursorId);
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

    function showCursor(floorKey, td) {
        const floor = floorByKey(floorKey);
        const cursorEl = document.getElementById(floor.cursorId);
        const panelEl = document.getElementById(floor.scrollId);
        if (!cursorEl || !panelEl || !td) return;

        const pos = getOffsetRelativeToPanel(td, panelEl);
        cursorEl.style.top = `${pos.top}px`;
        cursorEl.style.left = `${pos.left}px`;
        cursorEl.style.width = `${td.offsetWidth}px`;
        cursorEl.style.height = `${td.offsetHeight}px`;
        cursorEl.classList.add('active');
    }

    function clearHighlights() {
        FLOORS.forEach(f => {
            const scrollEl = document.getElementById(f.scrollId);
            if (scrollEl) {
                scrollEl.querySelectorAll('.f1jg-header-active')
                    .forEach(el => el.classList.remove('f1jg-header-active'));
            }
            const body = document.getElementById(f.bodyId);
            if (body) {
                body.querySelectorAll('.f1jg-selected-row')
                    .forEach(el => el.classList.remove('f1jg-selected-row'));
                body.querySelectorAll('.f1jg-selected-cell')
                    .forEach(el => el.classList.remove('f1jg-selected-cell'));
            }
        });
        hideCursors();
    }

    function applyHighlight(floorKey, dateStr, colNum) {
        clearHighlights();
        state.selectedDate = dateStr;
        state.selectedCol = colNum;
        state.selectedFloor = floorKey;

        /* 선택한 행의 날짜를 상단 공통 헤더에 반영합니다.
           두 번째 인자 false = 표를 다시 불러오지 않고 표시만 갱신.
           (true 로 주면 표가 통째로 다시 그려지면서 방금 클릭한 위치로
            스크롤이 튑니다)
           ※ 상단 달력은 오늘까지만 열려 있어 내일 줄은 반영하지 않습니다. */
        if (dateStr && dateStr <= todayStr() && App.headerApi && App.headerApi.setCurrentDate) {
            App.headerApi.setCurrentDate(dateStr, false);
        }

        // 행 강조는 두 층 모두에 겁니다. 같은 날짜 줄이 위아래로 나란히 보입니다.
        FLOORS.forEach(f => {
            const body = document.getElementById(f.bodyId);
            if (!body) return;
            const row = body.querySelector(`tr[data-date="${dateStr}"]`);
            if (row) row.classList.add('f1jg-selected-row');
        });

        // 날짜 칸을 클릭했을 때는 행만 강조하고 셀 커서는 띄우지 않습니다.
        if (colNum === null || colNum === undefined) return;

        const floor = floorByKey(floorKey);
        const body = document.getElementById(floor.bodyId);
        const scrollEl = document.getElementById(floor.scrollId);
        if (!body || !scrollEl) return;

        const row = body.querySelector(`tr[data-date="${dateStr}"]`);
        if (!row) return;

        const targetTd = row.querySelector(`td[data-col="${colNum}"]`);
        if (targetTd) {
            targetTd.classList.add('f1jg-selected-cell');
            showCursor(floorKey, targetTd);
        }

        const colDef = App.COLUMNS.find(c => String(c.col) === String(colNum));
        if (colDef) {
            const groupTh = scrollEl.querySelector(`.f1jg-group-th[data-group="${colDef.group}"]`);
            if (groupTh) groupTh.classList.add('f1jg-header-active');
        }
        const leafTh = scrollEl.querySelector(`.f1jg-leaf-th[data-col="${colNum}"]`);
        if (leafTh) leafTh.classList.add('f1jg-header-active');
    }

    function bindBodyClicks() {
        FLOORS.forEach(f => {
            const body = document.getElementById(f.bodyId);
            if (!body) return;

            body.addEventListener('click', (e) => {
                const td = e.target.closest('td');
                if (!td) return;
                const tr = td.closest('tr[data-date]');
                if (!tr) return;

                const dateStr = tr.getAttribute('data-date');

                // 날짜 셀 클릭 시에는 행만 강조 (입고 · 사용량 페이지와 동일한 동작)
                if (td.classList.contains('f1jg-date-td')) {
                    applyHighlight(f.key, dateStr, null);
                    return;
                }
                applyHighlight(f.key, dateStr, td.getAttribute('data-col'));
            });
        });
    }

    /* ── 표시 단위 스위처 (R/L ↔ Kg) ───────────────────────────── */
    function updateUnitUI() {
        const wrap = document.getElementById('f1jgUnitToggle');
        if (!wrap) return;

        wrap.querySelectorAll('.unit-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.unit === state.unit);
        });

        const bg = document.getElementById('f1jgSwitcherBg');
        if (bg) bg.className = state.unit === 'KG' ? 'selection-bg mode-kg' : 'selection-bg mode-roll';

        // 수정 모드에서는 잠급니다 — 입력은 언제나 롤이기 때문입니다
        wrap.classList.toggle('disabled', isEditMode());
    }

    App.setUnit = function (unit) {
        state.unit = (unit === 'KG') ? 'KG' : 'RL';
        updateUnitUI();
        repaintAllCells();
    };

    function bindUnitToggle() {
        const wrap = document.getElementById('f1jgUnitToggle');
        if (!wrap) return;

        wrap.addEventListener('click', (e) => {
            const btn = e.target.closest('.unit-btn');
            if (!btn) return;
            if (isEditMode()) return;   // 수정 중에는 단위를 바꾸지 않습니다
            App.setUnit(btn.dataset.unit);
        });

        updateUnitUI();
    }

    /* 단위만 바뀌었을 때 — 행을 다시 만들지 않고 셀 안쪽 글자만 갈아 끼웁니다 */
    function repaintAllCells() {
        if (isEditMode()) return;   // 수정 모드에는 입력칸이 들어 있어 건드리지 않습니다

        FLOORS.forEach(f => {
            const body = document.getElementById(f.bodyId);
            if (!body) return;

            body.querySelectorAll('tr[data-date]').forEach(tr => {
                const dateStr = tr.getAttribute('data-date');
                App.COLUMNS.forEach(c => {
                    const td = tr.querySelector(`td[data-col="${c.col}"]`);
                    if (td) td.innerHTML = fmtVal(displayVal(c.itemCode, cachedVal(f.key, dateStr, c.itemCode)));
                });
            });
        });
    }

    /* ── 행 렌더링 ─────────────────────────────────────────────── */
    /* 기준일(어제) = 지금 채워야 할 줄 → 푸른 강조
       그 뒤 날짜(오늘) = 아직 세지 않은 줄 → 옅게 */
    function rowClasses(dateStr) {
        const cls = ['f1jg-data-row'];
        if (dateStr === baseDayStr()) cls.push('f1jg-row-base');
        else if (dateStr > baseDayStr()) cls.push('f1jg-row-future');
        return cls.join(' ');
    }

    function cellClasses(floorKey, dateStr, c) {
        const cls = ['f1jg-data-cell'];
        if (c.sep) cls.push('f1jg-sep');
        if (isReadonlyCol(c)) cls.push('f1jg-mirror-cell');
        if (isCarried(floorKey, dateStr, c.itemCode)) cls.push('f1jg-carried');
        if (state.dirty.has(cellKey(floorKey, dateStr, c.itemCode))) cls.push('f1jg-dirty-cell');
        return cls.join(' ');
    }

    function rowHtml(floorKey, r) {
        let cells = '';
        App.COLUMNS.forEach(c => {
            const raw = r.values[c.itemCode];
            const title = isCarried(floorKey, r.date, c.itemCode)
                ? ' title="직전에 입력한 값을 이어받은 칸입니다"'
                : '';
            cells += `<td class="${cellClasses(floorKey, r.date, c)}" data-col="${c.col}"${title}>`
                   + fmtVal(displayVal(c.itemCode, raw))
                   + '</td>';
        });

        let dateCls = '';
        if (r.weekday === '토') dateCls = 'f1jg-sat';
        else if (r.weekday === '일') dateCls = 'f1jg-sun';

        return `<tr class="${rowClasses(r.date)}" data-date="${r.date}">
            <td class="f1jg-date-td ${dateCls}">${fmtDateShort(r.date)}</td>
            ${cells}
        </tr>`;
    }

    function buildRows(floorKey, from, to) {
        const rows = [];
        for (let d = from; d <= to; d = addDays(d, 1)) {
            const values = {};
            App.COLUMNS.forEach(c => { values[c.itemCode] = cachedVal(floorKey, d, c.itemCode); });
            rows.push({ date: d, weekday: weekdayKr(d), values });
        }
        return rows;
    }

    /* 스크롤 영역에 한 번에 보이는 행 수 (기준 표로 잽니다)
       높이는 전부 offsetHeight / clientHeight 로 잽니다. getBoundingClientRect 는
       화면 배율이 100%가 아니면 확대된 값을 돌려주는데, clientHeight 는 그렇지
       않아 둘을 섞으면 배율이 걸린 화면에서 행 수가 한 줄씩 모자라게 나옵니다. */
    function visibleRowCount() {
        const panel = document.getElementById(MAIN.scrollId);
        if (!panel) return 5;
        const thead = panel.querySelector('thead');
        const theadH = thead ? thead.offsetHeight : 0;
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

        const latest = latestStr();
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
            const base = state.baseDate || todayStr();
            from = addDays(base, -App.RANGE);
            to = addDays(base, App.RANGE);
        }

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
        applyCarry(from, to);

        const prevScrollHeight = panel.scrollHeight;
        const prevScrollTop = panel.scrollTop;

        if (direction === 'prev') {
            FLOORS.forEach(f => {
                const body = document.getElementById(f.bodyId);
                if (body) {
                    body.insertAdjacentHTML('afterbegin',
                        buildRows(f.key, from, to).map(r => rowHtml(f.key, r)).join(''));
                }
            });
            // 새로 붙은 높이만큼 밀어 화면이 튀지 않게 합니다.
            applyScrollTwice(() => prevScrollTop + (panel.scrollHeight - prevScrollHeight));

        } else if (direction === 'next') {
            FLOORS.forEach(f => {
                const body = document.getElementById(f.bodyId);
                if (body) {
                    body.insertAdjacentHTML('beforeend',
                        buildRows(f.key, from, to).map(r => rowHtml(f.key, r)).join(''));
                }
            });

        } else {
            FLOORS.forEach(f => {
                const body = document.getElementById(f.bodyId);
                if (body) {
                    body.innerHTML = buildRows(f.key, from, to).map(r => rowHtml(f.key, r)).join('');
                }
            });

            /* 기준일(어제)을 아래에서 두 번째 줄에 둡니다. 그 아래 마지막 줄이
               아직 세지 않은 오늘이고, 위로는 지난 며칠이 함께 보입니다.
               어제 자를 적으면서 그제 값과 견주는 게 이 표의 일상적인 사용법입니다. */
            const baseRow = mainBody.querySelector(`tr[data-date="${state.baseDate}"]`) || mainBody.lastElementChild;
            if (baseRow) {
                applyScrollTwice(() => {
                    const thead = panel.querySelector('thead');
                    const theadH = thead ? thead.offsetHeight : 0;
                    const rowH = baseRow.offsetHeight || 44;
                    const rowTop = getOffsetRelativeToPanel(baseRow, panel).top;
                    const rowsBelow = Math.min(App.BASE_ROWS_BELOW, visibleRowCount() - 1);
                    return Math.round(rowTop - theadH - (visibleRowCount() - 1 - rowsBelow) * rowH);
                });
            }

            if (state.isInitialLoad) {
                state.isInitialLoad = false;
                setTimeout(() => {
                    const row = mainBody.querySelector(`tr[data-date="${state.baseDate}"]`) || mainBody.lastElementChild;
                    if (row) applyHighlight(MAIN.key, row.getAttribute('data-date'), '1');
                }, 150);
            }
        }

        state.loading = false;
    };

    /* ────────────────────────────────────────────────────────────
       편집 모드 — 셀 입력 및 변경분 추적
       수정 가능 구간의 td 를 <input> 으로 교체하고, 입력할 때마다 원본
       (snapshot)과 비교해 달라진 셀만 dirty 에 담습니다. 값을 원래대로
       되돌리면 dirty 에서 자동으로 빠집니다.
       ──────────────────────────────────────────────────────────── */
    function markDirty(inp) {
        const floorKey = inp.dataset.floor;
        const dateStr = inp.dataset.date;
        const itemCode = inp.dataset.item;
        const now = normVal(inp.value);
        const orig = normVal(snapOf(floorKey, dateStr, itemCode));   // 행이 없으면 0 과 같습니다

        if (!state.values[floorKey][dateStr]) state.values[floorKey][dateStr] = {};
        state.values[floorKey][dateStr][itemCode] = now;

        /* 직접 친 값은 더 이상 승계 칸이 아닙니다. 지우면 다시 승계로 돌아가는데,
           그건 다음 렌더에서 applyCarry 가 알아서 채웁니다. */
        if (state.carried[floorKey][dateStr]) {
            delete state.carried[floorKey][dateStr][itemCode];
        }

        if (now === orig) {
            state.dirty.delete(cellKey(floorKey, dateStr, itemCode));
            inp.classList.remove('f1jg-dirty');
        } else {
            state.dirty.add(cellKey(floorKey, dateStr, itemCode));
            inp.classList.add('f1jg-dirty');
        }

        state.isChanged = state.dirty.size > 0;
    }

    function enterEditMode() {
        // 입력은 언제나 롤입니다. Kg 화면에서 숫자를 치면 그게 롤로 저장됩니다.
        if (state.unit !== 'RL') App.setUnit('RL');
        updateUnitUI();

        const baseDay = baseDayStr();
        let firstInput = null;   // 수정 구간의 첫 칸 (기준일 행이 없을 때의 대비책)
        let baseInput = null;    // 기준일(어제) 행의 첫 칸 — 기본 포커스 위치

        FLOORS.forEach(f => {
            const body = document.getElementById(f.bodyId);
            if (!body) return;

            body.querySelectorAll('tr[data-date]').forEach(tr => {
                const dateStr = tr.getAttribute('data-date');

                // 수정 구간 밖은 입력칸을 만들지 않고 잠긴 행으로 표시합니다.
                if (!isEditableDate(dateStr)) {
                    tr.classList.add('f1jg-row-locked');
                    return;
                }

                App.COLUMNS.forEach(c => {
                    if (isReadonlyCol(c)) return;   // F.T 3종은 'FT 일지'가 입력 주인입니다

                    const td = tr.querySelector(`td[data-col="${c.col}"]`);
                    if (!td) return;

                    const carried = isCarried(f.key, dateStr, c.itemCode);
                    const val = normVal(cachedVal(f.key, dateStr, c.itemCode));

                    /* type="number" 를 쓰면 입력칸에 포커스가 있는 동안 마우스 휠과
                       위/아래 방향키가 값을 올리고 내립니다. 표를 훑어보려고 스크롤한
                       것뿐인데 숫자가 바뀌어 버리므로 텍스트 입력칸으로 두고,
                       숫자만 받도록 input 이벤트에서 걸러 냅니다.
                       inputmode 를 주면 휴대폰에서는 숫자 자판이 그대로 뜹니다. */
                    const inp = document.createElement('input');
                    inp.type = 'text';
                    inp.inputMode = 'numeric';
                    inp.autocomplete = 'off';
                    inp.className = 'f1jg-input';
                    inp.dataset.floor = f.key;
                    inp.dataset.date = dateStr;
                    inp.dataset.item = c.itemCode;

                    if (carried) {
                        /* 승계 칸은 값이 아니라 안내 문구로 띄웁니다. 이어받은 숫자를
                           입력칸에 넣어 두면 손대지 않은 날까지 '오늘 실제로 센 값'으로
                           저장되어 버립니다. 그대로 두면 계속 이어지고, 숫자가 바뀐
                           날에만 새로 치면 됩니다. */
                        inp.value = '';
                        inp.placeholder = String(val);
                        inp.classList.add('f1jg-input-carried');
                    } else {
                        // 0 은 빈 칸으로 띄웁니다. 0 을 지우고 새로 치는 수고를 없앱니다.
                        inp.value = (val === 0) ? '' : val;
                    }

                    if (state.dirty.has(cellKey(f.key, dateStr, c.itemCode))) inp.classList.add('f1jg-dirty');

                    td.innerHTML = '';
                    td.classList.remove('f1jg-dirty-cell', 'f1jg-carried');
                    td.classList.add('f1jg-edit-cell');
                    td.appendChild(inp);

                    if (!firstInput) firstInput = inp;
                    if (dateStr === baseDay && !baseInput) baseInput = inp;
                });
            });
        });

        /* 입력은 대부분 기준일(어제) 자로 하므로 그 행 첫 칸에서 시작합니다.
           preventScroll 이 없으면 B5 표만 스크롤되어 B6 와 행이 어긋납니다. */
        const focusTarget = baseInput || firstInput;
        if (focusTarget) {
            focusTarget.focus({ preventScroll: true });
            focusTarget.select();
        }
    }

    function exitEditMode() {
        // 승계 열을 고쳤을 수 있으므로 그 뒤 날짜를 다시 계산한 뒤 그립니다
        refreshCarry();

        FLOORS.forEach(f => {
            const body = document.getElementById(f.bodyId);
            if (!body) return;

            body.querySelectorAll('tr[data-date]').forEach(tr => {
                tr.classList.remove('f1jg-row-locked');
                const dateStr = tr.getAttribute('data-date');

                App.COLUMNS.forEach(c => {
                    if (isReadonlyCol(c)) return;   // 입력칸으로 바꾼 적이 없으니 되돌릴 것도 없습니다

                    const td = tr.querySelector(`td[data-col="${c.col}"]`);
                    if (!td) return;

                    td.classList.remove('f1jg-edit-cell');
                    td.className = cellClasses(f.key, dateStr, c);
                    td.innerHTML = fmtVal(displayVal(c.itemCode, cachedVal(f.key, dateStr, c.itemCode)));
                });
            });
        });

        updateUnitUI();
    }

    App.setReadOnlyMode = function (isReadOnly) {
        const wrapper = App.elements.wrapper;
        if (!wrapper) return;

        if (isReadOnly) {
            wrapper.classList.remove('edit-mode');
            exitEditMode();
        } else {
            wrapper.classList.add('edit-mode');
            enterEditMode();
        }
    };

    /* ── 편집 중 입력 처리 ─────────────────────────────────────── */
    function bindInputEvents() {
        FLOORS.forEach(f => {
            const body = document.getElementById(f.bodyId);
            if (!body) return;

            // 숫자만 남깁니다 (붙여넣기 포함)
            body.addEventListener('input', (e) => {
                const inp = e.target.closest('.f1jg-input');
                if (!inp) return;
                const cleaned = inp.value.replace(/[^\d]/g, '');
                if (cleaned !== inp.value) inp.value = cleaned;
                markDirty(inp);
            });

            body.addEventListener('focusin', (e) => {
                const inp = e.target.closest('.f1jg-input');
                if (!inp) return;
                applyHighlight(f.key, inp.dataset.date,
                    inp.closest('td').getAttribute('data-col'));
                inp.select();
            });
        });
    }

    /* ── 편집 모드 방향키 — 값 증감이 아니라 칸 이동으로만 씁니다 ── */
    function inputAt(tr, col) {
        if (!tr) return null;
        const td = tr.querySelector(`td[data-col="${col}"]`);
        return td ? td.querySelector('.f1jg-input') : null;
    }

    function focusInput(inp) {
        if (!inp) return;
        // preventScroll 이 없으면 그 층 표만 움직여 다른 층과 행이 어긋납니다.
        inp.focus({ preventScroll: true });
        inp.select();
    }

    /* 왼쪽/오른쪽으로 옮길 때 F.T 3종처럼 입력칸이 없는 열은 건너뜁니다. */
    function moveHorizontally(inp, dir) {
        const tr = inp.closest('tr');
        const cols = App.COLUMNS.filter(c => !isReadonlyCol(c)).map(c => c.col);
        const cur = Number(inp.closest('td').getAttribute('data-col'));
        const idx = cols.indexOf(cur);
        if (idx === -1) return;

        const next = cols[idx + dir];
        if (next === undefined) return;
        focusInput(inputAt(tr, next));
    }

    function moveVertically(inp, dir) {
        const tr = inp.closest('tr');
        const col = inp.closest('td').getAttribute('data-col');
        const target = (dir > 0) ? tr.nextElementSibling : tr.previousElementSibling;
        focusInput(inputAt(target, col));
    }

    function bindEditKeys() {
        FLOORS.forEach(f => {
            const body = document.getElementById(f.bodyId);
            if (!body) return;

            body.addEventListener('keydown', (e) => {
                const inp = e.target.closest('.f1jg-input');
                if (!inp) return;

                switch (e.key) {
                    case 'ArrowLeft':
                        // 글자 사이를 옮기는 중이면 커서 이동을 방해하지 않습니다
                        if (inp.selectionStart > 0 && inp.selectionStart !== inp.selectionEnd) return;
                        if (inp.selectionStart > 0) return;
                        e.preventDefault(); moveHorizontally(inp, -1); break;
                    case 'ArrowRight':
                        if (inp.selectionEnd < inp.value.length) return;
                        e.preventDefault(); moveHorizontally(inp, 1); break;
                    case 'ArrowUp':
                        e.preventDefault(); moveVertically(inp, -1); break;
                    case 'ArrowDown':
                    case 'Enter':
                        e.preventDefault(); moveVertically(inp, 1); break;
                    default:
                        break;
                }
            });
        });
    }

    /* ── 진입점에서 호출 ───────────────────────────────────────── */
    App.initUI = function () {
        bindScrollToggle();
        bindScrollSync();
        bindBodyClicks();
        bindUnitToggle();
        bindInputEvents();
        bindEditKeys();
    };

    // 상단 달력에서 날짜를 바꾸면 그 날짜를 기준으로 다시 그립니다.
    App.loadData = function (dateStr) {
        let base = dateStr || todayStr();

        /* 조회 한계(오늘 -MAX_PAST_DAYS)보다 더 과거를 고르면 만들 행이 하나도
           없어 표가 그 자리에 멈춰 있었습니다. 한계까지만 당겨 오고, 헤더 날짜도
           실제로 보여 주는 날짜에 맞춥니다. */
        const min = addDays(todayStr(), -App.MAX_PAST_DAYS);
        if (base < min) {
            base = min;
            if (App.headerApi && App.headerApi.setCurrentDate) {
                App.headerApi.setCurrentDate(base, false);
            }
        }

        state.baseDate = base;
        state.hasPrev = true;
        state.hasNext = true;

        /* 표를 통째로 다시 그리므로 강조도 다시 걸어야 합니다. 이 줄이 없으면
           clearHighlights() 로 지운 뒤 아무 줄도 잡히지 않아, 달력으로 날짜를
           옮겼을 때 그 줄 배경이 칠해지지 않았습니다.
           (loadRows('none') 안에서 이 값을 보고 기준일 줄을 잡습니다) */
        state.isInitialLoad = true;

        clearHighlights();
        App.loadRows('none');
    };

})();
