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

    /* 0 은 빈 칸과 똑같이 '-' 로 표시합니다.
       0 이 화면에 그대로 깔리면 실제 입고가 있는 칸이 묻혀 버립니다. */
    function fmtVal(v) {
        const n = Number(v);
        if (v === '' || v === null || v === undefined || isNaN(n) || n === 0) {
            return '<span class="f1ip-empty">-</span>';
        }
        return n.toLocaleString();
    }

    /* 입력칸 값을 정규화합니다. 빈 칸과 0 은 같은 것으로 봅니다.
       (화면에서 둘 다 '-' 로 보이므로 다르게 저장할 이유가 없습니다) */
    function normVal(v) {
        if (v === '' || v === null || v === undefined) return 0;
        const n = Number(v);
        return isNaN(n) ? 0 : n;
    }

    /* DB 에 저장돼 있는 롤 수. 행이 없으면 undefined 입니다. */
    function snapOf(dateStr, itemCode) {
        const row = state.snapshot[dateStr];
        return row ? row[itemCode] : undefined;
    }

    /* 셀 메모. 없으면 null 입니다. */
    function memoOf(dateStr, itemCode) {
        const row = state.memo[dateStr];
        return (row && row[itemCode]) || null;
    }

    function escapeAttr(s) {
        return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    }

    /* 메모가 있는 셀에 표시(우측 상단 삼각형)와 툴팁을 붙입니다. */
    function applyMemoMark(td, dateStr, itemCode) {
        const memo = memoOf(dateStr, itemCode);
        if (memo) {
            td.classList.add('f1ip-has-memo');
            td.setAttribute('title', memo);
        } else {
            td.classList.remove('f1ip-has-memo');
            td.removeAttribute('title');
        }
    }

    function cellKey(dateStr, itemCode) {
        return `${dateStr}|${itemCode}`;
    }

    function cachedVal(dateStr, itemCode) {
        const row = state.cache[dateStr];
        return row ? row[itemCode] : undefined;
    }

    /* 별관(3공장) 참조 열인지 — 편집 / 메모 / 저장 대상에서 모두 빠집니다. */
    function isMirrorCol(c) {
        return c.source === 'factory3';
    }

    /* 별관 열 값 (factory3_io 의 in_a / in_d). 그 날 행이 없으면 undefined 입니다. */
    function factory3Val(dateStr, field) {
        const row = state.factory3[dateStr];
        return row ? row[field] : undefined;
    }

    /* 열 하나의 표시값 — 1공장 열은 입력 캐시에서, 별관 열은 3공장 캐시에서 */
    function colValue(dateStr, c) {
        return isMirrorCol(c) ? factory3Val(dateStr, c.field) : cachedVal(dateStr, c.itemCode);
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

    /* ────────────────────────────────────────────────────────────
       우측 영역: 지종별 재고 블록
       롤 수 / kg 값은 DB 연동 후 채워집니다. (지금은 '-' 표기)
       추후 App.renderSideBlocks(data) 형태로 값만 넘기면 됩니다.
       ──────────────────────────────────────────────────────────── */
    /* 항목 하나의 { roll, kg } 를 데이터 묶음에서 꺼냅니다.
       1공장은 item_code 로, 별관(3공장)은 a/d 필드로 찾습니다. */
    function sideItemValue(block, item, data) {
        const src = block.source === 'factory3' ? data.factory3 : data.ipgo;
        if (!src) return null;
        return src[block.source === 'factory3' ? item.field : item.itemCode] || null;
    }

    App.renderSideBlocks = function (data) {
        const host = document.getElementById('f1ipSideBody');
        if (!host) return;

        const values = data || { ipgo: {}, factory3: {} };

        const blocksHtml = App.SIDE_BLOCKS.map(block => {
            let blockRoll = 0;   // 블록 전체 롤 수 — 0 이면 비정기 거래처는 통째로 숨김

            /* 줄 단위로 항목을 추리고 kg 합계를 냅니다.
               always: false 인 항목은 입고가 없으면 그 칸만 빠집니다. */
            const lines = block.lines.map(line => {
                let kgSum = 0;
                let hasValue = false;

                const specs = line.items.map(item => {
                    const val = sideItemValue(block, item, values);
                    const roll = val ? val.roll : 0;
                    const kg = val ? val.kg : 0;

                    blockRoll += roll;
                    kgSum += kg;
                    if (roll > 0) hasValue = true;

                    if (roll === 0 && !item.always) return null;   // 비정기 항목 → 숨김
                    return `<span class="f1ip-side-spec">${item.label} - <span class="f1ip-side-roll">${roll.toLocaleString()}</span>롤</span>`;
                }).filter(Boolean);

                if (!specs.length) return null;   // 표시할 항목이 하나도 없는 줄
                return { specsHtml: specs.join(''), kgSum, hasValue };
            }).filter(Boolean);

            // 비정기 거래처(always: false)는 그 날 입고가 없으면 블록째 사라집니다.
            if (!block.always && blockRoll === 0) return null;
            if (!lines.length) return null;

            const titleHtml = block.title
                .map(t => `<div class="f1ip-side-title">${t}</div>`)
                .join('');

            const linesHtml = lines.map(l => `
                <div class="f1ip-side-specs">${l.specsHtml}</div>
                <div class="f1ip-side-kg">(<span class="f1ip-side-kg-val">${l.kgSum.toLocaleString()}</span> kg)</div>`
            ).join('');

            return `<div class="f1ip-side-block" data-key="${block.key}">
                ${titleHtml}
                ${linesHtml}
            </div>`;
        }).filter(Boolean).join('');

        host.innerHTML = blocksHtml;
    };

    /* ────────────────────────────────────────────────────────────
       우측 하단: 메모 요약
       표에 보이는 날짜 구간과 무관하게, 메모가 달린 행을 DB 에서 따로
       읽어와(state.memoList) 한 줄씩 정리합니다. 표를 스크롤하지 않아도
       예전에 남긴 메모가 그대로 보입니다.
       ──────────────────────────────────────────────────────────── */
    /* 메모가 달린 칸의 이름.
       1공장은 열 정의(COLUMNS)에서, 3공장은 col_id 대응표에서 찾습니다. */
    function memoColLabel(m) {
        if (m.factory === 3) {
            return App.FACTORY3_MEMO_LABELS[m.key] || m.key;
        }
        const c = App.COLUMNS.find(x => x.itemCode === m.key);
        if (!c) return m.key;
        const groupName = App.GROUPS[c.group] || c.group;
        return c.label ? `${groupName} ${c.label}` : groupName;
    }

    App.renderMemoList = function () {
        const host = document.getElementById('f1ipMemoBody');
        if (!host) return;

        const list = (state.memoList || []).slice();

        if (!list.length) {
            host.innerHTML = '<div class="f1ip-memo-empty">메모 없음</div>';
            return;
        }

        /* 오래된 날짜가 위, 최근 날짜가 아래.
           같은 날짜 안에서는 1공장을 먼저 놓습니다. */
        list.sort((a, b) => {
            if (a.dateStr !== b.dateStr) return a.dateStr < b.dateStr ? -1 : 1;
            return a.factory - b.factory;
        });

        /* 날짜 + 공장이 같은 것끼리 묶습니다. 날짜와 공장을 줄마다 되풀이하지
           않고 묶음 머리에 한 번만 적으면, 좁은 카드에서 메모 내용에 쓸 폭이
           그만큼 늘어납니다. */
        const groups = [];
        list.forEach(m => {
            const last = groups[groups.length - 1];
            if (last && last.dateStr === m.dateStr && last.factory === m.factory) {
                last.items.push(m);
            } else {
                groups.push({ dateStr: m.dateStr, factory: m.factory, items: [m] });
            }
        });

        /* 내용은 자르지 않고 그대로 흘려 씁니다. 길면 다음 줄로 넘어가고,
           카드를 넘치면 목록 자체를 스크롤합니다. */
        host.innerHTML = groups.map(g => {
            const factoryName = `${g.factory}공장`;

            const rows = g.items.map(m => {
                const col = memoColLabel(m);
                const tip = `${fmtDateShort(g.dateStr)} ${factoryName} [${col}] ${m.text}`;
                return `<div class="f1ip-memo-item" title="${escapeAttr(tip)}">`
                    + `<span class="f1ip-memo-label">${escapeAttr(col)}</span>`
                    + `<span class="f1ip-memo-text">${escapeAttr(m.text)}</span>`
                    + `</div>`;
            }).join('');

            return `<div class="f1ip-memo-group">`
                + `<div class="f1ip-memo-day">`
                + `<span class="f1ip-memo-daytext">${fmtDateShort(g.dateStr)}</span>`
                + `<span class="f1ip-memo-factory f1ip-memo-factory-${g.factory}">${factoryName}</span>`
                + `</div>`
                + rows
                + `</div>`;
        }).join('');

        // 최근 메모가 맨 아래에 있으므로, 열자마자 그게 보이도록 끝으로 붙입니다.
        host.scrollTop = host.scrollHeight;
    };

    /* ────────────────────────────────────────────────────────────
       우측 영역: 공무국 표시
       거래처별 롤 수 대신, 지종을 묶은 kg 합계만 줄 단위로 보여 줍니다.
       총무국과 같은 조회 결과(fetchSideData)를 그대로 쓰므로 추가 조회가
       없습니다.
       ──────────────────────────────────────────────────────────── */
    App.renderGongmuBlocks = function (data) {
        const host = document.getElementById('f1ipSideBody');
        if (!host) return;

        const ipgo = (data && data.ipgo) || {};

        const cells = (App.GONGMU_LINES || []).map(line => {
            const kg = line.items.reduce((sum, code) => {
                const v = ipgo[code];
                return sum + (v ? Number(v.kg) || 0 : 0);
            }, 0);

            // 48.8g 처럼 비정기 항목은 입고가 없으면 줄째 사라집니다.
            if (!line.always && kg === 0) return null;

            return `<div class="f1ip-gongmu-label">${escapeAttr(line.label)} :</div>`
                + `<div class="f1ip-gongmu-val">(<span class="f1ip-side-kg-val">${kg.toLocaleString()}</span> kg)</div>`;
        }).filter(Boolean).join('');

        host.innerHTML = cells
            ? `<div class="f1ip-gongmu-grid">${cells}</div>`
            : '<div class="f1ip-side-pending">그 날 입고가 없습니다</div>';
    };

    /* 메모 목록을 DB 에서 다시 읽어 우측 하단 카드에 반영합니다. */
    App.refreshMemoList = async function () {
        if (App.fetchMemoList) await App.fetchMemoList();
        App.renderMemoList();
    };

    /* 우측 블록을 선택한 날짜 기준으로 다시 그립니다. */
    App.refreshSideBlocks = async function (dateStr) {
        const target = dateStr || state.selectedDate || state.baseDate || todayStr();

        const dateEl = document.getElementById('f1ipSideDate');
        if (dateEl) {
            const utils = window.Factory3Utils || window.CommonUtils;
            dateEl.textContent = utils ? utils.formatKoDate(target) : target;
        }

        const isGongmu = (state.dept === 'gongmu');

        if (!App.fetchSideData) {
            if (isGongmu) App.renderGongmuBlocks();
            else App.renderSideBlocks();
            return;
        }

        // 총무국·공무국이 같은 조회 결과를 쓰므로 한 번만 읽습니다.
        const data = await App.fetchSideData(target);
        if (isGongmu) App.renderGongmuBlocks(data);
        else App.renderSideBlocks(data);
    };

    /* 총무국 / 공무국 전환 */
    function bindDeptToggle() {
        const toggle = document.getElementById('f1ipDeptToggle');
        if (!toggle) return;

        const bg = document.getElementById('f1ipDeptSwitcherBg');
        const btns = toggle.querySelectorAll('.unit-btn');

        btns.forEach(btn => {
            btn.addEventListener('click', () => {
                const dept = btn.getAttribute('data-dept');
                if (dept === state.dept) return;
                state.dept = dept;

                btns.forEach(b => b.classList.toggle('active', b === btn));
                if (bg) bg.className = 'selection-bg ' + (dept === 'gongmu' ? 'mode-right' : 'mode-left');

                App.refreshSideBlocks();
            });
        });
    }

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

            // 잠금 상태의 내부 스크롤 차단은 CSS(.f1ip-scroll-area.locked)가 담당합니다.
            // 여기서 wheel 을 preventDefault 하면 페이지 전체 스크롤까지 막힙니다.
            // (factory1_ft_io 페이지에서 고친 것과 같은 문제입니다)

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

    let sideRefreshTimer = null;
    function scheduleSideRefresh(dateStr) {
        if (sideRefreshTimer) clearTimeout(sideRefreshTimer);
        sideRefreshTimer = setTimeout(() => {
            sideRefreshTimer = null;
            if (App.refreshSideBlocks) App.refreshSideBlocks(dateStr);
        }, 150);
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

        // 선택한 행의 날짜를 공통 헤더 날짜에 반영 (false = 데이터 재조회 없이 표시만 갱신)
        if (dateStr && App.headerApi && App.headerApi.setCurrentDate) {
            App.headerApi.setCurrentDate(dateStr, false);
        }

        // 우측 블록도 선택한 날짜 기준으로 갱신
        // (방향키를 연타할 때 조회가 매번 나가지 않도록 잠깐 모아서 처리합니다)
        if (dateStr) scheduleSideRefresh(dateStr);

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
                if (isEditMode()) return;   // 편집 중에는 셀 커서 이동을 막습니다
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
            if (isEditMode()) return;   // 편집 중에는 방향키를 입력칸에 양보합니다
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

            // 별관(3공장) 참조 열 — 변경 표시도 메모도 붙지 않습니다.
            if (isMirrorCol(c)) {
                cells += `<td class="f1ip-data-cell f1ip-mirror-cell${sepCls}" data-col="${c.col}">${fmtVal(r.values[c.col])}</td>`;
                return;
            }

            // 저장 전 변경분은 편집 모드를 빠져나가도 계속 표시해 둡니다.
            const dirtyCls = state.dirty.has(cellKey(r.date, c.itemCode)) ? ' f1ip-dirty-cell' : '';

            const memo = memoOf(r.date, c.itemCode);
            const memoCls = memo ? ' f1ip-has-memo' : '';
            const titleAttr = memo ? ` title="${escapeAttr(memo)}"` : '';

            cells += `<td class="f1ip-data-cell${sepCls}${dirtyCls}${memoCls}" data-col="${c.col}"${titleAttr}>${fmtVal(r.values[c.col])}</td>`;
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

    /* 표에 보이는 행 수를 기준으로, 오늘 아래에 렌더링할 미래 날짜 수를 계산합니다.
       (오늘이 '위에서 3번째 줄'에 오려면 그 아래로 화면을 채울 행이 있어야 합니다) */
    function futureRowCount() {
        const panel = document.getElementById(LEDGER.scrollId);
        if (!panel) return 0;

        const thead = panel.querySelector('thead');
        const theadH = thead ? thead.getBoundingClientRect().height : 0;
        const rowEl = panel.querySelector('tbody tr');
        // 최초 렌더 전에는 가장 작은 행 높이(38px)로 가정 → 넉넉하게 계산됨
        const rowH = (rowEl && rowEl.offsetHeight) || 38;

        const visibleRows = Math.ceil((panel.clientHeight - theadH) / rowH);
        return Math.max(0, visibleRows - App.TODAY_ROW_FROM_TOP) + 1;
    }

    /* 캐시(=DB 조회 결과 + 미저장 입력값)를 열 번호 기준으로 펼칩니다.
       별쇄 계획표(plan)는 아직 DB 미연동이라 빈 값으로 둡니다. */
    function buildRows(from, to) {
        const rows = [];
        for (let d = from; d <= to; d = addDays(d, 1)) {
            const values = {};
            App.COLUMNS.forEach(c => { values[c.col] = colValue(d, c); });
            rows.push({ date: d, weekday: weekdayKr(d), values, plan: {} });
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
        // 화면을 채울 만큼 + 최소한 수정 가능 구간(+EDIT_FUTURE_DAYS)까지는 렌더링합니다.
        // (창이 짧아 futureRowCount()가 작아도 미래 입력칸이 잘리지 않도록)
        const maxDate = addDays(today, Math.max(futureRowCount(), App.EDIT_FUTURE_DAYS));

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

        await Promise.all([
            App.fetchRange ? App.fetchRange(from, to) : null,
            App.fetchFactory3Range ? App.fetchFactory3Range(from, to) : null
        ]);

        const rows = buildRows(from, to);
        const prevScrollHeight = ledgerPanel.scrollHeight;
        const prevScrollTop = ledgerPanel.scrollTop;

        if (direction === 'none') {
            PANELS.forEach(p => {
                const body = document.getElementById(p.bodyId);
                if (body) body.innerHTML = htmlFor(p.idx, rows);
            });

            // 오늘 행이 '위에서 TODAY_ROW_FROM_TOP 번째 줄'에 오도록 스크롤
            // (sticky 헤더 아래로 오늘 위에 TODAY_ROW_FROM_TOP - 1 개의 행이 보입니다)
            //
            // smooth 로 움직이면 rAF 재보정이 애니메이션을 가로채면서 최종 위치가
            // 행 경계에서 소수점만큼 어긋납니다. 최초 배치는 즉시 이동시키고
            // 정수로 반올림해 행이 잘려 보이지 않게 합니다.
            const todayRow = ledgerBody.querySelector(`tr[data-date="${today}"]`) || ledgerBody.lastElementChild;
            if (todayRow) {
                applyScrollTwice(() => {
                    const thead = ledgerPanel.querySelector('thead');
                    const theadH = thead ? thead.getBoundingClientRect().height : 0;
                    const rowH = todayRow.offsetHeight;
                    const rowTop = getOffsetRelativeToPanel(todayRow, ledgerPanel).top;
                    return Math.round(rowTop - theadH - (App.TODAY_ROW_FROM_TOP - 1) * rowH);
                }, false);
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
       편집 모드 — 셀 입력 및 변경분 추적
       수정 가능 구간의 td 를 <input> 으로 교체하고, 입력할 때마다
       원본(snapshot)과 비교해 달라진 셀만 dirty 에 담습니다.
       값을 원래대로 되돌리면 dirty 에서 자동으로 빠집니다.
       ──────────────────────────────────────────────────────────── */
    function markDirty(inp) {
        const dateStr = inp.dataset.date;
        const itemCode = inp.dataset.item;
        const now = normVal(inp.value);
        const orig = normVal(snapOf(dateStr, itemCode));   // 행이 없으면 0 과 같습니다

        if (!state.cache[dateStr]) state.cache[dateStr] = {};
        state.cache[dateStr][itemCode] = now;

        if (now === orig) {
            state.dirty.delete(cellKey(dateStr, itemCode));
            inp.classList.remove('f1ip-dirty');
        } else {
            state.dirty.add(cellKey(dateStr, itemCode));
            inp.classList.add('f1ip-dirty');
        }

        state.isChanged = state.dirty.size > 0;
    }

    function enterEditMode() {
        const body = document.getElementById(LEDGER.bodyId);
        if (!body) return;

        const today = todayStr();
        let firstInput = null;   // 수정 구간의 첫 칸 (오늘 행이 없을 때의 대비책)
        let todayInput = null;   // 오늘 행의 첫 칸 — 기본 포커스 위치

        body.querySelectorAll('tr[data-date]').forEach(tr => {
            const dateStr = tr.getAttribute('data-date');

            // 수정 구간 밖은 입력칸을 만들지 않고 잠긴 행으로 표시합니다.
            if (!isEditableDate(dateStr)) {
                tr.classList.add('f1ip-row-locked');
                return;
            }

            App.COLUMNS.forEach(c => {
                if (isMirrorCol(c)) return;   // 별관 참조 열은 입력칸을 만들지 않습니다

                const td = tr.querySelector(`td[data-col="${c.col}"]`);
                if (!td) return;

                // 0 은 빈 칸으로 띄웁니다. 0 을 지우고 새로 치는 수고를 없앱니다.
                const val = normVal(cachedVal(dateStr, c.itemCode));

                /* type="number" 를 쓰면 입력칸에 포커스가 있는 동안 마우스 휠과
                   위/아래 방향키가 값을 올리고 내립니다. 표를 훑어보려고 스크롤한
                   것뿐인데 숫자가 바뀌어 버리므로 텍스트 입력칸으로 두고,
                   숫자만 받도록 아래 input 이벤트에서 걸러 냅니다.
                   inputmode 를 주면 휴대폰에서는 숫자 자판이 그대로 뜹니다. */
                const inp = document.createElement('input');
                inp.type = 'text';
                inp.inputMode = 'numeric';
                inp.autocomplete = 'off';
                inp.className = 'f1ip-input';
                inp.value = val === 0 ? '' : val;
                inp.dataset.date = dateStr;
                inp.dataset.item = c.itemCode;
                if (state.dirty.has(cellKey(dateStr, c.itemCode))) inp.classList.add('f1ip-dirty');

                td.innerHTML = '';
                td.classList.remove('f1ip-dirty-cell');
                td.classList.add('f1ip-edit-cell');
                td.appendChild(inp);

                if (!firstInput) firstInput = inp;
                if (dateStr === today && !todayInput) todayInput = inp;
            });
        });

        /* 입력은 대부분 오늘 자로 하므로 오늘 행 첫 칸에서 시작합니다.
           preventScroll 이 없으면 좌측 패널만 스크롤되어 우측 별쇄 패널과
           행이 어긋납니다. (스크롤 동기화는 잠금 해제 상태에서만 동작) */
        const focusTarget = todayInput || firstInput;
        if (focusTarget) {
            focusTarget.focus({ preventScroll: true });
            focusTarget.select();
        }
    }

    function exitEditMode() {
        const body = document.getElementById(LEDGER.bodyId);
        if (!body) return;

        body.querySelectorAll('tr[data-date]').forEach(tr => {
            tr.classList.remove('f1ip-row-locked');
            const dateStr = tr.getAttribute('data-date');

            App.COLUMNS.forEach(c => {
                if (isMirrorCol(c)) return;   // 입력칸으로 바꾼 적이 없으니 되돌릴 것도 없습니다

                const td = tr.querySelector(`td[data-col="${c.col}"]`);
                if (!td) return;

                td.classList.remove('f1ip-edit-cell');
                td.innerHTML = fmtVal(cachedVal(dateStr, c.itemCode));
                // 저장하지 않고 나온 변경분은 눈에 보이게 남겨 둡니다.
                td.classList.toggle('f1ip-dirty-cell', state.dirty.has(cellKey(dateStr, c.itemCode)));
                applyMemoMark(td, dateStr, c.itemCode);
            });
        });
    }

    /* ────────────────────────────────────────────────────────────
       편집 모드 방향키 — 값 증감이 아니라 칸 이동으로만 씁니다.
       (보기 모드의 커서 이동은 bindKeyboardNav 가 따로 담당합니다)
       ──────────────────────────────────────────────────────────── */
    function inputAt(tr, col) {
        if (!tr) return null;
        const td = tr.querySelector(`td[data-col="${col}"]`);
        return td ? td.querySelector('.f1ip-input') : null;
    }

    function focusInput(inp) {
        if (!inp) return;
        // preventScroll 이 없으면 좌측 패널만 움직여 우측 별쇄 패널과 행이 어긋납니다.
        inp.focus({ preventScroll: true });
        inp.select();
    }

    function moveEditFocus(inp, key) {
        const td = inp.closest('td[data-col]');
        const tr = inp.closest('tr[data-date]');
        if (!td || !tr) return;

        const col = Number(td.getAttribute('data-col'));

        if (key === 'ArrowUp' || key === 'ArrowDown') {
            // 수정 구간 밖의 행에는 입력칸이 없으므로 있는 행이 나올 때까지 건너뜁니다.
            const step = key === 'ArrowUp' ? 'previousElementSibling' : 'nextElementSibling';
            for (let row = tr[step]; row; row = row[step]) {
                const target = inputAt(row, col);
                if (target) { focusInput(target); return; }
            }
            return;
        }

        // 좌우 — 같은 행에서 입력칸이 있는(별관 참조 열을 건너뛴) 이웃 열로
        const cols = App.COLUMNS.filter(c => !isMirrorCol(c)).map(c => c.col);
        const idx = cols.indexOf(col);
        if (idx < 0) return;

        const nextIdx = key === 'ArrowLeft' ? idx - 1 : idx + 1;
        if (nextIdx < 0 || nextIdx >= cols.length) return;

        focusInput(inputAt(tr, cols[nextIdx]));
    }

    function bindEditKeyboardNav() {
        const body = document.getElementById(LEDGER.bodyId);
        if (!body) return;

        body.addEventListener('keydown', e => {
            if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;

            const inp = e.target.closest('.f1ip-input');
            if (!inp) return;

            // 기본 동작(글자 사이 캐럿 이동)을 막고 칸 이동으로만 씁니다.
            e.preventDefault();
            moveEditFocus(inp, e.key);
        });
    }

    /* ────────────────────────────────────────────────────────────
       셀 메모 — 더블클릭으로 입력/수정/삭제 (즉시 저장)
       롤 수 편집과 달리 수정 모드와 무관하게 동작하며 저장 버튼도 거치지
       않습니다. 저장에 실패하면 화면을 원래대로 되돌립니다.
       ──────────────────────────────────────────────────────────── */
    function bindBodyDoubleClicks() {
        const body = document.getElementById(LEDGER.bodyId);
        if (!body) return;

        body.addEventListener('dblclick', async e => {
            // 수정 모드에서는 입력칸 텍스트 선택과 겹치므로 보기 모드에서만 받습니다.
            if (isEditMode()) return;

            const td = e.target.closest('td.f1ip-data-cell');
            if (!td) return;
            const tr = td.closest('tr[data-date]');
            if (!tr) return;

            // 메모는 수정 권한과 무관하게 모든 계정에 열려 있습니다.
            // (롤 수는 마스터만 고칠 수 있지만, 메모는 누구나 남길 수 있습니다)

            const dateStr = tr.getAttribute('data-date');
            const colDef = App.COLUMNS.find(c => String(c.col) === String(td.getAttribute('data-col')));
            if (!colDef) return;

            // 별관 열은 factory1_ipgo 에 대응하는 행이 없어 메모를 붙일 수 없습니다.
            if (isMirrorCol(colDef)) return;

            const itemCode = colDef.itemCode;
            const current = memoOf(dateStr, itemCode) || '';

            const groupName = App.GROUPS[colDef.group] || colDef.group;
            const label = colDef.label ? `${groupName} ${colDef.label}` : groupName;
            const input = prompt(`${fmtDateShort(dateStr)} [${label}] 메모 (비우면 삭제됩니다)`, current);

            if (input === null) return;                    // 취소
            const next = input.trim() === '' ? null : input.trim();
            if (next === (current || null)) return;        // 변경 없음

            // 화면 먼저 반영하고, 실패하면 되돌립니다.
            if (!state.memo[dateStr]) state.memo[dateStr] = {};
            state.memo[dateStr][itemCode] = next;
            applyMemoMark(td, dateStr, itemCode);

            // 아직 저장하지 않은 입력값을 건드리지 않도록 DB 원본 롤 수를 넘깁니다.
            const ok = await App.saveMemo(dateStr, itemCode, next, normVal(snapOf(dateStr, itemCode)));

            if (!ok) {
                state.memo[dateStr][itemCode] = current || null;
                applyMemoMark(td, dateStr, itemCode);
                return;
            }

            await App.refreshMemoList();   // 우측 하단 요약에 즉시 반영

            // 메모만 남기려고 만든 행 / 지우면서 없어진 행을 스냅샷에 반영
            if (!state.snapshot[dateStr]) state.snapshot[dateStr] = {};
            if (next === null && normVal(snapOf(dateStr, itemCode)) === 0) {
                delete state.snapshot[dateStr][itemCode];
            } else if (next !== null && snapOf(dateStr, itemCode) === undefined) {
                state.snapshot[dateStr][itemCode] = 0;
            }
        });
    }

    /* 입력 이벤트는 tbody 에 한 번만 위임해 둡니다. */
    function bindEditInput() {
        const body = document.getElementById(LEDGER.bodyId);
        if (!body) return;

        body.addEventListener('input', e => {
            const inp = e.target.closest('.f1ip-input');
            if (!inp) return;

            // 텍스트 입력칸이므로 숫자가 아닌 글자는 여기서 걸러 냅니다.
            const cleaned = inp.value.replace(/[^0-9]/g, '');
            if (cleaned !== inp.value) {
                inp.value = cleaned;
            }

            markDirty(inp);
        });
    }

    /* ────────────────────────────────────────────────────────────
       공통 라우터 훅
       ──────────────────────────────────────────────────────────── */
    App.loadData = async function (dateStr) {
        if (isEditMode()) App.headerApi.toggleEditMode();

        state.baseDate = dateStr || state.baseDate || todayStr();
        state.hasNext = true;
        state.hasPrev = true;
        state.isInitialLoad = true;

        /* 날짜를 옮기면 값을 새로 조회하므로 캐시를 비웁니다.
           단 저장하지 않은 입력값(dirty)은 남겨 둡니다 — 다른 날짜를 잠깐
           확인하고 돌아왔을 때 입력하던 내용이 사라지면 안 되기 때문입니다. */
        const keep = {};
        state.dirty.forEach(key => {
            const sep = key.indexOf('|');
            const d = key.slice(0, sep);
            const item = key.slice(sep + 1);
            if (!keep[d]) keep[d] = {};
            keep[d][item] = state.cache[d] ? state.cache[d][item] : null;
        });
        state.cache = keep;
        state.snapshot = {};
        state.memo = {};   // 메모는 즉시 저장되므로 남겨둘 미저장분이 없습니다
        state.factory3 = {};   // 별관 참조 값도 새로 읽어옵니다

        await App.refreshSideBlocks(state.baseDate);   // 우측 거래처별 입고 현황
        await App.refreshMemoList();                   // 우측 하단 메모 요약
        await App.loadRows('none');
        state.isChanged = state.dirty.size > 0;
    };

    /* 변경된 셀만 저장합니다. 화면에 보이는 구간을 통째로 덮어쓰지 않습니다. */
    App.saveData = async function () {
        // 편집 모드에서 아직 <input> 안에 있는 값들을 캐시에 반영
        document.querySelectorAll('.f1ip-input').forEach(inp => markDirty(inp));

        if (state.dirty.size === 0) {
            alert('변경된 내용이 없습니다.');
            if (App.headerApi && App.headerApi.toggleEditMode) App.headerApi.toggleEditMode();
            return;
        }

        const upserts = [];
        const deletes = [];

        state.dirty.forEach(key => {
            const sep = key.indexOf('|');
            const dateStr = key.slice(0, sep);
            const itemCode = key.slice(sep + 1);
            const val = normVal(cachedVal(dateStr, itemCode));
            const hasRow = snapOf(dateStr, itemCode) !== undefined;

            if (val > 0) {
                upserts.push({ ipgo_date: dateStr, item_code: itemCode, roll_qty: val });
            } else if (memoOf(dateStr, itemCode)) {
                // 메모가 달린 칸은 지우지 않고 0 으로 남깁니다 (메모 보존)
                upserts.push({ ipgo_date: dateStr, item_code: itemCode, roll_qty: 0 });
            } else if (hasRow) {
                // 값을 지운 칸 → 행을 삭제합니다. 0 은 저장하지 않습니다.
                deletes.push({ ipgo_date: dateStr, item_code: itemCode });
            }
            // 원래 행도 없고 값도 0 이면 저장할 게 없습니다.
        });

        if (!upserts.length && !deletes.length) {
            state.dirty.clear();
            state.isChanged = false;
            if (App.headerApi && App.headerApi.toggleEditMode) App.headerApi.toggleEditMode();
            return;
        }

        const ok = await App.saveDirty(upserts, deletes);
        if (!ok) return;

        // 저장 성공 → 원본 스냅샷을 갱신하고 변경 표시를 해제합니다.
        upserts.forEach(r => {
            if (!state.snapshot[r.ipgo_date]) state.snapshot[r.ipgo_date] = {};
            state.snapshot[r.ipgo_date][r.item_code] = r.roll_qty;
        });
        deletes.forEach(r => {
            if (state.snapshot[r.ipgo_date]) delete state.snapshot[r.ipgo_date][r.item_code];
        });

        const saved = upserts.length + deletes.length;
        state.dirty.clear();
        state.isChanged = false;

        if (App.headerApi && App.headerApi.toggleEditMode) App.headerApi.toggleEditMode();
        await App.refreshSideBlocks();   // 저장한 값이 우측 블록에 바로 반영되도록
        alert(`${saved}건이 저장되었습니다.`);
    };

    App.initUI = function () {
        bindScrollToggle();
        bindScrollSync();
        bindBodyClicks();
        bindKeyboardNav();
        bindEditInput();
        bindEditKeyboardNav();
        bindBodyDoubleClicks();
        bindDeptToggle();
    };

})();
