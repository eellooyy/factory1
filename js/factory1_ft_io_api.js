/* factory1_ft_io_api.js — 1공장 FT 재고 종합 데이터 연동 */
(function () {
    'use strict';

    const App = window.Factory1FtIo;
    if (!App) return;

    // ── Supabase 클라이언트 초기화 ─────────────────────────────────────────────
    const supabase = window.supabase.createClient(App.SUPABASE_URL, App.SUPABASE_KEY);

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

    function numOrNull(v) {
        if (v === null || v === undefined || v === '') return null;
        const n = Number(v);
        return isNaN(n) ? null : n;
    }

    /* ────────────────────────────────────────────────────────────
       1층 4단 대조표
       - 출고        : v_factory1_ft_usage_daily (print_date / paper_a·c·d)
       - 실재고      : v_factory1_ft_actual_stock (log_date / item_name / actual_stock_kg)
       - 실재고-ERP  : v_factory1_ft_actual_stock (contrast_qty)
       - ERP 재고    : 미연동 (추후 논의) → '-' 표기

       direction 별 조회 구간
       - 'none' : baseDate ± COMP_RANGE
       - 'next' : baseDate+1 ~ baseDate+COMP_RANGE  (오늘 이후는 제외)
       - 'prev' : baseDate-COMP_RANGE ~ baseDate-1  (COMP_MAX_PAST_DAYS 까지)
       ──────────────────────────────────────────────────────────── */
    App.fetchComparisonData = async function (baseDateStr, direction) {
        const RANGE = App.COMP_RANGE;
        const today = todayStr();
        const minDate = addDays(today, -App.COMP_MAX_PAST_DAYS);

        let from, to;
        if (direction === 'next') {
            from = addDays(baseDateStr, 1);
            to = addDays(baseDateStr, RANGE);
        } else if (direction === 'prev') {
            from = addDays(baseDateStr, -RANGE);
            to = addDays(baseDateStr, -1);
        } else {
            from = addDays(baseDateStr, -RANGE);
            to = addDays(baseDateStr, RANGE);
        }

        // 미래 날짜 및 과거 조회 한계 보정
        if (to > today) to = today;
        if (from < minDate) from = minDate;
        if (from > to) return { status: 'success', dates: [] };

        const [usageRes, stockRes] = await Promise.all([
            supabase.from(App.USAGE_VIEW)
                .select('print_date, paper_a, paper_c, paper_d')
                .gte('print_date', from).lte('print_date', to),
            supabase.from(App.STOCK_VIEW)
                .select('log_date, item_name, actual_stock_kg, contrast_qty')
                .gte('log_date', from).lte('log_date', to)
        ]);

        if (usageRes.error) console.error('[factory1_ft_io] 출고 조회 실패:', usageRes.error.message);
        if (stockRes.error) console.error('[factory1_ft_io] 실재고 조회 실패:', stockRes.error.message);

        // 날짜 → 출고량 매핑
        const usageMap = {};
        (usageRes.data || []).forEach(r => {
            usageMap[r.print_date] = [
                numOrNull(r.paper_a), numOrNull(r.paper_c), numOrNull(r.paper_d)
            ];
        });

        // 날짜 → 품목(A/C/D) → { real, diff } 매핑
        const stockMap = {};
        (stockRes.data || []).forEach(r => {
            const key = r.log_date;
            if (!stockMap[key]) stockMap[key] = {};
            stockMap[key][r.item_name] = {
                real: numOrNull(r.actual_stock_kg),
                diff: numOrNull(r.contrast_qty)
            };
        });

        const dates = [];
        for (let d = from; d <= to; d = addDays(d, 1)) {
            const usage = usageMap[d] || [null, null, null];
            const stock = stockMap[d] || {};

            dates.push({
                date: d,
                weekday: weekdayKr(d),
                usage,
                erp: [null, null, null], // ERP 재고 — 추후 연동
                real: App.GROUPS.map(g => (stock[g] ? stock[g].real : null)),
                diff: App.GROUPS.map(g => (stock[g] ? stock[g].diff : null))
            });
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
       v_factory1_ft_usage_daily 의 print_date 를 월 단위로 묶어
       paper_a / paper_c / paper_d 를 각각 합산합니다.
       year : 조회할 연도 (해당 연도 1/1 ~ 12/31)
       결과는 과거→최신(오름차순)으로 반환되어 화면 아래쪽에 최신 월이 옵니다.
       ──────────────────────────────────────────────────────────── */
    App.fetchUsageMonthly = async function (year) {
        const { data, error } = await supabase
            .from(App.USAGE_VIEW)
            .select('print_date, paper_a, paper_c, paper_d')
            .gte('print_date', `${year}-01-01`)
            .lte('print_date', `${year}-12-31`)
            .order('print_date', { ascending: true });

        if (error) {
            console.error('[factory1_ft_io] 월별 출고 조회 실패:', error.message);
            return { rows: [] };
        }

        // 월(1~12) → 합산 누적
        const sums = {};
        (data || []).forEach(r => {
            const m = Number(String(r.print_date).slice(5, 7));
            if (!m) return;
            if (!sums[m]) sums[m] = { A: 0, C: 0, D: 0 };
            sums[m].A += Number(r.paper_a) || 0;
            sums[m].C += Number(r.paper_c) || 0;
            sums[m].D += Number(r.paper_d) || 0;
        });

        const rows = Object.keys(sums)
            .map(Number)
            .sort((a, b) => a - b)
            .map(m => ({
                date_display: `${year}년 ${m}월`,
                month: m,
                A: sums[m].A,
                C: sums[m].C,
                D: sums[m].D
            }));

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