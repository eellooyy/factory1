/* factory1_jeonja_render.js — 1공장 전자신문 (용지재고대장) 렌더링
   ────────────────────────────────────────────────────────────────
   나라사랑 페이지(factory1_narasarang_render.js)처럼 표가 넷으로 갈라져
   있습니다. 네 패널은 열 구성이 다르지만 줄은 같은 날짜로 1:1 대응하므로,
   한 번에 네 tbody 를 같은 순서로 그립니다. 한 곳이라도 줄 수가 어긋나면
   전체가 밀리므로 행 생성은 rowsFor() 한 군데에서만 합니다.

   하는 일은 넷입니다.
     1. 고른 날이 속한 '달'을 통째로 그린다 (전월재고 → 1일~말일 → 소계)
     2. 네 패널의 세로 스크롤을 묶는다
     3. 마우스를 올린 줄을 네 패널에 동시에 표시한다
     4. 본문 좌우의 월 이동 버튼을 관리한다

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
    const PANELS = [1, 2, 3, 4];

    /* ── 날짜 유틸 ─────────────────────────────────────────────── */
    function pad(n) { return String(n).padStart(2, '0'); }

    function monthOf(dateStr) { return dateStr ? dateStr.slice(0, 7) : null; }
    function dayOf(dateStr) { return dateStr ? Number(dateStr.slice(8, 10)) : null; }

    function daysInMonth(monthStr) {
        return new Date(Number(monthStr.slice(0, 4)), Number(monthStr.slice(5, 7)), 0).getDate();
    }

    function weekdayOf(monthStr, d) {
        const dt = new Date(Number(monthStr.slice(0, 4)), Number(monthStr.slice(5, 7)) - 1, d);
        return App.WD_KR[dt.getDay()];
    }

    /* ── 숫자 표기 ─────────────────────────────────────────────
       0 과 null 을 똑같이 '-' 로 그립니다. 원장이 그렇게 적기 때문입니다.
       입출고에서 0 은 '0kg 이 움직였다'가 아니라 '움직임이 없었다'는 뜻이고,
       그 자리에 0 을 찍으면 실제로 0kg 을 받은 날처럼 읽힙니다.
       (재고 열만 예외입니다 — 거기서 0 은 진짜 0 입니다) */
    const DASH = '<span class="f1jn-empty">–</span>';

    function fmt(v) {
        if (v === null || v === undefined || v === 0 || v === '') return DASH;
        return Number(v).toLocaleString('ko-KR');
    }

    function fmtStock(v) {
        if (v === null || v === undefined || v === '') return DASH;
        return Number(v).toLocaleString('ko-KR');
    }

    /* 칸 하나. 큰 줄(값) + 작은 줄(부기)로 된 두 줄짜리 상자입니다.
       부기가 없어도 빈 줄을 그대로 둡니다 — 지우면 그 칸만 반 줄 내려앉아
       네 패널의 숫자가 같은 높이에 오지 않습니다. */
    function cell(main, sub, cls) {
        return `<td class="${cls || ''}">`
             + `<span class="f1jn-v">${main}</span>`
             + `<span class="f1jn-sub-v">${sub || ''}</span></td>`;
    }

    // 입고 칸 — kg 아래에 롤 수를 붙입니다 (원장의 R/L 열을 대신합니다)
    function inCell(kg, rl, cls) {
        return cell(fmt(kg), rl ? `${rl} R/L` : '', cls);
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

    /* ── 행 그리기 ─────────────────────────────────────────────
       한 줄을 네 패널의 <tr> 네 개로 만들어 돌려줍니다. 줄 클래스와
       data-day 는 네 개가 똑같아야 스크롤·호버가 맞물립니다. */
    function rowSet(opts) {
        const v = opts.v || {};
        const open = `<tr class="${opts.cls || ''}"${opts.day ? ` data-day="${opts.day}"` : ''}>`;

        return {
            1: open
                + cell(opts.label, '', `f1jn-date-td ${opts.dateCls || ''}`)
                + cell(opts.myeon || DASH, opts.myeonSub || '', 'f1jn-myeon-td f1jn-sep')
                + '</tr>',
            2: open
                + inCell(v.inAKg, v.inARl)
                + inCell(v.inDKg, v.inDRl, 'f1jn-sep')
                + cell(fmt(v.inSum), '', 'f1jn-sum-td f1jn-sep')
                + '</tr>',
            3: open
                + cell(fmt(v.outA), '')
                + cell(fmt(v.outD), '', 'f1jn-sep')
                + cell(fmt(v.outSum), '', 'f1jn-sum-td f1jn-sep')
                + '</tr>',
            4: open + cell(fmtStock(v.stock), '', 'f1jn-stock-td') + '</tr>'
        };
    }

    function dayRowSet(monthStr, r, selDay, todayDay) {
        const wd = weekdayOf(monthStr, r.d);

        const cls = [];
        if (r.kind === App.ROW_OFF) cls.push('f1jn-row-off');
        else if (r.kind === App.ROW_PENDING) cls.push('f1jn-row-pending');
        // 오늘(푸른색)과 선택 행(회색)은 다른 줄입니다 — 헤더 기본값이 '어제'입니다.
        if (r.d === todayDay) cls.push('f1jn-row-today');
        if (r.d === selDay) cls.push('f1jn-row-selected');

        let dateCls = '';
        if (wd === '토') dateCls = 'f1jn-sat';
        else if (wd === '일') dateCls = 'f1jn-sun';

        return rowSet({
            cls: cls.join(' '),
            day: r.d,
            dateCls: dateCls,
            label: `${Number(monthStr.slice(5, 7))}/${r.d}(${wd})`,
            myeon: r.myeon ? String(r.myeon) : DASH,
            // 본지(28면)보다 많은 날. 색 대신 면수 아래 작은 글씨로 적습니다.
            myeonSub: (r.myeon && r.myeon > 28) ? '증면' : '',
            v: r
        });
    }

    /* ── 전체 렌더 ─────────────────────────────────────────────── */
    function render(dateStr) {
        const el = App.elements;
        if (!el.body[1]) return;

        const monthStr = monthOf(dateStr);
        const selDay = dayOf(dateStr);
        const data = monthData(monthStr);

        // 오늘 줄은 보고 있는 달이 이번 달일 때만 있습니다
        const today = window.Factory3Utils.getTodayStr();
        const todayDay = (monthOf(today) === monthStr) ? dayOf(today) : null;

        state.currentDate = dateStr;
        state.currentMonth = monthStr;

        if (el.monthTitle) {
            el.monthTitle.textContent = `${monthStr.slice(0, 4)}년 ${monthStr.slice(5, 7)}월`;
        }

        const buf = { 1: [], 2: [], 3: [], 4: [] };
        const push = set => PANELS.forEach(p => buf[p].push(set[p]));

        push(rowSet({ cls: 'f1jn-row-carry', label: '전월재고', v: { stock: data.carryStock } }));
        data.rows.forEach(r => push(dayRowSet(monthStr, r, selDay, todayDay)));

        const foot = rowSet({ label: '소계', v: data.total || {} });

        PANELS.forEach(p => {
            el.body[p].innerHTML = buf[p].join('');
            el.foot[p].innerHTML = foot[p];
        });

        updateMonthNav();
        scrollToBase();
    }

    /* 선택한 줄을 화면 가운데로 끌어옵니다. 달의 마지막 주를 보고 있는데
       표가 1일부터 시작해 있으면 매번 손으로 내려야 합니다.
       스크롤이 잠겨 있어도 scrollTop 은 이렇게 직접 넣을 수 있습니다 —
       잠금은 사람이 굴리는 것만 막습니다. */
    function scrollToBase() {
        const el = App.elements;
        const area = el.scroll[1];
        if (!area) return;

        const row = el.body[1].querySelector('.f1jn-row-selected');
        const top = row
            ? Math.max(0, row.offsetTop - (area.clientHeight / 2) + (row.offsetHeight / 2))
            : 0;

        PANELS.forEach(p => { el.scroll[p].scrollTop = top; });
    }

    /* ── 네 패널 묶기 ──────────────────────────────────────────
       세로 스크롤과 호버를 함께 묶습니다. 표가 넷으로 갈라져 있어 이게
       없으면 오른쪽 패널에서 왼쪽 날짜를 되짚어 갈 방법이 없습니다. */
    function bindPanels() {
        const el = App.elements;
        let syncing = false;

        PANELS.forEach(p => {
            const area = el.scroll[p];
            if (!area) return;

            area.addEventListener('scroll', function () {
                if (syncing) return;
                syncing = true;
                PANELS.forEach(q => {
                    if (q !== p && el.scroll[q]) el.scroll[q].scrollTop = area.scrollTop;
                });
                window.requestAnimationFrame(function () { syncing = false; });
            });

            // 줄 강조는 위임으로 답니다 — 행이 매달 다시 그려지기 때문입니다
            area.addEventListener('mouseover', function (e) {
                const tr = e.target.closest('tr[data-day]');
                setHoverDay(tr ? tr.dataset.day : null);
            });
            area.addEventListener('mouseleave', function () { setHoverDay(null); });
        });

        bindScrollToggle();
    }

    /* 스크롤 ON/OFF — 네 패널에 동시에 걸립니다. 패널은 붙어 다니므로 애초에
       따로 잠글 수가 없습니다. 기본값은 잠김입니다(지고 재고 · 나라사랑과 같음).
       한 달치가 33줄이라 열자마자 굴러가면 선택한 줄에서 벗어나기 쉽습니다. */
    function bindScrollToggle() {
        const el = App.elements;
        const toggle = document.getElementById('f1jnScrollToggle');
        if (!toggle) return;

        const apply = () => PANELS.forEach(p => {
            if (el.scroll[p]) el.scroll[p].classList.toggle('locked', !toggle.checked);
        });

        toggle.checked = false;
        apply();
        toggle.addEventListener('change', apply);
    }

    function setHoverDay(day) {
        const el = App.elements;
        if (state.hoverDay === day) return;
        state.hoverDay = day;

        PANELS.forEach(p => {
            if (!el.body[p]) return;
            el.body[p].querySelectorAll('tr.f1jn-row-hover')
                .forEach(tr => tr.classList.remove('f1jn-row-hover'));
            if (day) {
                const tr = el.body[p].querySelector(`tr[data-day="${day}"]`);
                if (tr) tr.classList.add('f1jn-row-hover');
            }
        });
    }

    /* ── 월 이동 버튼 ──────────────────────────────────────────
       본문 좌우 여백에 세로로 긴 띠를 세웁니다. 모양은 서브메뉴 이동
       버튼(common_subnav)과 같고, 하는 일만 다릅니다 — 페이지 이동이
       아니라 이 표의 달을 바꿉니다.

       상단 날짜 네비게이션과 따로 놀면 안 되므로, 버튼은 직접 그리지 않고
       공통 헤더의 setCurrentDate() 를 부릅니다. 그러면 날짜 표시 · 다음날
       버튼 잠금 · 표가 한 번에 같이 움직입니다. */

    function shiftMonth(delta) {
        if (!App.headerApi || !state.currentMonth) return;

        const t = new Date(Number(state.currentMonth.slice(0, 4)),
                           Number(state.currentMonth.slice(5, 7)) - 1 + delta, 1);
        const tm = `${t.getFullYear()}-${pad(t.getMonth() + 1)}`;

        /* 옮겨 갈 날짜 — 보던 날짜(일)를 그대로 유지합니다. 그 달에 없는
           날이면 말일로, 오늘을 넘어가면 오늘로 당깁니다. 공통 헤더가
           '오늘 이후'를 막고 있어 넘겨 주면 다음날 버튼 상태가 어긋납니다. */
        const day = Math.min(dayOf(state.currentDate) || 1, daysInMonth(tm));
        let target = `${tm}-${pad(day)}`;
        const today = window.Factory3Utils.getTodayStr();
        if (target > today) target = today;

        App.headerApi.setCurrentDate(target);
    }

    function makeMonthBtn(side) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = `gf3-subnav gf3-subnav-${side} f1jn-monthnav`;

        const icon = document.createElement('span');
        icon.className = 'material-symbols-outlined';
        icon.textContent = (side === 'right') ? 'chevron_right' : 'chevron_left';

        const label = document.createElement('span');
        label.className = 'f1jn-monthnav-label';

        b.appendChild(icon);
        b.appendChild(label);
        b.addEventListener('click', () => shiftMonth(side === 'right' ? 1 : -1));
        return b;
    }

    // 버튼에 대상 달을 적고, 오늘이 든 달보다 뒤로는 못 가게 잠급니다
    function updateMonthNav() {
        const el = App.elements;
        if (!el.prevMonthBtn || !state.currentMonth) return;

        const y = Number(state.currentMonth.slice(0, 4));
        const m = Number(state.currentMonth.slice(5, 7));
        const label = d => `${new Date(y, m - 1 + d, 1).getMonth() + 1}월`;

        el.prevMonthBtn.querySelector('.f1jn-monthnav-label').textContent = label(-1);
        el.nextMonthBtn.querySelector('.f1jn-monthnav-label').textContent = label(1);

        const thisMonth = window.Factory3Utils.getTodayStr().slice(0, 7);
        el.nextMonthBtn.classList.toggle('is-disabled', state.currentMonth >= thisMonth);
    }

    /* 버튼을 표 카드의 상하폭에 맞춰 세우고, 자리가 없으면 뺍니다.
       common_subnav.js 와 같은 방식입니다 — body 에 zoom 이 걸려 있어
       '몇 px 이상이면 보인다'를 미리 계산해 두면 틀립니다. 실제로 놓아
       보고 화면 밖으로 나가면 그때 뺍니다. */
    const EDGE_SLACK = 4;

    function layoutMonthNav() {
        const el = App.elements;
        if (!el.wrapper || !el.prevMonthBtn) return;

        const cs = window.getComputedStyle(el.wrapper);
        const top = parseFloat(cs.paddingTop) || 0;
        const bottom = parseFloat(cs.paddingBottom) || 0;
        const viewW = document.documentElement.clientWidth;

        [el.prevMonthBtn, el.nextMonthBtn].forEach(btn => {
            btn.style.top = `${top}px`;
            btn.style.bottom = `${bottom}px`;

            btn.style.visibility = 'hidden';
            btn.style.display = 'flex';

            const r = btn.getBoundingClientRect();
            const fits = (r.left >= EDGE_SLACK) && (r.right <= viewW - EDGE_SLACK);

            btn.style.display = fits ? 'flex' : 'none';
            btn.style.visibility = '';
        });
    }

    /* ── 초기화 ────────────────────────────────────────────────── */
    function initUI() {
        const el = App.elements;
        el.body = {}; el.foot = {}; el.scroll = {};
        PANELS.forEach(p => {
            el.body[p] = document.getElementById(`f1jnBody${p}`);
            el.foot[p] = document.getElementById(`f1jnFoot${p}`);
            el.scroll[p] = document.getElementById(`f1jnScroll${p}`);
        });
        el.monthTitle = document.getElementById('f1jnMonthTitle');

        bindPanels();

        if (el.wrapper) {
            el.wrapper.classList.add('gf3-subnav-host');
            el.prevMonthBtn = makeMonthBtn('left');
            el.nextMonthBtn = makeMonthBtn('right');
            el.wrapper.appendChild(el.prevMonthBtn);
            el.wrapper.appendChild(el.nextMonthBtn);

            /* load 에서 한 번 더 재는 이유는 웹폰트(Material Symbols)가 늦게
               붙으면서 버튼 폭이 확정되기 때문입니다. 표의 행이 늘어나는 것은
               다시 잴 필요가 없습니다 — top/bottom 으로 고정해 두어 카드
               높이를 저절로 따라갑니다. */
            window.addEventListener('load', layoutMonthNav);
            window.addEventListener('resize', layoutMonthNav);
            layoutMonthNav();
        }
    }

    App.initUI = initUI;
    App.render = render;

    /* main.js 가 날짜 변경 때마다 부르는 이름입니다. 뷰가 붙으면 여기가
       비동기 조회로 바뀌고 render() 는 그대로 남습니다. */
    App.loadData = function (dateStr) {
        render(dateStr);
    };

})();
