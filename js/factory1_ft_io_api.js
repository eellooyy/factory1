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
       - ERP 재고    : v_factory1_ft_erp_stock (erp_stock)
                       결산 앵커 + 입고 - 출고 누적. 입출고가 없는 날은 행이 없으므로
                       전일 잔고를 이월해 채웁니다.

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

        const [usageRes, stockRes, erpRes, erpSeedRes] = await Promise.all([
            supabase.from(App.USAGE_VIEW)
                .select('print_date, paper_a, paper_c, paper_d')
                .gte('print_date', from).lte('print_date', to),
            supabase.from(App.STOCK_VIEW)
                .select('log_date, item_name, actual_stock_kg, contrast_qty')
                .gte('log_date', from).lte('log_date', to),
            supabase.from(App.ERP_STOCK_VIEW)
                .select('date, item, erp_stock')
                .gte('date', from).lte('date', to),
            // 구간 첫날 이전의 마지막 잔고 — 조회 구간이 입출고 없는 날로 시작할 때
            // 이월할 기준값이 없어 '-'로 비는 것을 막기 위한 시드입니다.
            Promise.all(App.GROUPS.map(g =>
                supabase.from(App.ERP_STOCK_VIEW)
                    .select('item, erp_stock')
                    .eq('item', g)
                    .lt('date', from)
                    .order('date', { ascending: false })
                    .limit(1)
            ))
        ]);

        if (usageRes.error) console.error('[factory1_ft_io] 출고 조회 실패:', usageRes.error.message);
        if (stockRes.error) console.error('[factory1_ft_io] 실재고 조회 실패:', stockRes.error.message);
        if (erpRes.error) console.error('[factory1_ft_io] ERP 재고 조회 실패:', erpRes.error.message);

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

        // 날짜 → 품목(A/C/D) → ERP 재고 매핑
        // 뷰는 입고 또는 출고가 있었던 날만 행을 내보냅니다.
        const erpMap = {};
        (erpRes.data || []).forEach(r => {
            if (!erpMap[r.date]) erpMap[r.date] = {};
            erpMap[r.date][r.item] = numOrNull(r.erp_stock);
        });

        // 구간 시작 이전의 마지막 잔고를 이월 기준값으로 삼습니다.
        const erpCarry = {};
        (erpSeedRes || []).forEach(res => {
            const row = (res.data || [])[0];
            if (row) erpCarry[row.item] = numOrNull(row.erp_stock);
        });

        const dates = [];
        for (let d = from; d <= to; d = addDays(d, 1)) {
            const usage = usageMap[d] || [null, null, null];
            const stock = stockMap[d] || {};

            // 재고는 상태값이라 이동이 없는 날도 잔고는 존재합니다.
            // 뷰에 행이 있는 날만 갱신하고, 없는 날은 직전 잔고를 그대로 이월합니다.
            const erpRow = erpMap[d] || {};
            App.GROUPS.forEach(g => {
                if (erpRow[g] !== undefined && erpRow[g] !== null) erpCarry[g] = erpRow[g];
            });

            dates.push({
                date: d,
                weekday: weekdayKr(d),
                usage,
                erp: App.GROUPS.map(g => (erpCarry[g] === undefined ? null : erpCarry[g])),
                real: App.GROUPS.map(g => (stock[g] ? stock[g].real : null)),
                diff: App.GROUPS.map(g => (stock[g] ? stock[g].diff : null))
            });
        }

        return { status: 'success', dates };
    };

    /* ────────────────────────────────────────────────────────────
       하단 좌측: 입고 현황
       1공장 입고(v_factory1_ipgo)의 F.T 품목(A/C/D)을 그대로 가져옵니다.

       월 1~2회 발생하는 데이터라 날짜를 하루 단위로 채우지 않고
       실제 입고가 있었던 날(roll_qty > 0)만 남깁니다.
       결과는 과거→최신(오름차순)이므로 화면 아래쪽에 최신 날짜가 옵니다.

       year : 조회할 연도 (해당 연도 1/1 ~ 12/31)
       ──────────────────────────────────────────────────────────── */
    App.fetchInboundList = async function (year) {
        const codes = Object.keys(App.FT_ITEMS);   // ['ft_a', 'ft_c', 'ft_d']

        const { data, error } = await supabase
            .from(App.IPGO_VIEW)
            .select('ipgo_date, item_code, roll_qty, inbound_qty')
            .in('item_code', codes)
            .gt('roll_qty', 0)                     // 입고가 없는 날은 행 자체를 만들지 않음
            .gte('ipgo_date', `${year}-01-01`)
            .lte('ipgo_date', `${year}-12-31`)
            .order('ipgo_date', { ascending: true });

        if (error) {
            console.error('[factory1_ft_io] 입고 조회 실패:', error.message);
            return [];
        }

        // 날짜별로 A / C / D 를 한 줄에 모읍니다.
        const byDate = {};
        (data || []).forEach(r => {
            if (!byDate[r.ipgo_date]) {
                byDate[r.ipgo_date] = {
                    date: r.ipgo_date,
                    date_display: `${r.ipgo_date.slice(5, 7)}/${r.ipgo_date.slice(8, 10)} (${weekdayKr(r.ipgo_date)})`,
                    A_rl: 0, A_kg: 0,
                    C_rl: 0, C_kg: 0,
                    D_rl: 0, D_kg: 0
                };
            }
            const g = App.FT_ITEMS[r.item_code];   // 'A' | 'C' | 'D'
            byDate[r.ipgo_date][`${g}_rl`] = Number(r.roll_qty) || 0;
            byDate[r.ipgo_date][`${g}_kg`] = Number(r.inbound_qty) || 0;
        });

        return Object.keys(byDate).sort().map(d => byDate[d]);
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