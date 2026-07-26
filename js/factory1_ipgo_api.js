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
            .select('ipgo_date, item_code, roll_qty, memo')
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

            const v = Number(r.roll_qty) || 0;

            // memo 는 롤 수가 0 이어도 행을 지우면 안 되는 경우를 가리는 데 씁니다.
            state.snapshot[d][r.item_code] = { roll: v, memo: r.memo || null };

            // 저장 전 입력값이 남아 있는 셀은 덮어쓰지 않습니다.
            if (!state.dirty.has(`${d}|${r.item_code}`)) {
                state.cache[d][r.item_code] = v;
            }
        });

        return true;
    };

    /* ────────────────────────────────────────────────────────────
       우측 블록용 — 선택한 날짜 하루치 입고 현황
       1공장: v_factory1_ipgo 에서 롤 수와 kg(= roll_qty × roll_kg)를 함께
       3공장(별관): factory3_io 의 in_a/in_d(롤) 와 in_a_kg/in_d_kg(kg)
       ──────────────────────────────────────────────────────────── */
    App.fetchSideData = async function (dateStr) {
        const [ipgoRes, f3Res] = await Promise.all([
            supabase.from(App.VIEW)
                .select('item_code, roll_qty, inbound_qty')
                .eq('ipgo_date', dateStr),
            supabase.from(App.FACTORY3_TABLE)
                .select('in_a, in_d, in_a_kg, in_d_kg')
                .eq('date', dateStr)
                .maybeSingle()
        ]);

        if (ipgoRes.error) console.error('[factory1_ipgo] 우측 블록 조회 실패:', ipgoRes.error.message);
        if (f3Res.error)   console.error('[factory1_ipgo] 별관(3공장) 조회 실패:', f3Res.error.message);

        const ipgo = {};
        (ipgoRes.data || []).forEach(r => {
            ipgo[r.item_code] = {
                roll: Number(r.roll_qty) || 0,
                kg: Number(r.inbound_qty) || 0
            };
        });

        const f3row = f3Res.data || null;
        const factory3 = f3row ? {
            a: { roll: Number(f3row.in_a) || 0, kg: Number(f3row.in_a_kg) || 0 },
            d: { roll: Number(f3row.in_d) || 0, kg: Number(f3row.in_d_kg) || 0 }
        } : {};

        return { ipgo, factory3 };
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
