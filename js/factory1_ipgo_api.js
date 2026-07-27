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

            if (!state.memo[d]) state.memo[d] = {};

            const v = Number(r.roll_qty) || 0;
            state.snapshot[d][r.item_code] = v;
            state.memo[d][r.item_code] = r.memo || null;

            // 저장 전 입력값이 남아 있는 셀은 덮어쓰지 않습니다.
            if (!state.dirty.has(`${d}|${r.item_code}`)) {
                state.cache[d][r.item_code] = v;
            }
        });

        return true;
    };

    /* ────────────────────────────────────────────────────────────
       구간 조회 — 별관(3공장) 참조 열
       factory3_io 는 날짜당 한 행에 in_a / in_d 컬럼을 갖는 구조라
       (ipgo_date, item_code) 로 펼쳐진 factory1_ipgo 와 형태가 다릅니다.
       이 페이지에서는 읽기만 하므로 롤 수만 날짜별로 담아 둡니다.
       (입력은 3공장 페이지에서만 합니다 — snapshot/dirty 대상이 아닙니다)
       ──────────────────────────────────────────────────────────── */
    App.fetchFactory3Range = async function (from, to) {
        const { data, error } = await supabase
            .from(App.FACTORY3_TABLE)
            .select('date, in_a, in_d')
            .gte('date', from)
            .lte('date', to);

        if (error) {
            console.error('[factory1_ipgo] 별관(3공장) 구간 조회 실패:', error.message);
            return false;
        }

        (data || []).forEach(r => {
            state.factory3[r.date] = {
                a: Number(r.in_a) || 0,
                d: Number(r.in_d) || 0
            };
        });

        return true;
    };

    /* ────────────────────────────────────────────────────────────
       우측 하단 메모 요약 전용 조회
       표에 불러온 날짜 구간과 무관하게, 메모가 달린 행만 따로 읽어옵니다.
       (구간에 묶어두면 오래된 메모가 스크롤로 과거를 불러오기 전까지
        목록에 나타나지 않습니다)

       최근 것부터 limit 개를 받아 화면에서 오래된 순으로 뒤집어 씁니다.
       ──────────────────────────────────────────────────────────── */
    App.fetchMemoList = async function (limit) {
        const max = limit || App.MEMO_LIST_LIMIT;

        // 1공장은 값과 같은 행에, 3공장은 별도 메모 테이블에 저장돼 있어
        // 두 곳을 각각 읽은 뒤 하나로 합칩니다.
        const [f1Res, f3Res] = await Promise.all([
            supabase.from(App.TABLE)
                .select('ipgo_date, item_code, memo')
                .not('memo', 'is', null)
                .order('ipgo_date', { ascending: false })
                .limit(max),
            supabase.from(App.FACTORY3_MEMO_TABLE)
                .select('date, col_id, memo_text')
                .not('memo_text', 'is', null)
                .order('date', { ascending: false })
                .limit(max)
        ]);

        if (f1Res.error) console.error('[factory1_ipgo] 1공장 메모 조회 실패:', f1Res.error.message);
        if (f3Res.error) console.error('[factory1_ipgo] 3공장 메모 조회 실패:', f3Res.error.message);

        // 빈 문자열이 저장된 행은 메모가 없는 것으로 봅니다.
        const f1 = (f1Res.data || [])
            .filter(r => r.memo && String(r.memo).trim() !== '')
            .map(r => ({
                dateStr: r.ipgo_date,
                factory: 1,
                key: r.item_code,
                text: String(r.memo).trim()
            }));

        const f3 = (f3Res.data || [])
            .filter(r => r.memo_text && String(r.memo_text).trim() !== '')
            .map(r => ({
                dateStr: r.date,
                factory: 3,
                key: r.col_id,
                text: String(r.memo_text).trim()
            }));

        state.memoList = f1.concat(f3);

        return !f1Res.error && !f3Res.error;
    };

    /* ────────────────────────────────────────────────────────────
       셀 메모 즉시 저장
       롤 수와 달리 편집 모드/저장 버튼과 무관하게 그 자리에서 반영합니다.

       rollQty 는 DB 에 저장돼 있는 현재 롤 수입니다. 메모만 건드리고
       아직 저장하지 않은 입력값은 건드리지 않기 위해 스냅샷 값을 씁니다.
       메모도 없고 롤 수도 0 이면 행을 남길 이유가 없어 삭제합니다.
       ──────────────────────────────────────────────────────────── */
    App.saveMemo = async function (dateStr, itemCode, memoText, rollQty) {
        const roll = Number(rollQty) || 0;

        if (!memoText && roll === 0) {
            const { error } = await supabase
                .from(App.TABLE)
                .delete()
                .eq('ipgo_date', dateStr)
                .eq('item_code', itemCode);

            if (error) {
                console.error('[factory1_ipgo] 메모 삭제 실패:', error.message);
                alert('메모 삭제에 실패했습니다: ' + error.message);
                return false;
            }
            return true;
        }

        const { error } = await supabase
            .from(App.TABLE)
            .upsert(
                { ipgo_date: dateStr, item_code: itemCode, roll_qty: roll, memo: memoText },
                { onConflict: 'ipgo_date,item_code' }
            );

        if (error) {
            console.error('[factory1_ipgo] 메모 저장 실패:', error.message);
            alert('메모 저장에 실패했습니다: ' + error.message);
            return false;
        }
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
