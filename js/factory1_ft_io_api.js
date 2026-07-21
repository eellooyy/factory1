/* factory1_ft_io_api.js — 1공장 FT 재고 종합 데이터 연동 */
(function () {
    'use strict';

    const App = window.Factory1FtIo;
    if (!App) return;

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

    function weekdayKr(dateStr) {
        const d = new Date(dateStr + 'T00:00:00');
        return App.WD_KR[d.getDay()];
    }

    function hashSeed(str) {
        let h = 0;
        for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
        return h;
    }

    function seededVal(seed, min, max) {
        const x = Math.sin(seed) * 10000;
        const frac = x - Math.floor(x);
        return Math.floor(frac * (max - min + 1)) + min;
    }

    /* 1층 4단 대조표 데이터 */
    App.fetchComparisonData = async function (baseDateStr, direction) {
        const RANGE = 15;
        const dates = [];
        for (let i = -RANGE; i <= RANGE; i++) {
            const dateStr = addDays(baseDateStr, i);
            const seedBase = hashSeed(dateStr);

            const usage = [0, 1, 2].map(k => seededVal(seedBase + k, 50, 400));
            const erp   = [0, 1, 2].map(k => seededVal(seedBase + k + 10, 1000, 5000));
            const real  = [0, 1, 2].map(k => erp[k] + seededVal(seedBase + k + 20, -30, 30));
            const diff  = [0, 1, 2].map(k => real[k] - erp[k]);

            dates.push({ date: dateStr, weekday: weekdayKr(dateStr), usage, erp, real, diff });
        }
        return { status: 'success', dates };
    };

    /* ────────────────────────────────────────────────────────────
       하단 좌측: 입고 현황
       offsetStart : "오늘" 기준 며칠 전부터 데이터를 만들지 (0 = 오늘)
       count       : 몇 건 생성할지
       결과는 과거→최신(오름차순) 순으로 반환되어 화면 아래쪽에 최신이 오도록 렌더링됩니다.
       추후 실제 DB 연동 시에는 이 함수 내부만 실제 쿼리(offset/limit)로 교체하면 됩니다.
       ──────────────────────────────────────────────────────────── */
    App.fetchInboundList = async function (offsetStart, count) {
        const rows = [];
        const startI = offsetStart + count - 1; // 가장 과거 offset부터
        for (let i = startI; i >= offsetStart; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);

            const y = d.getFullYear();
            const m = d.getMonth() + 1;
            const dayNum = d.getDate();
            const dayName = App.WD_KR[d.getDay()];
            const dateDisplay = `${pad(m)}/${pad(dayNum)} (${dayName})`;

            const seedBase = hashSeed(`${y}-${pad(m)}-${pad(dayNum)}-in`);
            const aRl = seededVal(seedBase, 5, 20);
            const cRl = seededVal(seedBase + 1, 3, 18);
            const dRl = seededVal(seedBase + 2, 2, 12);

            rows.push({
                date_display: dateDisplay,
                day_offset: i,
                A_rl: aRl, A_kg: aRl * 25,
                C_rl: cRl, C_kg: cRl * 25,
                D_rl: dRl, D_kg: dRl * 25
            });
        }
        return rows;
    };

    /* ────────────────────────────────────────────────────────────
       하단 우측: 월별 출고 현황
       offsetStart : "이번달" 기준 몇 개월 전부터 데이터를 만들지 (0 = 이번달)
       count       : 몇 건 생성할지
       ──────────────────────────────────────────────────────────── */
    App.fetchUsageMonthly = async function (offsetStart, count) {
        const today = new Date();
        const currentMonth = today.getMonth() + 1;
        const currentYear = today.getFullYear();
        const rows = [];

        const startI = offsetStart + count - 1;
        for (let i = startI; i >= offsetStart; i--) {
            let m = currentMonth - i;
            let y = currentYear;
            while (m <= 0) {
                m += 12;
                y -= 1;
            }

            const seedBase = hashSeed(`${y}-${pad(m)}-out-month`);
            const a  = seededVal(seedBase, 1500, 6000);
            const c  = seededVal(seedBase + 1, 1200, 5000);
            const dd = seededVal(seedBase + 2, 800, 4000);

            rows.push({ date_display: `${y}년 ${m}월`, month_offset: i, A: a, C: c, D: dd });
        }
        return { rows };
    };

    /* 공통 라우터 훅 */
    App.loadData = async function (dateStr) {
        if (App.headerApi && App.headerApi.isEditMode && App.headerApi.isEditMode()) {
            App.headerApi.toggleEditMode();
        }

        App.state.compBaseDate = dateStr || App.state.compBaseDate || todayStr();
        App.state.compHasNext = true;
        App.state.compHasPrev = true;
        App.state.isInitialLoad = true;

        await Promise.all([
            App.loadCompData('none'),
            App.loadInbound(),
            App.loadUsageMonthly()
        ]);

        App.state.isChanged = false;
    };

    App.saveData = async function () {
        App.state.isChanged = false;
        if (App.headerApi && App.headerApi.toggleEditMode) App.headerApi.toggleEditMode();
    };

})();