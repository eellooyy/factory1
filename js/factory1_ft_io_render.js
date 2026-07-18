/* factory1_ft_io_render.js — 1공장 FT 재고 종합 UI 렌더링 및 제어 */
(function () {
    'use strict';

    const App = window.Factory1FtIo;
    if (!App) return;

    const state = App.state;
    const PANEL_IDS = App.PANEL_IDS;

    /* ─────────────────────────────────────
       날짜/숫자 헬퍼
    ───────────────────────────────────── */
    function pad(n) { return String(n).padStart(2, '0'); }

    function fmtDateShort(dateStr) {
        const d = new Date(dateStr + 'T00:00:00');
        return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} (${App.WD_KR[d.getDay()]})`;
    }

    function todayStr() {
        const t = new Date();
        return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
    }

    function yesterdayStr() {
        const t = new Date();
        t.setDate(t.getDate() - 1);
        return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
    }

    function fmtVal(v, isDiff) {
        if (v === '' || v === null || v === undefined) return '<span class="comp-empty">-</span>';
        const n = Number(v);
        if (isNaN(n)) return '<span class="comp-empty">-</span>';
        if (isDiff) {
            if (n > 0) return `<span class="comp-diff-positive">+${n.toLocaleString()}</span>`;
            if (n < 0) return `<span class="comp-diff-negative">${n.toLocaleString()}</span>`;
        }
        return n.toLocaleString();
    }

    /* ─────────────────────────────────────
       보기 모드 / 편집 모드
       (이 페이지는 조회 전용 요약 화면이라 별도 잠금 UI가 없습니다.
        입력 폼이 추가될 경우 이 자리에 확장하세요.)
    ───────────────────────────────────── */
    App.setReadOnlyMode = function (isReadOnly) {
        const wrapper = App.elements.wrapper;
        if (!wrapper) return;
    };

    /* ─────────────────────────────────────
       좌측 4단 대조표: 스크롤 동기화
    ───────────────────────────────────── */
    function bindScrollSync() {
        PANEL_IDS.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('scroll', () => {
                if (state.syncLock) return;
                state.syncLock = true;
                const srcTop = el.scrollTop;

                PANEL_IDS.filter(x => x !== id).forEach(tid => {
                    const t = document.getElementById(tid);
                    if (t) t.scrollTop = srcTop;
                });

                hideCursors();
                state.syncLock = false;

                const threshold = 100;
                if (el.scrollTop + el.clientHeight >= el.scrollHeight - threshold) {
                    App.loadCompData('next');
                }
                if (el.scrollTop <= threshold) {
                    App.loadCompData('prev');
                }
            });
        });
    }

    /* ─────────────────────────────────────
       커서 & 하이라이트
    ───────────────────────────────────── */
    function hideCursors() {
        [1, 2, 3, 4].forEach(i => {
            const c = document.getElementById(`compCursor${i}`);
            if (c) c.classList.remove('active');
        });
    }

    function showCursor(panelIdx, td) {
        const cursorEl = document.getElementById(`compCursor${panelIdx}`);
        const panelEl = document.getElementById(`compScrollPanel${panelIdx}`);
        if (!cursorEl || !panelEl || !td) return;

        const panelRect = panelEl.getBoundingClientRect();
        const tdRect = td.getBoundingClientRect();

        cursorEl.style.width = tdRect.width + 'px';
        cursorEl.style.height = tdRect.height + 'px';
        cursorEl.style.left = (tdRect.left - panelRect.left + panelEl.scrollLeft) + 'px';
        cursorEl.style.top = (tdRect.top - panelRect.top + panelEl.scrollTop) + 'px';
        cursorEl.classList.add('active');
    }

    function clearHighlights() {
        document.querySelectorAll('.comp-selected-row').forEach(el => el.classList.remove('comp-selected-row'));
        document.querySelectorAll('.comp-selected-cell').forEach(el => el.classList.remove('comp-selected-cell'));
        document.querySelectorAll('.comp-header-active').forEach(el => el.classList.remove('comp-header-active'));
        hideCursors();
    }

    function applyHighlight(panelIdx, dateStr, colNum) {
        clearHighlights();
        state.selectedDate = dateStr;
        state.selectedPanel = panelIdx;
        state.selectedCol = colNum;

        [1, 2, 3, 4].forEach(i => {
            const body = document.getElementById(`compBody${i}`);
            if (!body) return;
            const row = body.querySelector(`tr[data-date="${dateStr}"]`);
            if (row) row.classList.add('comp-selected-row');
        });

        const clickedBody = document.getElementById(`compBody${panelIdx}`);
        if (clickedBody) {
            const row = clickedBody.querySelector(`tr[data-date="${dateStr}"]`);
            if (row && colNum !== null) {
                const targetTd = row.querySelector(`td[data-col="${colNum}"]`);
                if (targetTd) {
                    targetTd.classList.add('comp-selected-cell');
                    showCursor(panelIdx, targetTd);
                }
            }
        }

        const scrollPanel = document.getElementById(`compScrollPanel${panelIdx}`);
        if (scrollPanel && colNum !== null) {
            const groupTh = scrollPanel.querySelector('.comp-group-th');
            if (groupTh) groupTh.classList.add('comp-header-active');
            const leafTh = scrollPanel.querySelector(`.comp-leaf-th[data-col="${colNum}"]`);
            if (leafTh) leafTh.classList.add('comp-header-active');
        }
    }

    /* ─────────────────────────────────────
       키보드 네비게이션
    ───────────────────────────────────── */
    function bindKeyboardNav() {
        document.addEventListener('keydown', e => {
            if (!state.selectedDate || !state.selectedPanel) return;
            if (!App.elements.wrapper || !document.body.contains(App.elements.wrapper)) return;
            if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
            e.preventDefault();

            let panelIdx = Number(state.selectedPanel);
            let colNum = Number(state.selectedCol);
            let dateStr = state.selectedDate;

            const body = document.getElementById(`compBody${panelIdx}`);
            if (!body) return;
            const currentRow = body.querySelector(`tr[data-date="${dateStr}"]`);
            if (!currentRow) return;

            if (e.key === 'ArrowUp') {
                const prev = currentRow.previousElementSibling;
                if (prev && prev.getAttribute('data-date')) applyHighlight(panelIdx, prev.getAttribute('data-date'), String(colNum));
            } else if (e.key === 'ArrowDown') {
                const next = currentRow.nextElementSibling;
                if (next && next.getAttribute('data-date')) applyHighlight(panelIdx, next.getAttribute('data-date'), String(colNum));
            } else if (e.key === 'ArrowLeft') {
                colNum--;
                if (colNum < 1) { if (panelIdx > 1) { panelIdx--; colNum = 3; } else colNum = 1; }
                applyHighlight(panelIdx, dateStr, String(colNum));
            } else if (e.key === 'ArrowRight') {
                colNum++;
                if (colNum > 3) { if (panelIdx < 4) { panelIdx++; colNum = 1; } else colNum = 3; }
                applyHighlight(panelIdx, dateStr, String(colNum));
            }
        });
    }

    /* ─────────────────────────────────────
       클릭 이벤트 바인딩
    ───────────────────────────────────── */
    function bindBodyClicks() {
        [1, 2, 3, 4].forEach(panelIdx => {
            const body = document.getElementById(`compBody${panelIdx}`);
            if (!body) return;
            body.addEventListener('click', e => {
                const td = e.target.closest('td');
                if (!td || td.classList.contains('comp-date-td')) return;
                const tr = td.closest('tr[data-date]');
                if (!tr) return;
                applyHighlight(panelIdx, tr.getAttribute('data-date'), td.getAttribute('data-col'));
            });
        });
    }

    /* ─────────────────────────────────────
       좌측 4단 대조표 렌더링
    ───────────────────────────────────── */
    function generateRowsHTML(dates) {
        let html1 = '', html2 = '', html3 = '', html4 = '';

        dates.forEach(r => {
            const dateStr = r.date;
            const isToday = (dateStr === yesterdayStr());
            const trCls = isToday ? 'comp-row-today comp-data-row' : 'comp-data-row';

            let dateCls = '';
            if (r.weekday === '토') dateCls = 'comp-sat';
            else if (r.weekday === '일') dateCls = 'comp-sun';

            const shortDate = fmtDateShort(dateStr);

            html1 += `<tr class="${trCls}" data-date="${dateStr}">
                <td class="comp-date-td ${dateCls}">${shortDate}</td>
                <td class="comp-data-cell" data-col="1">${fmtVal(r.usage[0])}</td>
                <td class="comp-data-cell" data-col="2">${fmtVal(r.usage[1])}</td>
                <td class="comp-data-cell" data-col="3">${fmtVal(r.usage[2])}</td>
            </tr>`;

            html2 += `<tr class="${trCls}" data-date="${dateStr}">
                <td class="comp-data-cell" data-col="1">${fmtVal(r.erp[0])}</td>
                <td class="comp-data-cell" data-col="2">${fmtVal(r.erp[1])}</td>
                <td class="comp-data-cell" data-col="3">${fmtVal(r.erp[2])}</td>
            </tr>`;

            html3 += `<tr class="${trCls}" data-date="${dateStr}">
                <td class="comp-data-cell" data-col="1">${fmtVal(r.real[0])}</td>
                <td class="comp-data-cell" data-col="2">${fmtVal(r.real[1])}</td>
                <td class="comp-data-cell" data-col="3">${fmtVal(r.real[2])}</td>
            </tr>`;

            html4 += `<tr class="${trCls}" data-date="${dateStr}">
                <td class="comp-data-cell" data-col="1">${fmtVal(r.diff[0], true)}</td>
                <td class="comp-data-cell" data-col="2">${fmtVal(r.diff[1], true)}</td>
                <td class="comp-data-cell" data-col="3">${fmtVal(r.diff[2], true)}</td>
            </tr>`;
        });

        return { html1, html2, html3, html4 };
    }

    function renderComp(dates, direction) {
        const bodies = [1, 2, 3, 4].map(i => document.getElementById(`compBody${i}`));
        if (bodies.some(b => !b)) return;

        const panel1 = document.getElementById('compScrollPanel1');
        const prevScrollHeight = panel1 ? panel1.scrollHeight : 0;
        const prevScrollTop = panel1 ? panel1.scrollTop : 0;

        const htmls = generateRowsHTML(dates);

        if (direction === 'none') {
            bodies[0].innerHTML = htmls.html1;
            bodies[1].innerHTML = htmls.html2;
            bodies[2].innerHTML = htmls.html3;
            bodies[3].innerHTML = htmls.html4;

            if (panel1) {
                let targetRow = bodies[0].querySelector(`tr[data-date="${state.compBaseDate}"]`);
                if (!targetRow) targetRow = bodies[0].querySelector('.comp-row-today');
                if (targetRow) {
                    requestAnimationFrame(() => {
                        const wrapH = panel1.clientHeight;
                        const top = targetRow.offsetTop - (wrapH / 2) + (targetRow.offsetHeight / 2);
                        PANEL_IDS.forEach(id => {
                            const p = document.getElementById(id);
                            if (p) p.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
                        });
                    });
                }
            }

            if (state.isInitialLoad) {
                state.isInitialLoad = false;
                setTimeout(() => selectDefaultCell(), 150);
            }

        } else if (direction === 'next') {
            bodies[0].insertAdjacentHTML('beforeend', htmls.html1);
            bodies[1].insertAdjacentHTML('beforeend', htmls.html2);
            bodies[2].insertAdjacentHTML('beforeend', htmls.html3);
            bodies[3].insertAdjacentHTML('beforeend', htmls.html4);

        } else if (direction === 'prev') {
            bodies[0].insertAdjacentHTML('afterbegin', htmls.html1);
            bodies[1].insertAdjacentHTML('afterbegin', htmls.html2);
            bodies[2].insertAdjacentHTML('afterbegin', htmls.html3);
            bodies[3].insertAdjacentHTML('afterbegin', htmls.html4);

            if (panel1) {
                requestAnimationFrame(() => {
                    const newHeight = panel1.scrollHeight;
                    const diff = newHeight - prevScrollHeight;
                    PANEL_IDS.forEach(id => {
                        const p = document.getElementById(id);
                        if (p) p.scrollTop = prevScrollTop + diff;
                    });
                });
            }
        }
    }

    function selectDefaultCell() {
        const yest = yesterdayStr();
        const body1 = document.getElementById('compBody1');
        if (!body1) return;
        let row = body1.querySelector(`tr[data-date="${yest}"]`);
        if (!row) row = body1.querySelector('.comp-row-today');
        if (!row && body1.children.length > 0) row = body1.lastElementChild;
        if (row) applyHighlight(1, row.getAttribute('data-date'), '1');
    }

    // 공통 라우터에서 날짜가 바뀔 때(App.loadData) 호출되는 실제 조회+렌더 함수
    App.loadCompData = async function (direction) {
        if (state.compLoading) return;
        if (direction === 'next' && !state.compHasNext) return;
        if (direction === 'prev' && !state.compHasPrev) return;

        state.compLoading = true;

        let targetDate = state.compBaseDate || todayStr();
        const body1 = document.getElementById('compBody1');
        if (direction !== 'none' && body1 && body1.children.length > 0) {
            if (direction === 'next') targetDate = body1.lastElementChild.getAttribute('data-date');
            else if (direction === 'prev') targetDate = body1.firstElementChild.getAttribute('data-date');
        }

        try {
            const data = await App.fetchComparisonData(targetDate, direction);
            if (data.status === 'success' && data.dates && data.dates.length > 0) {
                renderComp(data.dates, direction);
            } else {
                if (direction === 'next') state.compHasNext = false;
                if (direction === 'prev') state.compHasPrev = false;
            }
        } catch (err) {
            console.error('대조 데이터 조회 실패:', err);
        } finally {
            state.compLoading = false;
        }
    };

    /* ─────────────────────────────────────
       우측 상단: 입고 현황
    ───────────────────────────────────── */
    function scrollToRecentDate(bodyEl) {
        requestAnimationFrame(() => {
            const wrapper = bodyEl.closest('.table-scroll-wrapper');
            if (!wrapper) return;
            const rows = bodyEl.querySelectorAll('tr');
            if (!rows.length) return;
            const lastRow = rows[rows.length - 1];
            const target = lastRow.offsetTop - (wrapper.clientHeight / 2) + (lastRow.offsetHeight / 2);
            wrapper.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
        });
    }

    function updateDisplay() {
        document.querySelectorAll('.unit-cell').forEach(td => {
            const rl = parseFloat(td.getAttribute('data-rl')) || 0;
            const kg = parseFloat(td.getAttribute('data-kg')) || 0;
            if (state.unit === 'RL') {
                td.textContent = rl > 0 ? rl.toLocaleString() + ' R/L' : '-';
            } else {
                td.textContent = kg > 0 ? kg.toLocaleString() + ' kg' : '-';
            }
        });
    }

    App.loadInbound = async function () {
        const body = document.getElementById('in-body');
        const yearTxt = document.getElementById('in-year-txt');
        if (yearTxt) yearTxt.textContent = `${state.inYear}년`;
        if (!body) return;

        try {
            const data = await App.fetchInboundList(state.inYear);
            if (data && data.length > 0) {
                body.innerHTML = data.map(r => `
                    <tr>
                        <td class="fw-semibold">${r.date_display}</td>
                        <td class="unit-cell text-center" data-rl="${r.A_rl}" data-kg="${r.A_kg}"></td>
                        <td class="unit-cell text-center" data-rl="${r.C_rl}" data-kg="${r.C_kg}"></td>
                        <td class="unit-cell text-center" data-rl="${r.D_rl}" data-kg="${r.D_kg}"></td>
                    </tr>
                `).join('');
            } else {
                body.innerHTML = `<tr><td colspan="4" class="py-4 text-center text-muted small">기록된 입고 이벤트가 없습니다.</td></tr>`;
            }
            updateDisplay();
            scrollToRecentDate(body);
        } catch (err) {
            console.error('입고 조회 실패:', err);
        }
    };

    /* ─────────────────────────────────────
       우측 하단: 월별 출고 현황 (일자별 스크롤 목록)
    ───────────────────────────────────── */
    App.loadUsageDaily = async function () {
        const body = document.getElementById('out-body');
        const dateTxt = document.getElementById('out-date-txt');
        if (dateTxt) dateTxt.textContent = `${state.outYear}년 ${state.outMonth}월`;
        if (!body) return;

        try {
            const data = await App.fetchUsageDaily(state.outYear, state.outMonth);
            const rows = (data && data.rows) || [];

            if (rows.length > 0) {
                body.innerHTML = rows.map(r => `
                    <tr>
                        <td class="fw-semibold">${r.date_display}</td>
                        <td class="text-center">${fmtVal(r.A)}</td>
                        <td class="text-center">${fmtVal(r.C)}</td>
                        <td class="text-center">${fmtVal(r.D)}</td>
                    </tr>
                `).join('');
            } else {
                body.innerHTML = `<tr><td colspan="4" class="py-4 text-center text-muted small">기록된 출고 이벤트가 없습니다.</td></tr>`;
            }

            const byItem = (data && data.byItem) || { A: 0, C: 0, D: 0 };
            const total = (data && data.total) || 0;
            const outA = document.getElementById('out-total-a');
            const outC = document.getElementById('out-total-c');
            const outD = document.getElementById('out-total-d');
            const outAll = document.getElementById('out-total-all');
            if (outA) outA.textContent = byItem.A.toLocaleString();
            if (outC) outC.textContent = byItem.C.toLocaleString();
            if (outD) outD.textContent = byItem.D.toLocaleString();
            if (outAll) outAll.textContent = total.toLocaleString();

            scrollToRecentDate(body);
        } catch (err) {
            console.error('월별 출고 조회 실패:', err);
        }
    };

    /* ─────────────────────────────────────
       우측 패널 네비게이션 바인딩 (연도 이동 / 월 이동 / 단위 스위처)
    ───────────────────────────────────── */
    function bindSidePanelEvents() {
        const inPrev = document.getElementById('in-prev');
        const inNext = document.getElementById('in-next');
        const outPrev = document.getElementById('out-prev');
        const outNext = document.getElementById('out-next');
        const unitBtns = document.querySelectorAll('#unitToggle .unit-btn');
        const switcherBg = document.getElementById('switcherBg');

        if (inPrev && inNext) {
            inPrev.addEventListener('click', () => { state.inYear--; App.loadInbound(); });
            inNext.addEventListener('click', () => { state.inYear++; App.loadInbound(); });
        }

        if (outPrev && outNext) {
            outPrev.addEventListener('click', () => {
                state.outMonth--;
                if (state.outMonth < 1) { state.outMonth = 12; state.outYear--; }
                App.loadUsageDaily();
            });
            outNext.addEventListener('click', () => {
                state.outMonth++;
                if (state.outMonth > 12) { state.outMonth = 1; state.outYear++; }
                App.loadUsageDaily();
            });
        }

        unitBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                state.unit = btn.getAttribute('data-unit');
                unitBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                if (switcherBg) switcherBg.className = state.unit === 'KG' ? 'selection-bg mode-kg' : 'selection-bg mode-roll';
                updateDisplay();
            });
        });
    }

    /* ─────────────────────────────────────
       모듈 UI 초기화 (main.js init()에서 1회 호출)
    ───────────────────────────────────── */
    App.initUI = function () {
        bindScrollSync();
        bindBodyClicks();
        bindKeyboardNav();
        bindSidePanelEvents();
    };

})();