/* factory1_mediause_api.js — 1공장 사용량 [2층] 데이터 연동
   ────────────────────────────────────────────────────────────────
   이 페이지는 조회 전용입니다. 쓰기 경로가 없습니다.

   1공장은 v_factory1_usage_by_media 를 봅니다. base 테이블(factory1_usage)을
   직접 읽지 않는 이유는 1층과 같습니다 — 회계 보정(adjustments)이 뷰에서만
   합산되기 때문입니다.

   3공장은 FACTORY3_VIEW 가 null 인 동안 아예 조회하지 않습니다.
   (factory3_usage 에 media_code 가 없어 매체를 코드로 가를 수 없습니다)
   ──────────────────────────────────────────────────────────────── */
(function () {
    'use strict';

    const App = window.Factory1MediaUse;
    if (!App) return;

    const supabase = window.supabase.createClient(App.SUPABASE_URL, App.SUPABASE_KEY);
    const state = App.state;

    /* 설정에 없는 매체코드가 나타나면 한 번만 알립니다.
       신규 매체가 생겼는데 열이 없어 조용히 누락되는 것을 막기 위함입니다.
       2026-07-28 현재 아래 두 건이 여기에 걸립니다 —
         13AS       매일경제신문(특집)  누적 2,218,147
         13BN-00006 약사공론            누적    34,665
       열로 뺄지 정해지면 COLUMNS 에 추가하세요. */
    const knownCodes = new Set(App.COLUMNS.map(c => c.mediaCode).filter(Boolean));
    const warned = new Set();

    function warnUnmapped(code, name, where) {
        if (!code || knownCodes.has(code) || warned.has(where + code)) return;
        warned.add(where + code);
        console.warn(`[factory1_mediause] ${where}: 열이 지정되지 않은 매체 — ${code} ${name || ''}`);
    }

    App.fetchRange = async function (from, to) {
        const jobs = [
            supabase.from(App.VIEW)
                .select('print_date, media_code, media_name, usage_qty')
                .gte('print_date', from)
                .lte('print_date', to)
        ];

        // 3공장 뷰가 준비되면 여기에 한 건 더 붙습니다.
        if (App.FACTORY3_VIEW) {
            jobs.push(
                supabase.from(App.FACTORY3_VIEW)
                    .select('print_date, media_code, media_name, usage_qty')
                    .gte('print_date', from)
                    .lte('print_date', to)
            );
        }

        const [f1Res, f3Res] = await Promise.all(jobs);

        if (f1Res.error) console.error('[factory1_mediause] 1공장 조회 실패:', f1Res.error.message);
        if (f3Res && f3Res.error) console.error('[factory1_mediause] 3공장 조회 실패:', f3Res.error.message);

        // 뷰가 이미 (날짜 × 매체)로 합산돼 있어 그대로 담습니다.
        (f1Res.data || []).forEach(r => {
            warnUnmapped(r.media_code, r.media_name, '1공장');
            if (!state.usage[r.print_date]) state.usage[r.print_date] = {};
            state.usage[r.print_date][r.media_code] = Number(r.usage_qty) || 0;
        });

        if (f3Res) {
            (f3Res.data || []).forEach(r => {
                warnUnmapped(r.media_code, r.media_name, '3공장');
                if (!state.factory3[r.print_date]) state.factory3[r.print_date] = {};
                state.factory3[r.print_date][r.media_code] = Number(r.usage_qty) || 0;
            });
        }

        return !f1Res.error && !(f3Res && f3Res.error);
    };

})();
