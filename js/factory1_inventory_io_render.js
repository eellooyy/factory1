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

    // 실재고 − ERP재고 차이 셀 (양수 초록 / 음수 빨강 / 0 회색)
    function diffCell(diff) {
        if (diff === null || diff === undefined || isNaN(diff)) {
            return `<td class="f1inv-num f1inv-sep f1inv-empty">${EMPTY}</td>`;
        }

        let cls = 'f1inv-diff-zero';
        if (diff > 0) cls = 'f1inv-diff-positive';
        else if (diff < 0) cls = 'f1inv-diff-negative';

        return `<td class="f1inv-num f1inv-sep ${cls}">${Number(diff).toLocaleString('ko-KR')}</td>`;
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

    function renderTable() {
        const body = App.elements.body;
        if (!body) return;

        let html = '';

        App.LOCATIONS.forEach(loc => {
            const items = visibleItems(loc);

            items.forEach((item, idx) => {
                const v = getValues(loc.locCode, item);
                const sum = sumOrNull(v);
                const erp = (v.erp === null || v.erp === undefined || v.erp === '' || isNaN(v.erp)) ? null : Number(v.erp);
                const diff = (sum === null || erp === null) ? null : sum - erp;

                html += `<tr class="${idx === 0 ? 'f1inv-group-start' : ''}">`;

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

                html += numCell(erp, 'f1inv-sep');
                html += numCell(v.inQty);
                html += numCell(v.useQty);

                /* 고정값 칸은 점선 밑줄 + 툴팁으로 표시합니다. DB에서 온 숫자와
                   파일에 박아 둔 숫자가 같아 보이면 왜 안 변하는지 알 수 없습니다. */
                const fixed = item.fixed || {};
                App.REAL_COLUMNS.forEach((col, i) => {
                    const cls = [];
                    if (i === 0) cls.push('f1inv-sep');
                    if (Object.prototype.hasOwnProperty.call(fixed, col.key)) cls.push('f1inv-fixed');
                    html += numCell(v[col.key], cls.join(' '), item.fixedNote);
                });

                html += numCell(sum, 'f1inv-sum');
                html += diffCell(diff);

                html += '</tr>';
            });
        });

        if (!html) {
            html = `<tr class="f1inv-placeholder"><td colspan="11">표시할 품목이 없습니다.</td></tr>`;
        }

        body.innerHTML = html;
    }

    function renderLoading() {
        const body = App.elements.body;
        if (!body) return;
        body.innerHTML = `<tr class="f1inv-placeholder"><td colspan="11">불러오는 중...</td></tr>`;
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
        try {
            values = await App.fetchAll(dateStr);
        } catch (e) {
            console.error('[factory1_inventory_io] 조회 실패:', e);
        }
        App.state.isLoading = false;

        if (App.state.currentDate !== dateStr) return;

        App.state.values = values;
        renderTable();
    }

    App.renderTable = renderTable;
    App.renderLoading = renderLoading;
    App.renderSubtitle = renderSubtitle;
    App.loadData = loadData;

})();
