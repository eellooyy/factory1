/* factory1_narasarang_render.js — 1공장 나라사랑(48.8g) 화면 그리기
   ────────────────────────────────────────────────────────────────
   줄이 몇 십 개뿐이라(한 해에 25줄 안팎) 과거 스크롤 페이징이 없습니다.
   연도 하나를 통째로 받아 한 번에 그립니다. 다른 페이지의 '스크롤 ON/OFF'
   토글이 여기 없는 이유입니다 — 잠글 것이 없습니다.

   입력칸은 **처음부터 만들어 두고 readOnly 만 여닫습니다.** 편집 모드에
   들어갈 때 셀을 다시 그리면 합계가 한 박자 늦게 따라오고, 무엇보다 줄
   높이가 흔들려 표가 튑니다. (급지 재고 페이지와 같은 방식)
   ──────────────────────────────────────────────────────────────── */
(function () {
    'use strict';

    const App = window.Factory1Narasarang;
    if (!App) return;

    const state = App.state;
    const utils = window.Factory3Utils || window.CommonUtils;

    /* ── 숫자 ────────────────────────────────────────────────────────────────
       잔량은 kg 이라 소수가 나옵니다(454.0 · 791.5). 롤은 언제나 정수입니다.
       ──────────────────────────────────────────────────────────────────────── */
    function parseNum(v) {
        if (v === null || v === undefined) return null;
        const s = String(v).replace(/,/g, '').trim();
        if (s === '') return null;
        const n = Number(s);
        return isNaN(n) ? null : n;
    }

    function fmt(n, digits) {
        if (n === null || n === undefined || isNaN(n)) return null;
        return Number(n).toLocaleString('ko-KR', { maximumFractionDigits: digits === undefined ? 1 : digits });
    }

    function fmtDate(ds) {
        const d = new Date(ds + 'T00:00:00');
        return `${d.getMonth() + 1}/${d.getDate()}(${App.WD_KR[d.getDay()]})`;
    }

    function dayClass(ds) {
        const w = new Date(ds + 'T00:00:00').getDay();
        if (w === 0) return 'f1ns-sun';
        if (w === 6) return 'f1ns-sat';
        return '';
    }

    /* 값이 없는 칸은 '–' 입니다. 0 과 구분하지 않습니다 — 이 화면에서 0 롤과
       "그날 입고가 없었다"는 같은 말이고, 굳이 0 을 찍으면 눈이 그쪽으로
       끌려 정작 봐야 할 변동을 놓칩니다. */
    function textCell(value, cls) {
        const td = document.createElement('td');
        if (cls) td.className = cls;
        if (value === null || value === undefined || value === '') {
            td.innerHTML = '<span class="f1ns-empty">–</span>';
        } else {
            td.textContent = value;
        }
        return td;
    }

    // ── 잔량 입력칸 ──────────────────────────────────────────────────────────
    function slotInput(date, slot, value) {
        const td = document.createElement('td');
        td.className = 'f1ns-edit-cell';

        const inp = document.createElement('input');
        inp.type = 'text';
        inp.className = 'f1ns-input';
        inp.inputMode = 'decimal';
        inp.autocomplete = 'off';
        inp.readOnly = true;                 // 편집 모드에서만 열립니다
        inp.dataset.date = date;
        inp.dataset.slot = String(slot);
        inp.value = (value === undefined || value === null) ? '' : fmt(value);

        inp.addEventListener('input', function () { onCellInput(date); });
        td.appendChild(inp);
        return td;
    }

    /* 한 줄의 6칸을 읽습니다. 빈 칸은 null — 저장 쪽에서 0 과 구분해 씁니다. */
    App.readRowInputs = function (date) {
        const out = [];
        for (let s = 1; s <= App.SLOTS; s++) {
            const inp = App.elements.wrapper
                .querySelector(`.f1ns-input[data-date="${date}"][data-slot="${s}"]`);
            out.push(inp ? parseNum(inp.value) : null);
        }
        return out;
    };

    /* 원본과 같아지면 dirty 에서 빠집니다. 값을 고쳤다가 되돌린 줄까지
       저장하면 손대지 않은 날짜에 못이 박혀, 앞 날짜를 고쳐도 안 따라옵니다.

       칸 단위로도 표시합니다 — 한 칸만 고쳐도 그 줄은 6칸이 전부 저장되므로,
       "내가 건드린 게 어디였나"를 줄 색만으로는 알 수가 없습니다. */
    function markRowDirty(date) {
        const before = state.carry[date] || {};
        const now = App.readRowInputs(date);
        let rowDirty = false;

        for (let s = 1; s <= App.SLOTS; s++) {
            const b = before[s];
            const n = now[s - 1];
            const same = (n === null && (b === undefined || b === null))
                      || (n !== null && b !== undefined && b !== null && Number(b) === n);

            const inp = App.elements.wrapper
                .querySelector(`.f1ns-input[data-date="${date}"][data-slot="${s}"]`);
            if (inp) inp.classList.toggle('f1ns-dirty', !same);
            if (!same) rowDirty = true;
        }
        return rowDirty;
    }

    function onCellInput(date) {
        if (markRowDirty(date)) state.dirtyRows.add(date);
        else state.dirtyRows.delete(date);

        state.isChanged = state.dirtyRows.size > 0;

        const tr = App.elements.wrapper.querySelector(`tr[data-date="${date}"]`);
        if (tr) tr.classList.toggle('f1ns-row-dirty', state.dirtyRows.has(date));

        refreshRowTotals(date);
    }

    /* 잔량 합계와 재고(kg) 는 저장하지 않는 계산값이라, 입력할 때마다 바로
       다시 셉니다. 화면의 숫자와 저장될 숫자가 어긋나 보이면 안 됩니다. */
    function refreshRowTotals(date) {
        const vals = App.readRowInputs(date);
        const sum = vals.reduce((s, v) => s + (v || 0), 0);
        const any = vals.some(v => v !== null);

        const totalTd = App.elements.wrapper.querySelector(`td[data-total="${date}"]`);
        if (totalTd) {
            totalTd.innerHTML = any
                ? fmt(sum)
                : '<span class="f1ns-empty">–</span>';
        }

        const stockTd = App.elements.wrapper.querySelector(`td[data-stock="${date}"]`);
        if (stockTd) {
            const roll = state.jigo[date];
            stockTd.innerHTML = (roll === undefined)
                ? '<span class="f1ns-empty">–</span>'
                : fmt(roll * App.ROLL_KG + sum, 0);
        }
    }

    // ── 표 ───────────────────────────────────────────────────────────────────
    App.renderRows = function () {
        const body = document.getElementById('f1nsBody');
        if (!body) return;

        body.innerHTML = '';

        if (!state.rows.length) {
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = 5 + App.SLOTS;
            td.className = 'f1ns-blank';
            td.textContent = `${state.year}년에는 입고 · 출고 · 잔량 기록이 없습니다.`;
            tr.appendChild(td);
            body.appendChild(tr);
            return;
        }

        const cursorDate = App.headerApi ? App.headerApi.getCurrentDate() : null;

        state.rows.forEach(row => {
            const d = row.date;
            const tr = document.createElement('tr');
            tr.dataset.date = d;
            if (row.isBase) tr.classList.add('f1ns-row-base');
            if (d === cursorDate) tr.classList.add('f1ns-row-cursor');

            // 날짜
            const dateTd = document.createElement('td');
            dateTd.className = 'f1ns-date-td ' + dayClass(d);
            dateTd.textContent = fmtDate(d);
            if (row.isBase) dateTd.title = `${d} — 이전 연도의 마지막 기록입니다. 여기서 재고가 이어집니다.`;
            tr.appendChild(dateTd);

            // 입고 · 지고 재고 (완롤)
            tr.appendChild(textCell(fmt(state.ipgo[d], 0), 'f1ns-sep'));
            tr.appendChild(textCell(fmt(state.jigo[d], 0), 'f1ns-sep'));

            // B5 주행지 잔량 6칸
            const carried = state.carry[d] || {};
            for (let s = 1; s <= App.SLOTS; s++) {
                if (row.isBase) {
                    // 기준행은 읽기만 — 조회 연도 밖이라 여기서 고칠 값이 아닙니다
                    tr.appendChild(textCell(fmt(carried[s]), s === 1 ? 'f1ns-sep' : ''));
                } else {
                    const td = slotInput(d, s, carried[s]);
                    if (s === 1) td.classList.add('f1ns-sep');
                    tr.appendChild(td);
                }
            }

            // 잔량 합계 (계산값)
            const totalTd = document.createElement('td');
            totalTd.className = 'f1ns-sum-td';
            totalTd.dataset.total = d;
            tr.appendChild(totalTd);

            // 재고(kg) = 지고 재고 × 롤중량 + 잔량 합계 (계산값)
            const stockTd = document.createElement('td');
            stockTd.className = 'f1ns-stock-td f1ns-sep';
            stockTd.dataset.stock = d;
            tr.appendChild(stockTd);

            // 출고(kg) — ERP 사용량
            tr.appendChild(textCell(fmt(state.usage[d], 0), 'f1ns-sep'));

            body.appendChild(tr);
        });

        state.rows.forEach(row => refreshRowTotals(row.date));

        /* 맨 아래(가장 최근)로 내려놓습니다. 이 표는 위가 과거고 아래가 현재라,
           열자마자 보여야 하는 건 몇 달 전 줄이 아니라 방금 있었던 일입니다.
           잠금 상태(overflow-y: hidden)에서도 scrollTop 은 그대로 먹습니다. */
        const sc = document.getElementById('f1nsScroll');
        if (sc) sc.scrollTop = sc.scrollHeight;

        // 편집 모드 중에 다시 그렸다면 입력칸을 다시 열어 줍니다
        if (App.headerApi && App.headerApi.isEditMode()) App.setReadOnlyMode(false);
    };

    /* ── 편집 모드 ───────────────────────────────────────────────────────────
       기준행은 열지 않습니다. 조회 연도 밖의 날짜라 여기서 고치면 화면에
       보이지도 않는 다음 해의 계승이 움직입니다.
       ──────────────────────────────────────────────────────────────────────── */
    App.setReadOnlyMode = function (isReadOnly) {
        App.elements.wrapper.querySelectorAll('.f1ns-input').forEach(inp => {
            inp.readOnly = isReadOnly;
        });
        const btn = document.getElementById('f1nsAddDateBtn');
        if (btn) btn.disabled = isReadOnly;

        /* edit-mode 클래스를 여기서 직접 답니다.
           CommonHeader 도 같은 클래스를 붙이지만 `document.querySelector('.gf3-wrapper')`
           로 찾아서 **맨 위 헤더 래퍼**를 잡습니다. 본문 래퍼는 두 번째
           `.gf3-wrapper`(= .f1ns-wrapper)라 거기까지 닿지 않아, 입력칸 배경색
           규칙(.f1ns-wrapper.edit-mode ...)이 켜지지 않습니다. */
        App.elements.wrapper.classList.toggle('edit-mode', !isReadOnly);
    };

    /* ── [+ 이 날짜 추가] ────────────────────────────────────────────────────
       인쇄 당일 아침처럼 ERP 출고가 아직 안 올라온 날은 자동으로 줄이 안
       생깁니다. 그때만 쓰는 버튼입니다. 저장하면 잔량 행이 생기면서 다음
       조회부터는 자동 기준으로 잡히므로, 이 목록은 저장 후 비웁니다.
       ──────────────────────────────────────────────────────────────────────── */
    App.addCurrentDate = function () {
        const d = App.headerApi.getCurrentDate();

        if (String(d).slice(0, 4) !== String(state.year)) {
            alert('지금 보고 있는 연도의 날짜만 추가할 수 있습니다.');
            return;
        }
        if (state.rows.some(r => r.date === d)) {
            alert('이미 표에 있는 날짜입니다.');
            return;
        }
        if (state.dirtyRows.size) {
            alert('저장하지 않은 변경이 있습니다. 먼저 저장해 주세요.');
            return;
        }

        state.extraDates.push(d);
        App.loadData(d);
    };

    // ── 조회 진입점 ──────────────────────────────────────────────────────────
    App.loadData = async function (dateStr) {
        if (state.loading) return;
        state.loading = true;

        const year = Number(String(dateStr).slice(0, 4));
        state.year = year;

        const yearLabel = document.getElementById('f1nsYearLabel');
        if (yearLabel) yearLabel.textContent = `${year}년`;

        const ok = await App.fetchYear(year);
        state.loading = false;

        if (!ok) {
            const body = document.getElementById('f1nsBody');
            if (body) {
                body.innerHTML =
                    `<tr><td class="f1ns-blank" colspan="${5 + App.SLOTS}">조회에 실패했습니다. 잠시 후 다시 시도해 주세요.</td></tr>`;
            }
            return;
        }

        state.dirtyRows.clear();
        state.isChanged = false;
        App.renderRows();
    };

    App.initUI = function () {
        const btn = document.getElementById('f1nsAddDateBtn');
        if (btn) {
            btn.disabled = true;   // 편집 모드에서만 열립니다
            btn.addEventListener('click', App.addCurrentDate);
        }

        /* 스크롤 잠금 — 기본은 OFF(잠김)입니다. 표 안에 8줄만 보이고 그 아래는
           가려지는데, 잠가 두면 표 위에서 휠을 굴려도 페이지가 스크롤됩니다.
           표만 따로 굴리고 싶을 때 켭니다. (지고 재고 · 사용량 페이지와 동일) */
        const scroll = document.getElementById('f1nsScroll');
        const toggle = document.getElementById('f1nsScrollToggle');
        if (scroll && toggle) {
            toggle.checked = false;
            scroll.classList.add('locked');
            toggle.addEventListener('change', function () {
                scroll.classList.toggle('locked', !toggle.checked);
            });
        }
    };

    App.utils = { parseNum, fmt, fmtDate };
})();
