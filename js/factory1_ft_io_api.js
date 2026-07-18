/* factory1_ft_io_api.js — 1공장 FT 재고 종합 데이터 연동
   ────────────────────────────────────────────────────────────────
   ⚠ 현재는 DB(Supabase) 연동 전 단계로, 레이아웃/동작 확인을 위한
   임시 mock 데이터를 반환합니다. 추후 DB 연결 시 아래 3개 함수
   (fetchComparisonData / fetchInboundList / fetchUsageDaily) 의
   "TODO" 표시된 내부 로직만 실제 Supabase 쿼리 / fetch 호출로
   교체하면 되고, 반환하는 데이터 형식(각 함수 하단 주석 참고)은
   그대로 유지해주세요. render.js 쪽 코드는 수정할 필요가 없습니다.
   ──────────────────────────────────────────────────────────────── */
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

    // 날짜 문자열 기반의 결정론적 의사 난수 (매번 같은 날짜는 같은 값을 반환 → 스크롤/네비게이션 시 값이 안 바뀜)
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

    /* ─────────────────────────────────────────────
       좌측 4단 대조표 데이터
       TODO: Supabase에서 baseDateStr 기준 앞뒤 날짜 범위의
             출고/ERP재고/실재고 데이터를 조회하도록 교체
       반환 형식: { status: 'success', dates: [
           { date: 'YYYY-MM-DD', weekday: '월', usage:[A,C,D], erp:[A,C,D], real:[A,C,D], diff:[A,C,D] }, ...
       ] }
    ───────────────────────────────────────────── */
    App.fetchComparisonData = async function (baseDateStr, direction) {
        const RANGE = 15; // 기준일 앞뒤로 15일씩 mock 생성
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

    /* ─────────────────────────────────────────────
       우측 상단: 입고 현황 (연도별 목록)
       TODO: Supabase에서 해당 연도의 입고 이벤트 목록 조회로 교체
       반환 형식: [
           { date_display: '2026.03.15', A_rl, A_kg, C_rl, C_kg, D_rl, D_kg }, ...
       ]
    ───────────────────────────────────────────── */
    App.fetchInboundList = async function (year) {
        const today = new Date();
        const monthLimit = (year === today.getFullYear()) ? (today.getMonth() + 1) : 12;
        const rows = [];

        for (let m = 1; m <= monthLimit; m++) {
            const dateStr = `${year}-${pad(m)}-15`;
            const seedBase = hashSeed(dateStr + '-in');
            const aRl = seededVal(seedBase, 0, 20);
            const cRl = seededVal(seedBase + 1, 0, 15);
            const dRl = seededVal(seedBase + 2, 0, 10);
            rows.push({
                date_display: `${year}.${pad(m)}.15`,
                A_rl: aRl, A_kg: aRl * 25,
                C_rl: cRl, C_kg: cRl * 25,
                D_rl: dRl, D_kg: dRl * 25
            });
        }
        return rows;
    };

    /* ─────────────────────────────────────────────
       우측 하단: 월별 출고 현황 (해당 월의 일자별 목록 + 합계)
       TODO: Supabase에서 해당 연/월의 일자별 출고량 조회로 교체
       반환 형식: {
           rows: [ { date_display: '03/15 (일)', A, C, D }, ... ],
           byItem: { A, C, D }, total
       }
    ───────────────────────────────────────────── */
    App.fetchUsageDaily = async function (year, month) {
        const daysInMonth = new Date(year, month, 0).getDate();
        const rows = [];
        const byItem = { A: 0, C: 0, D: 0 };

        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${pad(month)}-${pad(d)}`;
            const seedBase = hashSeed(dateStr + '-out');
            const a = seededVal(seedBase, 30, 250);
            const c = seededVal(seedBase + 1, 20, 200);
            const dd = seededVal(seedBase + 2, 10, 150);
            byItem.A += a; byItem.C += c; byItem.D += dd;
            rows.push({ date_display: `${pad(month)}/${pad(d)} (${weekdayKr(dateStr)})`, A: a, C: c, D: dd });
        }
        return { rows, byItem, total: byItem.A + byItem.C + byItem.D };
    };

    /* ─────────────────────────────────────────────
       공통 라우터(factory1_common.js) 연동 훅
       - 헤더의 날짜 네비게이션/오늘 버튼/달력에서 날짜가 바뀔 때마다
         Factory1FtIoModule.activate(dateStr) → App.loadData(dateStr) 순으로 호출됨
    ───────────────────────────────────────────── */
    App.loadData = async function (dateStr) {
        if (App.headerApi && App.headerApi.isEditMode && App.headerApi.isEditMode()) {
            App.headerApi.toggleEditMode();
        }

        App.state.compBaseDate = dateStr || App.state.compBaseDate || todayStr();
        App.state.compHasNext = true;
        App.state.compHasPrev = true;
        App.state.isInitialLoad = true;

        // 좌측 4단 대조표 데이터 및 우측 카드 데이터 연쇄 로드 누락 해결
        await Promise.all([
            App.loadCompData('none'),
            App.loadInbound(),
            App.loadUsageDaily()
        ]);

        App.state.isChanged = false;
    };

    // 이 페이지는 편집 폼이 없는 조회 전용 요약 화면이라 저장할 내용이 없습니다.
    App.saveData = async function () {
        App.state.isChanged = false;
        if (App.headerApi && App.headerApi.toggleEditMode) App.headerApi.toggleEditMode();
    };

})();