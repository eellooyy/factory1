/* factory1_inventory_io_render.js — 1공장 재고 종합 화면 렌더링
   ────────────────────────────────────────────────────────────────
   constant.js의 LOCATIONS(고정 텍스트)로 표의 뼈대를 만들고,
   state.values(숫자 데이터)를 채워 넣습니다.

   숫자 데이터의 키는 `${저장위치코드}|${품목코드}` 이며 값은
     { erp, inQty, useQty, b5, b6, b6run }
   형태입니다. 값이 없으면 해당 칸은 '–' 로 표시됩니다.
   api.js가 state.values 를 채운 뒤 renderTable()을 호출합니다.

   '–' 는 0 이 아니라 "그날 실사 입력이 없었다"는 뜻입니다. 두 가지를 섞으면
   재고가 없는 것과 안 센 것이 구분되지 않아 오차 해석이 성립하지 않습니다.
   ──────────────────────────────────────────────────────────────── */
(function () {
    'use strict';

    const App = window.Factory1InventoryIo;
    if (!App) return;

    const EMPTY = '–';

    function valueKey(locCode, itemCode) {
        return `${locCode}|${itemCode}`;
    }

    // 메모는 사람이 적는 자유 문자열이라 그대로 붙이면 태그로 해석됩니다
    function escapeHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    /* 열 번호 — 셀을 짚었을 때 '위쪽'으로 따라 올라갈 머리글과, 같은 열의
       윗 칸들을 찾는 키입니다. 저장위치 칸이 세로 병합이라 cellIndex 로는
       행마다 번호가 어긋나서, 그릴 때 아예 붙여 둡니다.
       번호는 COLGROUP 의 열 순서(0~10)이고 THEAD 의 data-cols 와 짝입니다. */
    function colAttr(col) {
        return (col === null || col === undefined) ? '' : ` data-col="${col}"`;
    }

    // 숫자 포맷 (천 단위 콤마). 값이 없으면 회색 '–'
    function numCell(value, extraClass, title, col) {
        const cls = ['f1inv-num'];
        if (extraClass) cls.push(extraClass);
        const attr = (title ? ` title="${title}"` : '') + colAttr(col);

        if (value === null || value === undefined || value === '' || isNaN(value)) {
            cls.push('f1inv-empty');
            return `<td class="${cls.join(' ')}"${attr}>${EMPTY}</td>`;
        }
        return `<td class="${cls.join(' ')}"${attr}>${Number(value).toLocaleString('ko-KR')}</td>`;
    }

    /* 실재고 − ERP재고 차이 셀
       남는 쪽(+, 초록) / 모자란 쪽(−, 빨강)을 부호로도 드러냅니다. 색만으로는
       인쇄물이나 흑백 PDF 에서 방향이 사라집니다. 0 은 부호 없이 회색. */
    function diffCell(diff, col) {
        if (diff === null || diff === undefined || isNaN(diff)) {
            return `<td class="f1inv-num f1inv-sep f1inv-empty"${colAttr(col)}>${EMPTY}</td>`;
        }

        const n = Number(diff);
        let cls = 'f1inv-diff-zero';
        let text = '0';
        if (n > 0) {
            cls = 'f1inv-diff-positive';
            text = '+' + n.toLocaleString('ko-KR');
        } else if (n < 0) {
            cls = 'f1inv-diff-negative';
            text = '-' + Math.abs(n).toLocaleString('ko-KR');
        }

        return `<td class="f1inv-num f1inv-sep ${cls}"${colAttr(col)}>${text}</td>`;
    }

    // 한 품목 행의 숫자 묶음. api.js 가 fixed 까지 얹어 둡니다.
    function getValues(locCode, item) {
        return App.state.values[valueKey(locCode, item.code)]
            || Object.assign({}, item.fixed || {});
    }

    // 그 저장위치에서 실제로 그릴 품목 (고정값 행을 숨길 수 있습니다)
    function visibleItems(loc) {
        if (App.SHOW_FIXED_ITEMS) return loc.items;
        return loc.items.filter(item => !item.fixed);
    }

    function sumOrNull(v) {
        const parts = App.REAL_COLUMNS.map(col => v[col.key]);
        if (parts.some(p => p === null || p === undefined || p === '' || isNaN(p))) return null;
        return parts.reduce((acc, p) => acc + Number(p), 0);
    }

    /* 표 머리글은 카드 밖(#f1invHead)에 따로 서서 스크롤에도 붙어 있습니다.
       머리글과 카드들이 같은 colgroup 을 쓰고 table-layout: fixed 라 열이 그대로
       이어집니다 — colgroup 을 한쪽만 고치면 열이 어긋나므로 반드시 이 한 곳에서만
       관리합니다. */
    const COLGROUP = `
        <colgroup>
            <col class="f1inv-col-loc">   <!-- 저장위치 -->
            <col class="f1inv-col-code">  <!-- 품목코드 -->
            <col>                         <!-- 품목명 (남은 공간 전부) -->
            <col class="f1inv-col-erp">   <!-- ERP 재고 -->
            <col class="f1inv-col-io">    <!-- 입고 -->
            <col class="f1inv-col-io">    <!-- 사용량 -->
            <col class="f1inv-col-real">  <!-- B5 -->
            <col class="f1inv-col-real">  <!-- B6 -->
            <col class="f1inv-col-real">  <!-- B6(주행지) -->
            <col class="f1inv-col-sum">   <!-- 합계 -->
            <col class="f1inv-col-diff">  <!-- 실재고 - ERP재고 -->
        </colgroup>`;

    /* data-cols 는 그 머리글이 덮는 열 번호(COLGROUP 순서)입니다. 병합된
       머리글은 여러 개를 띄어쓰기로 적어 두고, 셀을 짚었을 때
       th[data-cols~="7"] 로 위쪽 머리글을 찾습니다. 열을 늘리면 COLGROUP ·
       여기 · 본문 셀 번호 셋을 같이 고쳐야 합니다. */
    const THEAD = `
        <thead>
            <tr class="f1inv-thead-lv1">
                <th data-cols="0">저장위치</th>
                <th colspan="2" class="f1inv-sep" data-cols="1 2">품목</th>
                <th rowspan="2" class="f1inv-sep" data-cols="3">ERP 재고</th>
                <th rowspan="2" data-cols="4">입고</th>
                <th rowspan="2" data-cols="5">사용량</th>
                <th colspan="4" class="f1inv-sep" data-cols="6 7 8 9">실재고</th>
                <th rowspan="2" class="f1inv-sep" data-cols="10">실재고<br>- ERP재고</th>
            </tr>
            <tr class="f1inv-thead-lv2">
                <th data-cols="0">저장위치명</th>
                <th class="f1inv-sep" data-cols="1">품목코드</th>
                <th data-cols="2">품목명</th>
                <th class="f1inv-sep" data-cols="6">B5</th>
                <th data-cols="7">B6</th>
                <th data-cols="8">B6(주행지)</th>
                <th data-cols="9">합계</th>
            </tr>
        </thead>`;

    const HEAD_CARD = '<div class="inner-layout-card f1inv-head-card">' +
                      '<table class="f1inv-table">' + COLGROUP + THEAD + '</table></div>';

    // 본문 열 번호 (COLGROUP 순서). 실재고 하위 열부터는 세면서 붙입니다.
    const COL_LOC = 0, COL_CODE = 1, COL_NAME = 2;
    const COL_ERP = 3, COL_IN = 4, COL_USE = 5, COL_REAL = 6;

    function renderHead(show) {
        if (App.elements.head) App.elements.head.innerHTML = show ? HEAD_CARD : '';
    }

    function renderTable() {
        const host = App.elements.blocks;
        if (!host) return;

        let html = '';

        App.LOCATIONS.forEach(loc => {
            const items = visibleItems(loc);
            if (!items.length) return;

            html += '<div class="inner-layout-card">';
            html += '<table class="f1inv-table">' + COLGROUP + '<tbody>';

            items.forEach((item, idx) => {
                const v = getValues(loc.locCode, item);
                const sum = sumOrNull(v);
                const erp = (v.erp === null || v.erp === undefined || v.erp === '' || isNaN(v.erp)) ? null : Number(v.erp);
                const diff = (sum === null || erp === null) ? null : sum - erp;

                html += '<tr>';

                // 저장위치 셀 — 그룹의 첫 행에서 품목 수만큼 세로 병합
                if (idx === 0) {
                    /* 대장이 있는 저장위치(ledger: true)에는 배지가 한 줄 더
                       붙습니다. 열을 늘리지 않고 이미 병합된 이 칸을 쓰는
                       이유는 ledger.js 머리말에 적어 두었습니다. */
                    const badge = App.ledgerBadgeHtml ? App.ledgerBadgeHtml(loc) : '';
                    const locCls = 'f1inv-loc-td' + (badge ? ' has-ledger' : '');
                    html += `
                        <td class="${locCls}" rowspan="${items.length}" data-col="${COL_LOC}">
                            <span class="f1inv-loc-name">${loc.locName}</span>
                            <span class="f1inv-loc-code">${loc.locCode}</span>
                            ${badge}
                        </td>`;
                }

                html += `<td class="f1inv-item-code" data-col="${COL_CODE}">${item.code}</td>`;
                html += `<td class="f1inv-item-name" title="${item.name}" data-col="${COL_NAME}">${item.name}</td>`;

                /* 고정값 칸은 점선 밑줄 + 툴팁으로 표시합니다. DB에서 온 숫자와
                   파일에 박아 둔 숫자가 같아 보이면 왜 안 변하는지 알 수 없습니다.
                   합계·차이는 계산값이라 표시하지 않습니다. */
                const fixed = item.fixed || {};
                const fixedCls = key => (
                    Object.prototype.hasOwnProperty.call(fixed, key) ? ' f1inv-fixed' : ''
                );

                html += numCell(erp, 'f1inv-sep' + fixedCls('erp'), item.fixedNote, COL_ERP);
                html += numCell(v.inQty, fixedCls('inQty').trim(), item.fixedNote, COL_IN);
                html += numCell(v.useQty, fixedCls('useQty').trim(), item.fixedNote, COL_USE);

                App.REAL_COLUMNS.forEach((col, i) => {
                    const cls = [];
                    if (i === 0) cls.push('f1inv-sep');
                    if (fixedCls(col.key)) cls.push('f1inv-fixed');
                    html += numCell(v[col.key], cls.join(' '), item.fixedNote, COL_REAL + i);
                });

                const colSum = COL_REAL + App.REAL_COLUMNS.length;
                html += numCell(sum, 'f1inv-sum', null, colSum);
                html += diffCell(diff, colSum + 1);

                html += '</tr>';
            });

            html += '</tbody></table></div>';
        });

        // 그릴 것이 없으면 머리글만 덩그러니 남지 않도록 같이 감춥니다
        renderHead(!!html);
        if (!html) {
            html = '<div class="f1inv-placeholder-box">표시할 품목이 없습니다.</div>';
        } else {
            // 고른 칸에 얹히는 유리 판. 표와 같이 스크롤되도록 안쪽에 둡니다.
            html += '<div class="f1inv-cursor" id="f1invCursor"></div>';
        }

        selected = null;   // 표를 다시 그리면 고른 칸도 사라집니다
        host.innerHTML = html;
    }

    function renderLoading() {
        const host = App.elements.blocks;
        if (!host) return;
        renderHead(false);
        host.innerHTML = '<div class="f1inv-placeholder-box">불러오는 중...</div>';
    }

    /* ── 셀 선택 ───────────────────────────────────────────────────────────
       칸을 누르면 지고 재고 · 입고 페이지와 같이 유리 커서가 얹히고 머리글이
       켜집니다. 다른 점은 자취뿐입니다 — 행·열을 통째로 칠하지 않고 왼쪽(같은
       행)과 위쪽(같은 열) 두 갈래만 칠합니다. 열이 11개라 다 칠하면 화면 절반이
       물들고, 숫자를 확인할 때 눈이 가는 곳도 왼쪽 끝의 품목명·저장위치와 위쪽
       끝의 열 이름 둘뿐입니다.

       위쪽 자취는 카드 경계를 넘어 머리글까지 이어집니다. 카드가 나뉘어 있어도
       열은 하나로 이어져 있어서, 중간에 끊기면 어느 열을 골랐는지 놓칩니다.

       방향키로 칸을 옮길 수 있고, 같은 칸을 다시 누르거나 Esc 로 풉니다.

       고른 자리는 DOM 이 아니라 (몇 번째 줄, 몇 번 열)로 들고 있습니다. 저장위치
       칸이 여러 줄을 세로로 덮고 있어서, 칸 하나만 기억하면 그 칸 안에서 지금
       몇 번째 줄에 있는지가 사라집니다. */
    const HL_CLASSES = ['f1inv-hl-row', 'f1inv-hl-col', 'f1inv-hl-head', 'f1inv-hl-cell'];

    let selected = null;   // { row: 표 전체에서 몇 번째 줄, col: 열 번호 }

    function dataRows() {
        return App.elements.blocks
            ? Array.from(App.elements.blocks.querySelectorAll('tbody tr'))
            : [];
    }

    function lastCol() {
        return COL_REAL + App.REAL_COLUMNS.length + 1;   // 합계 다음이 '실재고-ERP재고'
    }

    /* 그 줄의 그 열에 해당하는 칸.
       저장위치 칸은 그룹 첫 줄에만 있고 아래 줄들을 세로로 덮으므로, 아래 줄에서
       왼쪽 끝을 물으면 그 카드의 저장위치 칸을 돌려줍니다. */
    function cellAt(tr, col) {
        if (!tr) return null;
        const td = tr.querySelector(`td[data-col="${col}"]`);
        if (td) return td;
        if (col === COL_LOC) {
            const table = tr.closest('table');
            return table ? table.querySelector('.f1inv-loc-td') : null;
        }
        return null;
    }

    function moveCursor(td) {
        const host = App.elements.blocks;
        const cursor = host && host.querySelector('.f1inv-cursor');
        if (!cursor) return;

        if (!td) { cursor.classList.remove('active'); return; }

        // 카드·표를 거쳐 .f1inv-blocks 까지의 누적 위치 (커서의 기준 상자)
        let top = 0, left = 0, cur = td;
        while (cur && cur !== host) {
            top += cur.offsetTop;
            left += cur.offsetLeft;
            cur = cur.offsetParent;
        }

        cursor.style.top = `${top}px`;
        cursor.style.left = `${left}px`;
        cursor.style.width = `${td.offsetWidth}px`;
        cursor.style.height = `${td.offsetHeight}px`;
        cursor.classList.add('active');
    }

    /* 방향키로 옮긴 칸이 머리글 뒤나 화면 밖에 숨지 않도록 밀어 줍니다.
       scrollIntoView 는 고정 머리글을 모르기 때문에 직접 계산합니다. */
    function revealCell(td) {
        const box = App.elements.scroll;
        if (!box || !td) return;

        const cell = td.getBoundingClientRect();
        const view = box.getBoundingClientRect();
        const headH = App.elements.head ? App.elements.head.getBoundingClientRect().height : 0;

        if (cell.top < view.top + headH) box.scrollTop -= (view.top + headH - cell.top);
        else if (cell.bottom > view.bottom) box.scrollTop += (cell.bottom - view.bottom);

        if (cell.left < view.left) box.scrollLeft -= (view.left - cell.left);
        else if (cell.right > view.right) box.scrollLeft += (cell.right - view.right);
    }

    function clearSelection() {
        const root = App.elements.wrapper;
        if (root) {
            root.querySelectorAll('.' + HL_CLASSES.join(', .')).forEach(el => {
                el.classList.remove.apply(el.classList, HL_CLASSES);
            });
        }
        moveCursor(null);
        selected = null;
    }

    function selectCell(row, col) {
        const rows = dataRows();
        const td = cellAt(rows[row], col);
        if (!td) return;

        clearSelection();
        selected = { row: row, col: col };

        // 왼쪽 — 같은 줄에서 고른 칸까지
        for (let c = 0; c < col; c += 1) {
            const cell = cellAt(rows[row], c);
            if (cell && cell !== td) cell.classList.add('f1inv-hl-row');
        }

        // 위쪽 — 같은 열에서 머리글까지 (앞 카드들도 지나갑니다)
        for (let r = 0; r < row; r += 1) {
            const cell = cellAt(rows[r], col);
            if (cell && cell !== td) cell.classList.add('f1inv-hl-col');
        }

        // 머리글 — 1·2레벨 중 그 열을 덮는 칸
        if (App.elements.head) {
            App.elements.head.querySelectorAll(`th[data-cols~="${col}"]`)
                .forEach(th => th.classList.add('f1inv-hl-head'));
        }

        td.classList.add('f1inv-hl-cell');
        moveCursor(td);
    }

    function moveSelection(dRow, dCol) {
        const rows = dataRows();
        if (!selected || !rows.length) return;

        let row = selected.row;
        let col = selected.col;

        if (dCol) col = Math.min(Math.max(col + dCol, 0), lastCol());

        if (dRow) {
            if (col === COL_LOC) {
                /* 저장위치 칸은 카드 하나를 통째로 덮고 있어, 한 줄씩 가면 같은
                   칸에 머물러 멈춘 것처럼 보입니다. 카드 단위로 건너뛰고, 옮긴
                   카드의 첫 줄에 섭니다 — 거기서 오른쪽으로 나가면 그 저장위치의
                   첫 품목입니다. */
                const tables = [];
                rows.forEach(r => {
                    const t = r.closest('table');
                    if (tables[tables.length - 1] !== t) tables.push(t);
                });
                const at = tables.indexOf(rows[row].closest('table'));
                const next = Math.min(Math.max(at + dRow, 0), tables.length - 1);
                row = rows.indexOf(tables[next].tBodies[0].rows[0]);
            } else {
                row = Math.min(Math.max(row + dRow, 0), rows.length - 1);
            }
        }

        selectCell(row, col);
        const td = cellAt(dataRows()[row], col);
        revealCell(td);
    }

    const ARROWS = {
        ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1]
    };

    function bindCellSelect() {
        const host = App.elements.blocks;
        if (!host) return;

        // 표를 다시 그려도 host 자체는 그대로라 위임으로 한 번만 붙입니다
        host.addEventListener('click', function (e) {
            const td = e.target.closest('td[data-col]');
            if (!td || !host.contains(td)) return;

            // 같은 칸을 다시 누르면 풉니다
            if (td.classList.contains('f1inv-hl-cell')) { clearSelection(); return; }

            const rows = dataRows();
            selectCell(rows.indexOf(td.parentElement), Number(td.dataset.col));
        });

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') { clearSelection(); return; }
            if (!selected) return;

            // 메모 입력칸에 커서가 있으면 방향키는 글자 사이를 옮기는 키입니다
            const t = e.target;
            if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;

            const d = ARROWS[e.key];
            if (!d) return;
            e.preventDefault();      // 방향키로 화면이 같이 스크롤되지 않도록
            moveSelection(d[0], d[1]);
        });
    }

    /* ── 재고 확인 상태 ─────────────────────────────────────────────────────
       고른 값만 색이 찹니다. 수정 모드가 아니면 눌러도 바뀌지 않고, 클릭
       처리는 위임(delegation)이라 다시 그려도 다시 붙일 필요가 없습니다.

       버튼 왼쪽 자리는 상태에 따라 셋 중 하나입니다.
         확인          → 고정 문구('재고실사 확인됨'). 메모를 받지 않습니다.
         보류 · 미확인 → 수정 모드면 메모 입력칸, 읽기 모드면 적어 둔 메모.
       왜 그런지가 곧 정보인 쪽에만 메모를 두었습니다. */
    function statusOption(key) {
        return App.STATUS_OPTIONS.find(o => o.key === key) || {};
    }

    function renderStatus() {
        const el = App.elements.status;
        if (!el) return;

        const cur = App.state.status || App.STATUS_DEFAULT;
        const opt = statusOption(cur);
        const memo = App.state.memo || '';

        let slot = '';
        if (opt.message) {
            slot = `<span class="f1inv-status-msg is-done">${escapeHtml(opt.message)}</span>`;
        } else if (opt.memo && App.state.isEditMode) {
            slot = '<input type="text" class="f1inv-status-memo" maxlength="200"' +
                   ` placeholder="메모 (선택)" value="${escapeHtml(memo)}">`;
        } else if (opt.memo && memo) {
            slot = `<span class="f1inv-status-msg" title="${escapeHtml(memo)}">${escapeHtml(memo)}</span>`;
        }

        el.className = 'f1inv-status' + (App.state.isEditMode ? ' is-editable' : '');
        el.innerHTML =
            slot +
            '<div class="f1inv-status-group">' +
            App.STATUS_OPTIONS.map(o =>
                `<button type="button" class="f1inv-status-btn${o.key === cur ? ' active' : ''}"` +
                ` data-status="${o.key}">${o.label}</button>`
            ).join('') +
            '</div>';
    }

    function bindStatus() {
        const el = App.elements.status;
        if (!el) return;

        el.addEventListener('click', function (e) {
            if (!App.state.isEditMode) return;
            const btn = e.target.closest('.f1inv-status-btn');
            if (!btn) return;
            const next = btn.dataset.status;
            if (!next || next === App.state.status) return;
            App.state.status = next;
            renderStatus();

            // 메모를 받는 상태로 바꿨으면 바로 적을 수 있게 커서를 넣어 줍니다
            const input = el.querySelector('.f1inv-status-memo');
            if (input) input.focus();
        });

        /* 입력할 때마다 다시 그리면 커서가 튀므로 state 만 갱신합니다.
           (renderStatus 는 상태 전환·모드 전환·날짜 이동에서만 부릅니다) */
        el.addEventListener('input', function (e) {
            if (!e.target.classList.contains('f1inv-status-memo')) return;
            App.state.memo = e.target.value;
        });
    }

    // 수정 모드 전환 — 이 페이지에서 사람이 고치는 값은 확인 상태와 메모뿐입니다.
    function setEditMode(isEdit) {
        App.state.isEditMode = !!isEdit;
        if (!isEdit) {                       // 취소하면 저장된 값으로 되돌립니다
            App.state.status = App.state.savedStatus;
            App.state.memo = App.state.savedMemo;
        }
        renderStatus();
    }

    // 카드 제목 옆 기준일 안내 문구 갱신
    function renderSubtitle(dateStr) {
        const el = App.elements.subtitle;
        if (!el) return;
        const utils = window.Factory3Utils || window.CommonUtils;
        el.textContent = dateStr ? `기준일 ${utils.formatKoDate(dateStr)}` : '';
    }

    /* 날짜가 바뀌면 호출됩니다.
       늦게 도착한 이전 날짜의 응답이 현재 화면을 덮어쓰지 않도록 기준일을
       다시 확인하고 그립니다. (날짜 버튼을 빠르게 연타할 때) */
    async function loadData(dateStr) {
        App.state.currentDate = dateStr;
        renderSubtitle(dateStr);
        renderLoading();

        App.state.isLoading = true;
        let values = {};
        let check = { status: App.STATUS_DEFAULT, memo: '' };
        try {
            const got = await Promise.all([App.fetchAll(dateStr), App.fetchStatus(dateStr)]);
            values = got[0];
            check = got[1];
        } catch (e) {
            console.error('[factory1_inventory_io] 조회 실패:', e);
        }
        App.state.isLoading = false;

        if (App.state.currentDate !== dateStr) return;

        App.state.values = values;
        App.state.savedStatus = check.status;
        App.state.savedMemo = check.memo;
        App.state.status = check.status;
        App.state.memo = check.memo;
        renderTable();
        renderStatus();
    }

    // 저장 — 이 페이지에서 사람이 고치는 값은 확인 상태 하나뿐입니다.
    async function saveData() {
        const dateStr = (App.headerApi && App.headerApi.getCurrentDate()) || App.state.currentDate;
        if (!dateStr) {
            alert('저장할 날짜를 확인할 수 없습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.');
            return;
        }

        try {
            await App.saveStatus(dateStr, App.state.status, App.state.memo);
        } catch (e) {
            console.error('[factory1_inventory_io] 확인 상태 저장 실패:', e);
            alert('저장에 실패했습니다.\n' + e.message);
            return;
        }

        // '확인'은 메모를 저장하지 않으므로 화면 상태도 같이 비웁니다
        const opt = statusOption(App.state.status);
        if (!opt.memo) App.state.memo = '';

        App.state.savedStatus = App.state.status;
        App.state.savedMemo = App.state.memo;
        if (App.headerApi && App.headerApi.toggleEditMode) App.headerApi.toggleEditMode();
    }

    App.renderTable = renderTable;
    App.renderLoading = renderLoading;
    App.renderSubtitle = renderSubtitle;
    App.renderStatus = renderStatus;
    App.bindStatus = bindStatus;
    App.bindCellSelect = bindCellSelect;
    App.clearSelection = clearSelection;
    App.setEditMode = setEditMode;
    App.loadData = loadData;
    App.saveData = saveData;

})();
