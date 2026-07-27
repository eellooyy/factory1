/* factory1_paperuse_api.js — 1공장 사용량 [1층] 데이터 연동
   ────────────────────────────────────────────────────────────────
   이 페이지는 조회 전용입니다. 쓰기 경로가 없습니다.

   1공장은 v_factory1_usage_by_item 을 봅니다. base 테이블(factory1_usage)을
   직접 읽지 않는 이유는, 회계 보정(adjustments)이 뷰에서만 합산되기
   때문입니다. 나중에 보정이 입력돼도 이 페이지는 고칠 것이 없습니다.

   별관(3공장)은 아직 전용 뷰가 없어 factory3_usage 를 직접 읽습니다.
   3공장은 (날짜, 매체, 품목) 단위로 행이 나뉘어 있어 품목 기준으로 합산합니다.
   ──────────────────────────────────────────────────────────────── */
(function () {
    'use strict';

    const App = window.Factory1PaperUse;
    if (!App) return;

    const supabase = window.supabase.createClient(App.SUPABASE_URL, App.SUPABASE_KEY);
    const state = App.state;

    // 설정에 없는 ERP 품목코드가 새로 나타나면 한 번만 알립니다.
    // (신규 지종이 들어왔는데 열이 없어 조용히 누락되는 것을 막기 위함)
    const knownCodes = new Set(App.COLUMNS.map(c => c.erpCode));
    const warned = new Set();

    function warnUnmapped(code, name, where) {
        if (!code || knownCodes.has(code) || warned.has(where + code)) return;
        warned.add(where + code);
        console.warn(`[factory1_paperuse] ${where}: 열이 지정되지 않은 품목 — ${code} ${name || ''}`);
    }

    App.fetchRange = async function (from, to) {
        const [f1Res, f3Res] = await Promise.all([
            supabase.from(App.VIEW)
                .select('print_date, item_code, item_name, usage_qty')
                .gte('print_date', from)
                .lte('print_date', to),
            supabase.from(App.FACTORY3_TABLE)
                .select('print_date, item_code, item_name, usage_qty')
                .gte('print_date', from)
                .lte('print_date', to)
        ]);

        if (f1Res.error) console.error('[factory1_paperuse] 1공장 조회 실패:', f1Res.error.message);
        if (f3Res.error) console.error('[factory1_paperuse] 별관(3공장) 조회 실패:', f3Res.error.message);

        // 1공장 — 뷰가 이미 (날짜 × 품목)으로 합산돼 있어 그대로 담습니다.
        (f1Res.data || []).forEach(r => {
            warnUnmapped(r.item_code, r.item_name, '1공장');
            if (!state.usage[r.print_date]) state.usage[r.print_date] = {};
            state.usage[r.print_date][r.item_code] = Number(r.usage_qty) || 0;
        });

        // 별관 — 매체별로 행이 갈려 있어 품목 기준으로 더합니다.
        (f3Res.data || []).forEach(r => {
            if (!state.factory3[r.print_date]) state.factory3[r.print_date] = {};
            const cur = state.factory3[r.print_date][r.item_code] || 0;
            state.factory3[r.print_date][r.item_code] = cur + (Number(r.usage_qty) || 0);
        });

        return !f1Res.error && !f3Res.error;
    };

})();
