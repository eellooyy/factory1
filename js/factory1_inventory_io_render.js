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

    // 숫자 포맷 (천 단위 콤마). 값이 없으면 회색 '–'
    function numCell(value, extraClass, title) {
        const cls = ['f1inv-num'];
        if (extraClass) cls.push(extraClass);
        const attr = title ? ` title="${title}"` : '';

        if (value === null || value === undefined || value === '' || isNaN(value)) {
            cls.push('f1inv-empty');
            return `<td class="${cls.join(' ')}"${attr}>${EMPTY}</td>`;
        }
        return `<td class="${cls.join(' ')}"${attr}>${Number(value).toLocaleString('ko-KR')}</td>`;
    }

    /* 실재고 − ERP재고 차이 셀
       남는 쪽(+, 초록) / 모자란 쪽(−, 빨강)을 부호로도 드러냅니다. 색만으로는
       인쇄물이나 흑백 PDF 에서 방향이 사라집니다. 0 은 부호 없이 회색. */
    function diffCell(diff) {
        if (diff === null || diff === undefined || isNaN(diff)) {
            return `<td class="f1inv-num f1inv-sep f1inv-empty">${EMPTY}</td>`;
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

        return `<td class="f1inv-num f1inv-sep ${cls}">${text}</td>`;
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

    /* 표 머리글은 첫 카드에만 붙습니다. 아래 카드들도 같은 colgroup 을 쓰고
       table-layout: fixed 라 열이 그대로 이어집니다 — colgroup 을 한쪽만 고치면
       카드끼리 열이 어긋나므로 반드시 이 한 곳에서만 관리합니다. */
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

    const THEAD = `
        <thead>
            <tr class="f1inv-thead-lv1">
                <th>저장위치</th>
                <th colspan="2" class="f1inv-sep">품목</th>
                <th rowspan="2" class="f1inv-sep">ERP 재고</th>
                <th rowspan="2">입고</th>
                <th rowspan="2">사용량</th>
                <th colspan="4" class="f1inv-sep">실재고</th>
                <th rowspan="2" class="f1inv-sep">실재고<br>- ERP재고</th>
            </tr>
            <tr class="f1inv-thead-lv2">
                <th>저장위치명</th>
                <th class="f1inv-sep">품목코드</th>
                <th>품목명</th>
                <th class="f1inv-sep">B5</th>
                <th>B6</th>
                <th>B6(주행지)</th>
                <th>합계</th>
            </tr>
        </thead>`;

    function renderTable() {
        const host = App.elements.blocks;
        if (!host) return;

        let html = '';
        let cardIndex = 0;

        App.LOCATIONS.forEach(loc => {
            const items = visibleItems(loc);
            if (!items.length) return;

            html += '<div class="inner-layout-card">';
            html += '<table class="f1inv-table">' + COLGROUP;
            if (cardIndex === 0) html += THEAD;
            html += '<tbody>';
            cardIndex += 1;

            items.forEach((item, idx) => {
                const v = getValues(loc.locCode, item);
                const sum = sumOrNull(v);
                const erp = (v.erp === null || v.erp === undefined || v.erp === '' || isNaN(v.erp)) ? null : Number(v.erp);
                const diff = (sum === null || erp === null) ? null : sum - erp;

                html += '<tr>';

                // 저장위치 셀 — 그룹의 첫 행에서 품목 수만큼 세로 병합
                if (idx === 0) {
                    html += `
                        <td class="f1inv-loc-td" rowspan="${items.length}">
                            <span class="f1inv-loc-name">${loc.locName}</span>
                            <span class="f1inv-loc-code">${loc.locCode}</span>
                        </td>`;
                }

                html += `<td class="f1inv-item-code">${item.code}</td>`;
                html += `<td class="f1inv-item-name" title="${item.name}">${item.name}</td>`;

                /* 고정값 칸은 점선 밑줄 + 툴팁으로 표시합니다. DB에서 온 숫자와
                   파일에 박아 둔 숫자가 같아 보이면 왜 안 변하는지 알 수 없습니다.
                   합계·차이는 계산값이라 표시하지 않습니다. */
                const fixed = item.fixed || {};
                const fixedCls = key => (
                    Object.prototype.hasOwnProperty.call(fixed, key) ? ' f1inv-fixed' : ''
                );

                html += numCell(erp, 'f1inv-sep' + fixedCls('erp'), item.fixedNote);
                html += numCell(v.inQty, fixedCls('inQty').trim(), item.fixedNote);
                html += numCell(v.useQty, fixedCls('useQty').trim(), item.fixedNote);

                App.REAL_COLUMNS.forEach((col, i) => {
                    const cls = [];
                    if (i === 0) cls.push('f1inv-sep');
                    if (fixedCls(col.key)) cls.push('f1inv-fixed');
                    html += numCell(v[col.key], cls.join(' '), item.fixedNote);
                });

                html += numCell(sum, 'f1inv-sum');
                html += diffCell(diff);

                html += '</tr>';
            });

            html += '</tbody></table></div>';
        });

        if (!html) {
            html = '<div class="f1inv-placeholder-box">표시할 품목이 없습니다.</div>';
        }

        host.innerHTML = html;
    }

    function renderLoading() {
        const host = App.elements.blocks;
        if (!host) return;
        host.innerHTML = '<div class="f1inv-placeholder-box">불러오는 중...</div>';
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
            '<span class="f1inv-status-title">재고 확인</span>' +
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
    App.setEditMode = setEditMode;
    App.loadData = loadData;
    App.saveData = saveData;

})();
