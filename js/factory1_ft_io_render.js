/* factory1_ft_io_render.js — 1공장 FT 재고 종합 UI 렌더링 및 제어 */
(function () {
    'use strict';

    const App = window.Factory1FtIo;
    if (!App) return;

    const state = App.state;
    const PANEL_IDS = App.PANEL_IDS;

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

    App.setReadOnlyMode = function (isReadOnly) {
        const wrapper = App.elements.wrapper;
        if (!wrapper) return;
    };

    function updateScrollLockUI() {
        PANEL_IDS.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            if (state.isScrollUnlocked) {
                el.classList.remove('locked');
            } else {
                el.classList.add('locked');
            }
        });
    }

    function bindScrollToggle() {
        const toggle = document.getElementById('compScrollToggle');
        if (!toggle) return;

        toggle.checked = !!state.isScrollUnlocked;
        updateScrollLockUI();

        toggle.addEventListener('change', (e) => {
            state.isScrollUnlocked = e.target.checked;
            updateScrollLockUI();
        });
    }

    function bindScrollSync() {
        PANEL_IDS.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;

            // 스크롤 잠금 상태 시 마우스 휠 동작 차단
            el.addEventListener('wheel', (e) => {
                if (!state.isScrollUnlocked) {
                    e.preventDefault();
                }
            }, { passive: false });

            el.addEventListener('scroll', () => {
                if (!state.isScrollUnlocked) return; // 잠금 상태 시 동기화 및 로드 차단
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

    function hideCursors() {
        [1, 2, 3, 4].forEach(i => {
            const c = document.getElementById(`compCursor${i}`);
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
        const cursorEl = document.getElementById(`compCursor${panelIdx}`);
        const panelEl = document.getElementById(`compScrollPanel${panelIdx}`);
        if (!cursorEl || !panelEl || !td) return;

        const pos = getOffsetRelativeToPanel(td, panelEl);
        cursorEl.style.width = td.offsetWidth + 'px';
        cursorEl.style.height = td.offsetHeight + 'px';
        cursorEl.style.left = pos.left + 'px';
        cursorEl.style.top = pos.top + 'px';
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
            scrollPanel.querySelectorAll('.comp-leaf-th').forEach(th => th.classList.add('comp-header-active'));
        }
    }

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
                let targetRow = bodies[0].querySelector(`tr[data-date="${yesterdayStr()}"]`);
                if (!targetRow) targetRow = bodies[0].querySelector('.comp-row-today');
                if (!targetRow) targetRow = bodies[0].querySelector(`tr[data-date="${state.compBaseDate}"]`);

                if (targetRow) {
                    requestAnimationFrame(() => {
                        const wrapH = panel1.clientHeight;
                        const top = targetRow.offsetTop + targetRow.offsetHeight - wrapH;
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

    /* ────────────────────────────────────────────────────────────
       2층 좌측: 입고 현황
       ──────────────────────────────────────────────────────────── */
    function rowHtmlInbound(r) {
        return `
            <tr data-offset="${r.day_offset}">
                <td class="fw-bold">${r.date_display}</td>
                <td class="unit-cell text-center" data-rl="${r.A_rl}" data-kg="${r.A_kg}"></td>
                <td class="unit-cell text-center" data-rl="${r.C_rl}" data-kg="${r.C_kg}"></td>
                <td class="unit-cell text-center" data-rl="${r.D_rl}" data-kg="${r.D_kg}"></td>
            </tr>`;
    }

    App.loadInbound = async function () {
        const body = document.getElementById('in-body');
        const yearTxt = document.getElementById('in-year-txt');
        if (yearTxt) yearTxt.textContent = `${state.inYear}년`;
        if (!body) return;

        state.inOffset = 0;
        state.inHasMore = true;
        state.inLoading = false;

        try {
            const data = await App.fetchInboundList(0, App.INBOUND_BATCH);
            if (data && data.length > 0) {
                body.innerHTML = data.map(rowHtmlInbound).join('');
                state.inOffset = App.INBOUND_BATCH;
            } else {
                body.innerHTML = `<tr><td colspan="4" class="py-4 text-center text-muted small">기록된 입고 이벤트가 없습니다.</td></tr>`;
                state.inHasMore = false;
            }
            updateDisplay();

            const wrapper = body.closest('.table-scroll-wrapper');
            if (wrapper) {
                requestAnimationFrame(() => {
                    wrapper.scrollTop = wrapper.scrollHeight;
                });
            }
        } catch (err) {
            console.error('입고 조회 실패:', err);
        }
    };

    async function loadMoreInbound() {
        if (state.inLoading || !state.inHasMore) return;
        if (state.inOffset >= App.INBOUND_MAX_DAYS) { state.inHasMore = false; return; }

        state.inLoading = true;
        const body = document.getElementById('in-body');
        const wrapper = body ? body.closest('.table-scroll-wrapper') : null;
        const prevScrollHeight = wrapper ? wrapper.scrollHeight : 0;
        const prevScrollTop = wrapper ? wrapper.scrollTop : 0;

        try {
            const batchSize = Math.min(App.INBOUND_BATCH, App.INBOUND_MAX_DAYS - state.inOffset);
            const data = await App.fetchInboundList(state.inOffset, batchSize);
            if (data && data.length > 0 && body) {
                body.insertAdjacentHTML('afterbegin', data.map(rowHtmlInbound).join(''));
                state.inOffset += batchSize;
                updateDisplay();

                if (wrapper) {
                    requestAnimationFrame(() => {
                        const diff = wrapper.scrollHeight - prevScrollHeight;
                        wrapper.scrollTop = prevScrollTop + diff;
                    });
                }
            }
            if (state.inOffset >= App.INBOUND_MAX_DAYS) state.inHasMore = false;
        } catch (err) {
            console.error('입고 과거 데이터 조회 실패:', err);
        } finally {
            state.inLoading = false;
        }
    }

    /* ────────────────────────────────────────────────────────────
       2층 우측: 월별 출고 현황
       ──────────────────────────────────────────────────────────── */
    function rowHtmlOutbound(r) {
        return `
            <tr data-offset="${r.month_offset}">
                <td class="fw-bold">${r.date_display}</td>
                <td class="text-center">${fmtVal(r.A)}</td>
                <td class="text-center">${fmtVal(r.C)}</td>
                <td class="text-center">${fmtVal(r.D)}</td>
            </tr>`;
    }

    App.loadUsageMonthly = async function () {
        const body = document.getElementById('out-body');
        const dateTxt = document.getElementById('out-date-txt');
        if (dateTxt) dateTxt.textContent = `${state.outYear}년`;
        if (!body) return;

        state.outOffset = 0;
        state.outHasMore = true;
        state.outLoading = false;

        try {
            const data = await App.fetchUsageMonthly(0, App.OUTBOUND_BATCH);
            const rows = (data && data.rows) || [];

            if (rows.length > 0) {
                body.innerHTML = rows.map(rowHtmlOutbound).join('');
                state.outOffset = App.OUTBOUND_BATCH;
            } else {
                body.innerHTML = `<tr><td colspan="4" class="py-4 text-center text-muted small">기록된 출고 이벤트가 없습니다.</td></tr>`;
                state.outHasMore = false;
            }

            const wrapper = body.closest('.table-scroll-wrapper');
            if (wrapper) {
                requestAnimationFrame(() => {
                    wrapper.scrollTop = wrapper.scrollHeight;
                });
            }
        } catch (err) {
            console.error('월별 출고 조회 실패:', err);
        }
    };

    async function loadMoreOutbound() {
        if (state.outLoading || !state.outHasMore) return;
        if (state.outOffset >= App.OUTBOUND_MAX_MONTHS) { state.outHasMore = false; return; }

        state.outLoading = true;
        const body = document.getElementById('out-body');
        const wrapper = body ? body.closest('.table-scroll-wrapper') : null;
        const prevScrollHeight = wrapper ? wrapper.scrollHeight : 0;
        const prevScrollTop = wrapper ? wrapper.scrollTop : 0;

        try {
            const batchSize = Math.min(App.OUTBOUND_BATCH, App.OUTBOUND_MAX_MONTHS - state.outOffset);
            const data = await App.fetchUsageMonthly(state.outOffset, batchSize);
            const rows = (data && data.rows) || [];
            if (rows.length > 0 && body) {
                body.insertAdjacentHTML('afterbegin', rows.map(rowHtmlOutbound).join(''));
                state.outOffset += batchSize;

                if (wrapper) {
                    requestAnimationFrame(() => {
                        const diff = wrapper.scrollHeight - prevScrollHeight;
                        wrapper.scrollTop = prevScrollTop + diff;
                    });
                }
            }
            if (state.outOffset >= App.OUTBOUND_MAX_MONTHS) state.outHasMore = false;
        } catch (err) {
            console.error('월별 출고 과거 데이터 조회 실패:', err);
        } finally {
            state.outLoading = false;
        }
    }

    function bindHistoryScroll() {
        const inWrapper = document.getElementById('in-body') && document.getElementById('in-body').closest('.table-scroll-wrapper');
        const outWrapper = document.getElementById('out-body') && document.getElementById('out-body').closest('.table-scroll-wrapper');
        const threshold = 30;

        if (inWrapper) {
            inWrapper.addEventListener('scroll', () => {
                if (inWrapper.scrollTop <= threshold) loadMoreInbound();
            });
        }
        if (outWrapper) {
            outWrapper.addEventListener('scroll', () => {
                if (outWrapper.scrollTop <= threshold) loadMoreOutbound();
            });
        }
    }

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
            outPrev.addEventListener('click', () => { state.outYear--; App.loadUsageMonthly(); });
            outNext.addEventListener('click', () => { state.outYear++; App.loadUsageMonthly(); });
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

    App.initUI = function () {
        bindScrollToggle();
        bindScrollSync();
        bindBodyClicks();
        bindKeyboardNav();
        bindSidePanelEvents();
        bindHistoryScroll();
    };

})();