/* factory1_narasarang_api.js — 1공장 나라사랑(48.8g) DB 연동
   ────────────────────────────────────────────────────────────────
   읽는 곳이 넷, 쓰는 곳은 하나입니다.

     factory1_ipgo             입고 (완롤)
     factory1_jigo_real        지고 재고 (완롤) — B5 · B6 를 더해 한 값으로
     v_factory1_usage_by_item  출고 (kg)
     v_factory1_geupji_carry   급지대 잔량 (kg) — 계승까지 끝난 값
     └ 쓰기는 factory1_geupji_carry (base) 한 곳뿐입니다.

   재고(kg)·잔량 합계는 **저장하지 않습니다.** 지고 재고나 잔량을 고치면
   따라 움직여야 하는 값이라, 저장하는 순간 조용히 갈라집니다.
   ──────────────────────────────────────────────────────────────── */
(function () {
    'use strict';

    const App = window.Factory1Narasarang;
    if (!App) return;

    const supabase = window.supabase.createClient(App.SUPABASE_URL, App.SUPABASE_KEY);
    const state = App.state;

    function yearStart(year) { return `${year}-01-01`; }
    function yearEnd(year)   { return `${year}-12-31`; }

    /* 기준행 — 전년도 12월 31일. 엑셀의 맨 윗줄과 같은 자리입니다.
       "이 해를 얼마에서 시작했나"를 보여주는 못이라, 이벤트가 있었든 없었든
       언제나 이 날짜입니다. (연초 이전의 '마지막 이벤트'로 잡으면 그날의 지고
       재고가 없는 날로 걸려 정작 재고가 안 보입니다) */
    function baseDateOf(year) { return `${year - 1}-12-31`; }

    /* ── 롤당 중량 ────────────────────────────────────────────────────────────
       재고(kg) 를 만드는 계수입니다. 마스터에 있으니 화면에 하드코딩하지 않습니다.
       못 읽어도 상수의 대비값으로 계속 돌아갑니다 — 여기서 멈추면 롤 수까지
       못 보게 되는데, 그건 과한 반응입니다.
       ──────────────────────────────────────────────────────────────────────── */
    App.loadRollKg = async function () {
        const { data, error } = await supabase
            .from(App.PAPER_TABLE)
            .select('roll_kg')
            .eq('item_code', App.ITEM_CODE)
            .maybeSingle();

        if (error) {
            console.error('[factory1_narasarang] 롤중량 조회 실패:', error.message);
            return false;
        }
        if (data && data.roll_kg) App.ROLL_KG = Number(data.roll_kg);
        return true;
    };

    /* ── 조회 ─────────────────────────────────────────────────────────────────
       네 곳을 같이 던집니다. 서로 무관해서 순서가 필요 없습니다.

       조회 구간은 기준행(전년도 12/31)부터 연말까지입니다. 기준행을 구간에
       포함시켜 한 번에 받아 오고, **줄을 만들 날짜는 연초부터**만 셉니다 —
       기준행은 이벤트 여부와 무관하게 언제나 붙는 줄이기 때문입니다.
       ──────────────────────────────────────────────────────────────────────── */
    App.fetchYear = async function (year) {
        const base = baseDateOf(year);
        const from = yearStart(year);
        const to   = yearEnd(year);

        const [ipgo, jigo, usage, carryBase] = await Promise.all([
            supabase.from(App.IPGO_TABLE)
                .select('ipgo_date, roll_qty')
                .eq('item_code', App.ITEM_CODE)
                .gte('ipgo_date', base).lte('ipgo_date', to),

            supabase.from(App.JIGO_TABLE)
                .select('inv_date, floor, roll_qty')
                .eq('item_code', App.ITEM_CODE)
                .gte('inv_date', base).lte('inv_date', to),

            supabase.from(App.USAGE_VIEW)
                .select('print_date, usage_qty')
                .eq('item_code', App.ERP_CODE)
                .gte('print_date', base).lte('print_date', to),

            /* 잔량은 base 테이블을 봅니다 — '사람이 실제로 적은 날'을 알아야
               줄을 만들 수 있기 때문입니다. 계승 뷰는 모든 날에 값을 채워
               돌려주므로 그걸로는 적은 날을 가릴 수 없습니다. */
            supabase.from(App.CARRY_TABLE)
                .select('log_date')
                .eq('geupji_key', App.GEUPJI_KEY)
                .gte('log_date', from).lte('log_date', to)
        ]);

        const failed = [ipgo, jigo, usage, carryBase].find(r => r.error);
        if (failed) {
            console.error('[factory1_narasarang] 조회 실패:', failed.error.message);
            return false;
        }

        state.ipgo = {};
        (ipgo.data || []).forEach(r => {
            state.ipgo[r.ipgo_date] = (state.ipgo[r.ipgo_date] || 0) + (Number(r.roll_qty) || 0);
        });

        // 층은 여기서 사라집니다 — 창고가 둘로 나뉜 건 이 화면의 관심사가 아닙니다
        state.jigo = {};
        (jigo.data || []).forEach(r => {
            state.jigo[r.inv_date] = (state.jigo[r.inv_date] || 0) + (Number(r.roll_qty) || 0);
        });

        state.usage = {};
        (usage.data || []).forEach(r => {
            state.usage[r.print_date] = (state.usage[r.print_date] || 0) + (Number(r.usage_qty) || 0);
        });

        /* ── 줄을 만들 날짜 ──────────────────────────────────────────────
           입고 ∪ 출고 ∪ 잔량을 적은 날 ∪ 사용자가 더한 날. **연초부터**만
           셉니다 — 기준행(전년도 12/31)은 이벤트와 무관하게 늘 붙습니다.
           지고 재고는 매일 들어오므로 기준에서 뺍니다. 넣으면 매일이 이벤트가 됩니다.
           ──────────────────────────────────────────────────────────── */
        const dates = new Set();
        Object.keys(state.ipgo).filter(d => d >= from).forEach(d => dates.add(d));
        Object.keys(state.usage).filter(d => d >= from).forEach(d => dates.add(d));
        (carryBase.data || []).forEach(r => dates.add(r.log_date));
        state.extraDates.filter(d => d >= from && d <= to).forEach(d => dates.add(d));

        state.rows = Array.from(dates).sort().map(d => ({ date: d, isBase: false }));
        state.rows.unshift({ date: base, isBase: true });

        await fetchCarry(state.rows.map(r => r.date));
        return true;
    };

    /* ── 잔량 (계승까지 끝난 값) ──────────────────────────────────────────────
       그 날짜에 적은 행이 없어도 뷰가 직전 값을 채워 돌려줍니다. 몇 달 전에
       적은 값이 오늘 줄에 그대로 뜨는 것이 정상입니다.
       ──────────────────────────────────────────────────────────────────────── */
    async function fetchCarry(dates) {
        state.carry = {};
        if (!dates || !dates.length) return;

        const { data, error } = await supabase
            .from(App.CARRY_VIEW)
            .select('log_date, slot, remain_kg')
            .eq('geupji_key', App.GEUPJI_KEY)
            .in('log_date', dates);

        if (error) {
            console.error('[factory1_narasarang] 잔량 조회 실패:', error.message);
            return;
        }

        (data || []).forEach(r => {
            if (!state.carry[r.log_date]) state.carry[r.log_date] = {};
            state.carry[r.log_date][r.slot] = Number(r.remain_kg);
        });
    }

    /* ── 저장 ─────────────────────────────────────────────────────────────────
       손댄 줄만, 그 줄의 6칸을 **전부** 씁니다 (빈 칸은 0).

       급지 재고 페이지는 '바뀐 칸만' 쓰는데 여기는 다릅니다. 저 화면은 하루치
       한 줄이지만 이 화면은 여러 날짜가 세로로 쌓여 있고, 계승이라 앞 줄을
       고치면 뒷 줄이 따라 움직입니다. 바뀐 칸만 쓰면 "이 날짜의 잔량은 이것"이
       어디에도 확정되지 않아, 나중에 앞 날짜를 고쳤을 때 손대지도 않은 뒷 줄의
       숫자가 조용히 바뀝니다. 줄 전체를 쓰면 그 날짜가 못이 되어 고정됩니다.

       6칸이 전부 비면 그 날짜의 잔량 행을 지웁니다 = 계승으로 되돌립니다.
       "다 썼다(전부 0)"를 적고 싶으면 한 칸에 0 을 넣으면 됩니다. 그러면 그
       줄이 0 으로 못박히고, 비우는 것과 구분됩니다.
       ──────────────────────────────────────────────────────────────────────── */
    App.saveData = async function () {
        if (!state.dirtyRows.size) {
            alert('변경된 내용이 없습니다.');
            return false;
        }

        const upserts = [];
        const deletes = [];

        state.dirtyRows.forEach(date => {
            const vals = App.readRowInputs(date);           // [slot1..slot6] — null 은 빈 칸
            const anyValue = vals.some(v => v !== null);

            if (!anyValue) {
                deletes.push(date);
                return;
            }
            vals.forEach((v, i) => {
                upserts.push({
                    log_date:   date,
                    geupji_key: App.GEUPJI_KEY,
                    slot:       i + 1,
                    remain_kg:  (v === null) ? 0 : v
                });
            });
        });

        if (upserts.length) {
            const { error } = await supabase
                .from(App.CARRY_TABLE)
                .upsert(upserts, { onConflict: 'log_date,geupji_key,slot' });
            if (error) {
                console.error('[factory1_narasarang] 잔량 저장 실패:', error.message);
                alert('저장에 실패했습니다: ' + error.message);
                return false;
            }
        }

        for (const date of deletes) {
            const { error } = await supabase
                .from(App.CARRY_TABLE)
                .delete()
                .eq('geupji_key', App.GEUPJI_KEY)
                .eq('log_date', date);
            if (error) {
                console.error('[factory1_narasarang] 잔량 삭제 실패:', error.message);
                alert('저장에 실패했습니다: ' + error.message);
                return false;
            }
        }

        state.dirtyRows.clear();
        state.isChanged = false;
        state.extraDates = [];   // 저장됐으면 이제 자동 기준으로 잡힙니다

        await App.loadData(App.headerApi.getCurrentDate());
        alert('저장되었습니다.');
        return true;
    };
})();
