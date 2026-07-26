/* factory1_ipgo_api.js — 1공장 입고 데이터 연동
   ────────────────────────────────────────────────────────────────
   테이블: factory1_ipgo (ipgo_date, item_code, roll_qty, memo, updated_at)
           unique (ipgo_date, item_code) → 셀 하나가 한 줄입니다.

   저장은 "바뀐 셀만" 보냅니다. 화면에 보이는 구간을 통째로 덮어쓰지
   않으므로, 두 사람이 서로 다른 셀을 동시에 고쳐도 상대 수정이
   되돌아가지 않습니다.
   ──────────────────────────────────────────────────────────────── */
(function () {
    'use strict';

    const App = window.Factory1Ipgo;
    if (!App) return;

    const supabase = window.supabase.createClient(App.SUPABASE_URL, App.SUPABASE_KEY);
    const state = App.state;

    /* ────────────────────────────────────────────────────────────
       구간 조회
       읽어온 값을 cache(화면 표시용) 와 snapshot(원본 비교용) 양쪽에
       같이 넣습니다. 이후 입력값이 snapshot 과 달라지면 dirty 로 잡힙니다.
       ──────────────────────────────────────────────────────────── */
    App.fetchRange = async function (from, to) {
        const { data, error } = await supabase
            .from(App.TABLE)
            .select('ipgo_date, item_code, roll_qty')
            .gte('ipgo_date', from)
            .lte('ipgo_date', to);

        if (error) {
            console.error('[factory1_ipgo] 조회 실패:', error.message);
            return false;
        }

        (data || []).forEach(r => {
            const d = r.ipgo_date;
            if (!state.cache[d]) state.cache[d] = {};
            if (!state.snapshot[d]) state.snapshot[d] = {};

            const v = (r.roll_qty === null || r.roll_qty === undefined) ? null : Number(r.roll_qty);
            state.snapshot[d][r.item_code] = v;

            // 저장 전 입력값이 남아 있는 셀은 덮어쓰지 않습니다.
            if (!state.dirty.has(`${d}|${r.item_code}`)) {
                state.cache[d][r.item_code] = v;
            }
        });

        return true;
    };

    /* ────────────────────────────────────────────────────────────
       변경분 저장
       upserts : 값이 있는 셀 → (ipgo_date, item_code) 충돌 시 UPDATE
       deletes : 값을 비운 셀 → 행 자체를 지워 '미입력' 상태로 되돌림
                 (0 은 "확인했고 입고 없음"이라 지우지 않고 0 으로 저장됩니다)
       ──────────────────────────────────────────────────────────── */
    App.saveDirty = async function (upserts, deletes) {
        if (upserts.length) {
            const { error } = await supabase
                .from(App.TABLE)
                .upsert(upserts, { onConflict: 'ipgo_date,item_code' });

            if (error) {
                console.error('[factory1_ipgo] 저장 실패:', error.message);
                alert('저장에 실패했습니다: ' + error.message);
                return false;
            }
        }

        for (const d of deletes) {
            const { error } = await supabase
                .from(App.TABLE)
                .delete()
                .eq('ipgo_date', d.ipgo_date)
                .eq('item_code', d.item_code);

            if (error) {
                console.error('[factory1_ipgo] 삭제 실패:', error.message);
                alert('빈 칸 처리에 실패했습니다: ' + error.message);
                return false;
            }
        }

        return true;
    };

})();
