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

    /* 하단 좌측: 입고 현황 (최근 4일치 생성) */
    App.fetchInboundList = async function (year) {
        const today = new Date();
        const rows = [];

        // 최근 4일간 데이터 생성
        for (let i = 3; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);

            const m = d.getMonth() + 1;
            const dayNum = d.getDate();
            const dayName = App.WD_KR[d.getDay()];
            const dateDisplay = `${pad(m)}/${pad(dayNum)} (${dayName})`;

            const seedBase = hashSeed(`${year}-${pad(m)}-${pad(dayNum)}-in`);
            const aRl = seededVal(seedBase, 5, 20);
            const cRl = seededVal(seedBase + 1, 3, 18);
            const dRl = seededVal(seedBase + 2, 2, 12);

            rows.push({
                date_display: dateDisplay,
                A_rl: aRl, A_kg: aRl * 25,
                C_rl: cRl, C_kg: cRl * 25,
                D_rl: dRl, D_kg: dRl * 25
            });
        }
        return rows;
    };

    /* 하단 우측: 월별 출고 현황 (최근 4개월치 생성) */
    App.fetchUsageMonthly = async function (year) {
        const today = new Date();
        const currentMonth = today.getMonth() + 1;
        const rows = [];

        // 최근 4개월간 데이터 생성
        for (let i = 3; i >= 0; i--) {
            let m = currentMonth - i;
            let y = year;
            if (m <= 0) {
                m += 12;
                y -= 1;
            }

            const seedBase = hashSeed(`${y}-${pad(m)}-out-month`);
            const a  = seededVal(seedBase, 1500, 6000);
            const c  = seededVal(seedBase + 1, 1200, 5000);
            const dd = seededVal(seedBase + 2, 800, 4000);

            rows.push({ date_display: `${m}월`, A: a, C: c, D: dd });
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