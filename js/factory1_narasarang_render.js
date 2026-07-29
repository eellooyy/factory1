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

        /* 한 줄이 네 표에 걸쳐 있으니 넷을 같이 칠합니다 (눈에 띄는 건 날짜
           칸이지만, 줄 상태를 한 패널만 알고 있으면 나중에 반드시 어긋납니다) */
        App.elements.wrapper.querySelectorAll(`tr[data-date="${date}"]`).forEach(tr => {
            tr.classList.toggle('f1ns-row-dirty', state.dirtyRows.has(date));
        });

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

    /* ── 네 패널 ─────────────────────────────────────────────────────────────
       한 줄이 네 표에 걸쳐 있습니다. 줄을 만들 때도, 지울 때도, 문구를 띄울
       때도 넷을 같이 건드려야 합니다 — 하나만 빠지면 그 아래 줄이 전부 한 칸씩
       밀려 다른 날짜와 나란히 서게 됩니다.
       ──────────────────────────────────────────────────────────────────────── */
    function panelBodies() {
        const bodies = App.BODY_IDS.map(id => document.getElementById(id));
        return bodies.every(Boolean) ? bodies : null;
    }

    /* 표에 그릴 줄이 없을 때. 문구는 첫 패널에만 쓰고 나머지는 같은 높이의
       빈 줄로 채웁니다. 네 표의 높이가 어긋나면 카드 아랫단이 들쭉날쭉해집니다. */
    App.renderMessage = function (text) {
        const bodies = panelBodies();
        if (!bodies) return;

        bodies.forEach((body, i) => {
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = App.PANEL_COLS[i];
            td.className = 'f1ns-blank';
            td.textContent = (i === 0) ? text : '';
            tr.appendChild(td);
            body.innerHTML = '';
            body.appendChild(tr);
        });
    };

    // ── 표 ───────────────────────────────────────────────────────────────────
    App.renderRows = function () {
        const bodies = panelBodies();
        if (!bodies) return;

        bodies.forEach(b => { b.innerHTML = ''; });

        if (!state.rows.length) {
            App.renderMessage(`${state.year}년에는 입고 · 출고 · 잔량 기록이 없습니다.`);
            return;
        }

        const cursorDate = App.headerApi ? App.headerApi.getCurrentDate() : null;

        /* ── 출고(완롤) ──────────────────────────────────────────────────
           출고 = 직전 줄의 지고 재고 + 그 사이의 입고 − 이 줄의 지고 재고.
           줄이 연속된 날짜가 아니라 '일이 있었던 날'뿐이라, 두 줄 사이가 몇
           달일 수 있습니다. 그래도 재고가 줄어든 만큼이 나간 양이라는 건 같습니다.

           지고 재고가 없는 날은 뺄 기준이 없으므로 출고를 비웁니다. 대신 그
           줄의 입고는 pendingIn 에 쌓아 두었다가 다음에 지고 재고가 나오는
           줄에서 함께 텁니다 — 버리면 그 입고만큼 출고가 부풀어 오릅니다.
           맨 윗줄(기준행)은 직전이 없어 언제나 비어 있습니다.
           ──────────────────────────────────────────────────────────── */
        let prevJigo = null;
        let pendingIn = 0;

        state.rows.forEach(row => {
            const d = row.date;

            const trs = bodies.map(body => {
                const tr = document.createElement('tr');
                tr.dataset.date = d;
                if (row.isBase) tr.classList.add('f1ns-row-base');
                if (d === cursorDate) tr.classList.add('f1ns-row-cursor');
                body.appendChild(tr);
                return tr;
            });

            // ① 날짜 · 입고 · 출고 · 지고 재고 (완롤)
            const dateTd = document.createElement('td');
            dateTd.className = 'f1ns-date-td ' + dayClass(d);
            dateTd.textContent = fmtDate(d);
            if (row.isBase) dateTd.title = `${d} — 이전 연도의 마지막 기록입니다. 여기서 재고가 이어집니다.`;
            trs[0].appendChild(dateTd);

            const jigoNow = state.jigo[d];
            pendingIn += (state.ipgo[d] || 0);

            let outRoll = null;
            if (jigoNow !== undefined && jigoNow !== null) {
                if (prevJigo !== null) outRoll = prevJigo + pendingIn - jigoNow;
                prevJigo = jigoNow;
                pendingIn = 0;
            }

            trs[0].appendChild(textCell(fmt(state.ipgo[d], 0)));
            trs[0].appendChild(textCell(fmt(outRoll, 0), 'f1ns-out-roll-td f1ns-sep'));
            trs[0].appendChild(textCell(fmt(jigoNow, 0), 'f1ns-sep'));

            // ② B5 주행지 잔량 6칸 + 합계
            const carried = state.carry[d] || {};
            for (let s = 1; s <= App.SLOTS; s++) {
                if (row.isBase) {
                    // 기준행은 읽기만 — 조회 연도 밖이라 여기서 고칠 값이 아닙니다
                    trs[1].appendChild(textCell(fmt(carried[s])));
                } else {
                    trs[1].appendChild(slotInput(d, s, carried[s]));
                }
            }

            const totalTd = document.createElement('td');
            totalTd.className = 'f1ns-sum-td f1ns-sep';
            totalTd.dataset.total = d;
            trs[1].appendChild(totalTd);

            // ③ 재고(kg) = 지고 재고 × 롤중량 + 잔량 합계 (계산값)
            const stockTd = document.createElement('td');
            stockTd.className = 'f1ns-stock-td';
            stockTd.dataset.stock = d;
            trs[2].appendChild(stockTd);

            // ④ 출고(kg) — ERP 사용량
            trs[3].appendChild(textCell(fmt(state.usage[d], 0)));
        });

        state.rows.forEach(row => refreshRowTotals(row.date));

        /* 맨 아래(가장 최근)로 내려놓습니다. 이 표는 위가 과거고 아래가 현재라,
           열자마자 보여야 하는 건 몇 달 전 줄이 아니라 방금 있었던 일입니다.
           잠금 상태(overflow-y: hidden)에서도 scrollTop 은 그대로 먹습니다. */
        App.PANEL_IDS.forEach(id => {
            const sc = document.getElementById(id);
            if (sc) sc.scrollTop = sc.scrollHeight;
        });

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
            App.renderMessage('조회에 실패했습니다. 잠시 후 다시 시도해 주세요.');
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
           표만 따로 굴리고 싶을 때 켭니다. (지고 재고 · 사용량 페이지와 동일)
           패널이 넷이라 넷을 한꺼번에 여닫습니다. */
        const panels = App.PANEL_IDS.map(id => document.getElementById(id)).filter(Boolean);
        const toggle = document.getElementById('f1nsScrollToggle');
        if (panels.length && toggle) {
            toggle.checked = false;
            panels.forEach(p => p.classList.add('locked'));
            toggle.addEventListener('change', function () {
                panels.forEach(p => p.classList.toggle('locked', !toggle.checked));
            });
        }

        /* 한 줄이 네 표에 걸쳐 있으므로 세로 스크롤을 묶습니다. 따로 굴리면
           같은 높이에 다른 날짜가 서고, 그 순간 표가 거짓말을 합니다.
           _syncLock 은 되받아치는 scroll 이벤트를 한 번만 무시하려는 것입니다.
           (3공장 재고 종합과 같은 처리) */
        let syncLock = false;
        panels.forEach(el => {
            el.addEventListener('scroll', function () {
                if (syncLock) return;
                syncLock = true;
                const top = el.scrollTop;
                panels.forEach(other => { if (other !== el) other.scrollTop = top; });
                syncLock = false;
            });
        });
    };

    App.utils = { parseNum, fmt, fmtDate };
})();
