/* factory1_jeonja_render.js — 1공장 전자신문 (용지재고대장) 렌더링
   ────────────────────────────────────────────────────────────────
   지고 재고 페이지(factory1_jigo_render.js)의 표 구성을 따르되, 훨씬
   얇습니다. 조회 전용이라 셀 편집 · 변경분 추적 · 단위 스위처가 없고,
   층이 하나뿐이라 스크롤 동기화도 없습니다.

   이 파일이 하는 일은 셋뿐입니다.
     1. 고른 날이 속한 '달'을 통째로 그린다 (전월재고 → 1일 ~ 말일 → 소계)
     2. 그 날 줄을 잡아 화면 가운데로 끌어온다
     3. 값이 없는 칸을 '-' 로 깐다

   달을 통째로 그리는 이유는 원장이 월 마감 단위이기 때문입니다. 재고는
   전월재고에서 하루씩 이어지는 값이라, 하루만 떼어 보면 그 숫자가 맞는지
   틀린지 판단할 근거가 화면에 없습니다.

   ※ 데이터 출처는 지금 constant.js 의 SAMPLE 입니다. 뷰가 붙으면
     monthData() 한 함수만 api 호출로 바꾸면 되고 아래는 그대로입니다.
   ──────────────────────────────────────────────────────────────── */
(function () {
    'use strict';

    const App = window.Factory1Jeonja;
    if (!App) return;

    const state = App.state;

    /* ── 날짜 유틸 ─────────────────────────────────────────────── */
    function pad(n) { return String(n).padStart(2, '0'); }

    function monthOf(dateStr) {
        return dateStr ? dateStr.slice(0, 7) : null;
    }

    function dayOf(dateStr) {
        return dateStr ? Number(dateStr.slice(8, 10)) : null;
    }

    function daysInMonth(monthStr) {
        const y = Number(monthStr.slice(0, 4));
        const m = Number(monthStr.slice(5, 7));
        return new Date(y, m, 0).getDate();
    }

    function weekdayOf(monthStr, d) {
        const y = Number(monthStr.slice(0, 4));
        const m = Number(monthStr.slice(5, 7));
        return App.WD_KR[new Date(y, m - 1, d).getDay()];
    }

    /* ── 숫자 표기 ─────────────────────────────────────────────
       0 과 null 을 똑같이 '-' 로 그립니다. 원장이 그렇게 적기 때문입니다.
       입출고에서 0 은 '0kg 이 움직였다'가 아니라 '움직임이 없었다'는 뜻이고,
       그 자리에 0 을 찍으면 실제로 0kg 을 받은 날처럼 읽힙니다.
       (재고 열만 예외입니다 — 거기서 0 은 진짜 0 입니다) */
    function fmt(v) {
        if (v === null || v === undefined || v === 0 || v === '') {
            return '<span class="f1jn-empty">–</span>';
        }
        return Number(v).toLocaleString('ko-KR');
    }

    function fmtStock(v) {
        if (v === null || v === undefined || v === '') {
            return '<span class="f1jn-empty">–</span>';
        }
        return Number(v).toLocaleString('ko-KR');
    }

    /* ── 데이터 ────────────────────────────────────────────────
       지금은 표본에서 꺼내 옵니다. 없는 달이면 빈 달을 만들어 돌려주고,
       화면에는 날짜와 '-' 만 깔립니다. 표가 통째로 사라지는 것보다
       "이 달은 자료가 없다"가 보이는 편이 낫습니다. */
    function monthData(monthStr) {
        const sample = App.SAMPLE[monthStr];
        if (sample) return sample;

        const rows = [];
        for (let d = 1; d <= daysInMonth(monthStr); d++) {
            rows.push({ d: d, myeon: null, inARl: null, inAKg: null, inDRl: null, inDKg: null,
                        inSum: null, outA: null, outD: null, outSum: null, stock: null,
                        kind: App.ROW_PENDING });
        }
        return { carryStock: null, rows: rows, total: null };
    }

    /* ── 행 그리기 ─────────────────────────────────────────────── */

    // 전월재고 — 입출고 칸은 비우고 재고만 적습니다
    function carryRowHtml(carryStock) {
        return `
            <tr class="f1jn-row-carry">
                <td class="f1jn-date-td">전월재고</td>
                <td class="f1jn-myeon-td">${fmt(null)}</td>
                <td>${fmt(null)}</td>
                <td>${fmt(null)}</td>
                <td>${fmt(null)}</td>
                <td>${fmt(null)}</td>
                <td class="f1jn-sum-td">${fmt(null)}</td>
                <td>${fmt(null)}</td>
                <td>${fmt(null)}</td>
                <td class="f1jn-sum-td">${fmt(null)}</td>
                <td class="f1jn-stock-td">${fmtStock(carryStock)}</td>
            </tr>`;
    }

    function dayRowHtml(monthStr, r, baseDay) {
        const wd = weekdayOf(monthStr, r.d);

        const rowCls = [];
        if (r.kind === App.ROW_OFF) rowCls.push('f1jn-row-off');
        else if (r.kind === App.ROW_PENDING) rowCls.push('f1jn-row-pending');
        if (r.d === baseDay) rowCls.push('f1jn-row-base');

        let dateCls = '';
        if (wd === '토') dateCls = 'f1jn-sat';
        else if (wd === '일') dateCls = 'f1jn-sun';

        // 증면일 — 본지(28면)보다 많은 날. 점 하나로만 구분합니다
        const myeonCls = (r.myeon && r.myeon > 28) ? 'f1jn-myeon-plus' : '';
        const myeonHtml = r.myeon ? `<span class="${myeonCls}">${r.myeon}</span>` : fmt(null);

        const month = Number(monthStr.slice(5, 7));

        return `
            <tr class="${rowCls.join(' ')}" data-day="${r.d}">
                <td class="f1jn-date-td ${dateCls}">${month}/${r.d}(${wd})</td>
                <td class="f1jn-myeon-td">${myeonHtml}</td>
                <td class="f1jn-sep">${fmt(r.inARl)}</td>
                <td>${fmt(r.inAKg)}</td>
                <td>${fmt(r.inDRl)}</td>
                <td>${fmt(r.inDKg)}</td>
                <td class="f1jn-sum-td">${fmt(r.inSum)}</td>
                <td class="f1jn-sep">${fmt(r.outA)}</td>
                <td>${fmt(r.outD)}</td>
                <td class="f1jn-sum-td">${fmt(r.outSum)}</td>
                <td class="f1jn-stock-td">${fmtStock(r.stock)}</td>
            </tr>`;
    }

    // 소계 — 원장에 있는 행이라 화면에서 다시 더하지 않고 원장값을 씁니다
    function totalRowHtml(total) {
        if (!total) total = {};
        return `
            <tr>
                <td class="f1jn-date-td">소계</td>
                <td class="f1jn-myeon-td">${fmt(null)}</td>
                <td class="f1jn-sep">${fmt(total.inARl)}</td>
                <td>${fmt(total.inAKg)}</td>
                <td>${fmt(total.inDRl)}</td>
                <td>${fmt(total.inDKg)}</td>
                <td>${fmt(total.inSum)}</td>
                <td class="f1jn-sep">${fmt(total.outA)}</td>
                <td>${fmt(total.outD)}</td>
                <td>${fmt(total.outSum)}</td>
                <td class="f1jn-stock-td">${fmtStock(total.stock)}</td>
            </tr>`;
    }

    /* ── 전체 렌더 ─────────────────────────────────────────────── */
    function render(dateStr) {
        const el = App.elements;
        if (!el.body) return;

        const monthStr = monthOf(dateStr);
        const baseDay = dayOf(dateStr);
        const data = monthData(monthStr);

        state.currentDate = dateStr;
        state.currentMonth = monthStr;

        if (el.monthTitle) {
            el.monthTitle.textContent = `${monthStr.slice(0, 4)}년 ${monthStr.slice(5, 7)}월`;
        }

        const html = [carryRowHtml(data.carryStock)];
        data.rows.forEach(r => html.push(dayRowHtml(monthStr, r, baseDay)));
        el.body.innerHTML = html.join('');

        if (el.foot) el.foot.innerHTML = totalRowHtml(data.total);

        scrollToBase();
    }

    /* 기준일 줄을 화면 가운데로 끌어옵니다. 달의 마지막 주를 보고 있는데
       표가 1일부터 시작해 있으면 매번 손으로 내려야 합니다. */
    function scrollToBase() {
        const el = App.elements;
        if (!el.scroll || !el.body) return;

        const row = el.body.querySelector('.f1jn-row-base');
        if (!row) { el.scroll.scrollTop = 0; return; }

        const target = row.offsetTop - (el.scroll.clientHeight / 2) + (row.offsetHeight / 2);
        el.scroll.scrollTop = Math.max(0, target);
    }

    /* ── 초기화 ────────────────────────────────────────────────── */
    function initUI() {
        const el = App.elements;
        el.body = document.getElementById('f1jnBody');
        el.foot = document.getElementById('f1jnFoot');
        el.scroll = document.getElementById('f1jnScroll');
        el.monthTitle = document.getElementById('f1jnMonthTitle');
    }

    App.initUI = initUI;
    App.render = render;

    /* main.js 가 날짜 변경 때마다 부르는 이름입니다. 뷰가 붙으면 여기가
       비동기 조회로 바뀌고 render() 는 그대로 남습니다. */
    App.loadData = function (dateStr) {
        render(dateStr);
    };

})();
