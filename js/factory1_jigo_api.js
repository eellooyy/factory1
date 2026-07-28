/* factory1_jigo_api.js — 1공장 지고 재고 DB 연동 (load / save)
   ────────────────────────────────────────────────────────────────
   읽는 곳이 셋입니다.

     factory1_paper_item   롤당 중량 — R/L ↔ Kg 스위처용 (페이지가 뜰 때 한 번)
     factory1_jigo_real    1~9열 — 이 페이지가 입력하는 유일한 대상
     factory1_ft_jigo      10~12열 — 'FT 일지'가 입력한 값을 읽기만 합니다

   쓰는 곳은 factory1_jigo_real 하나뿐입니다.

   [층 코드]
     factory1_ft_jigo 는 같은 층을 '5F'/'6F' 로 부르고 이 페이지는 'B5'/'B6' 로
     부릅니다. 물리적으로는 지하 5·6층 한 곳입니다. 이름을 통일하는 건 전체
     검수 때로 미뤘고, 그때까지는 FT_FLOOR 한 줄이 그 차이를 흡수합니다.

   [비운 칸은 삭제]
     "안 셌다"와 "0롤"은 다른 뜻입니다. 0 을 행으로 남기면 출고 계산이 그날을
     실사한 날로 보고 전일 재고를 통째로 출고로 밀어 넣습니다. 그래서 값을
     지운 칸은 UPDATE 가 아니라 행을 지웁니다.
   ──────────────────────────────────────────────────────────────── */
(function () {
    'use strict';

    const App = window.Factory1JigoInv;
    if (!App) return;

    const state = App.state;
    const FLOORS = App.FLOORS;

    const supabase = window.supabase.createClient(App.SUPABASE_URL, App.SUPABASE_KEY);

    // factory1_ft_jigo.location → 이 페이지의 층 키
    const FT_FLOOR = { '5F': 'B5', '6F': 'B6' };

    // factory1_ft_jigo.item_name → 이 페이지의 itemCode ({ A: 'ft_a', ... })
    const FT_ITEM = {};
    App.COLUMNS.filter(c => c.source === 'ft').forEach(c => { FT_ITEM[c.ftGroup] = c.itemCode; });

    /* 저장 대상은 readonly 가 아닌 열입니다. 지금은 7품목이고, 전용 페이지가
       생기거나 사라지면 상수의 readonly 만 고치면 여기가 따라옵니다. */
    const SAVE_ITEMS = App.COLUMNS.filter(c => !c.readonly).map(c => c.itemCode);

    function isSavable(itemCode) {
        return SAVE_ITEMS.indexOf(itemCode) !== -1;
    }

    /* 읽어온 값을 캐시에 넣습니다. snapshot 은 '변경 여부 판단 기준'이라
       values 와 같은 값으로 함께 채웁니다. */
    function put(floorKey, dateStr, itemCode, roll) {
        if (!state.values[floorKey]) return;
        if (!state.values[floorKey][dateStr]) state.values[floorKey][dateStr] = {};
        if (!state.snapshot[floorKey][dateStr]) state.snapshot[floorKey][dateStr] = {};
        state.values[floorKey][dateStr][itemCode] = roll;
        state.snapshot[floorKey][dateStr][itemCode] = roll;
    }

    /* ── 롤당 중량 ────────────────────────────────────────────────────────────
       페이지가 뜰 때 한 번. 실패해도 화면은 그려야 하므로(롤 표시는 중량과
       무관합니다) 상수에 적힌 대비값을 그대로 두고 넘어갑니다.
       ──────────────────────────────────────────────────────────────────────── */
    App.loadRollKg = async function () {
        const { data, error } = await supabase
            .from(App.PAPER_TABLE)
            .select('item_code, roll_kg');

        if (error) {
            console.error('[factory1_jigo] 용지 마스터 조회 실패:', error.message,
                '— Kg 표시는 상수의 대비값을 씁니다.');
            return false;
        }

        (data || []).forEach(r => {
            const kg = Number(r.roll_kg);
            if (kg > 0) App.ROLL_KG[r.item_code] = kg;
        });
        return true;
    };

    /* ── 지고 재고 (1~9열) ────────────────────────────────────────────────────
       한 번에 최대 31일 × 2층 × 9열 = 558행이라 PostgREST 기본 상한(1000)
       안쪽입니다. RANGE 를 크게 늘리면 여기에 .range() 가 필요해집니다.
       ──────────────────────────────────────────────────────────────────────── */
    async function fetchJigo(from, to) {
        const { data, error } = await supabase
            .from(App.TABLE)
            .select('inv_date, floor, item_code, roll_qty')
            .gte('inv_date', from)
            .lte('inv_date', to);

        if (error) {
            console.error('[factory1_jigo] 지고 재고 조회 실패:', error.message);
            return false;
        }

        (data || []).forEach(r => {
            if (!state.values[r.floor]) return;   // 알 수 없는 층 코드는 건너뜁니다
            put(r.floor, r.inv_date, r.item_code, Number(r.roll_qty) || 0);
        });
        return true;
    }

    /* ── F.T 3열 ──────────────────────────────────────────────────────────────
       factory1_ft.html 이 입력 주인입니다. 여기서는 읽기만 하므로 snapshot 에
       들어가도 저장 대상이 되지 않습니다(입력칸 자체가 없어 dirty 에 안 담김).
       ──────────────────────────────────────────────────────────────────────── */
    async function fetchFt(from, to) {
        const { data, error } = await supabase
            .from(App.FT_TABLE)
            .select('date, location, item_name, stock_qty')
            .gte('date', from)
            .lte('date', to);

        if (error) {
            console.error('[factory1_jigo] F.T 지고 재고 조회 실패:', error.message);
            return false;
        }

        (data || []).forEach(r => {
            const floorKey = FT_FLOOR[r.location];
            const itemCode = FT_ITEM[r.item_name];
            if (!floorKey || !itemCode) return;   // FT 페이지에만 있는 층·품목
            put(floorKey, r.date, itemCode, Number(r.stock_qty) || 0);
        });
        return true;
    }

    /* ── 승계 씨앗 ────────────────────────────────────────────────────────────
       조회 구간(from)보다 앞에서 마지막으로 입력된 1건입니다.

       48.8g 은 한 달에 한 번만 바뀌므로 15일치를 불러오는 것만으로는 직전 값을
       못 보는 날이 대부분이고, 그러면 한 달 내내 빈칸이 됩니다.

       ※ 지금은 승계 열(48.8g)이 readonly 라 이 테이블에 행이 쌓이지 않습니다.
         나라사랑 페이지가 생기면 그 값을 여기서 그대로 읽게 되므로 미리 맞춰
         둡니다. 행이 없으면 조용히 아무 일도 하지 않습니다.
       ──────────────────────────────────────────────────────────────────────── */
    async function fetchCarrySeed(from) {
        const carryCols = App.COLUMNS.filter(c => c.carry);
        if (!carryCols.length) return;

        const jobs = [];
        carryCols.forEach(c => {
            FLOORS.forEach(f => {
                /* 이 구간보다 앞선 씨앗이 이미 있으면 다시 읽지 않습니다.
                   과거로 스크롤할 때만 갱신이 필요합니다 — 앞으로 갈 때는 그
                   사이 날짜가 이미 캐시에 있어 씨앗까지 내려가지 않습니다. */
                const cur = state.carrySeed[f.key][c.itemCode];
                if (cur && cur.date < from) return;

                jobs.push(
                    supabase
                        .from(App.TABLE)
                        .select('inv_date, roll_qty')
                        .eq('floor', f.key)
                        .eq('item_code', c.itemCode)
                        .lt('inv_date', from)
                        .order('inv_date', { ascending: false })
                        .limit(1)
                        .then(({ data, error }) => {
                            if (error) {
                                console.error('[factory1_jigo] 승계 값 조회 실패:', error.message);
                                return;
                            }
                            if (!data || !data.length) return;
                            state.carrySeed[f.key][c.itemCode] = {
                                date: data[0].inv_date,
                                value: Number(data[0].roll_qty) || 0
                            };
                        })
                );
            });
        });

        await Promise.all(jobs);
    }

    /* ── 조회 진입점 ──────────────────────────────────────────────────────────
       render 의 loadRows 가 아직 안 읽은 구간마다 한 번씩 부릅니다.
       세 조회는 서로 무관하므로 같이 보냅니다.
       ──────────────────────────────────────────────────────────────────────── */
    App.fetchRange = async function (from, to) {
        await Promise.all([
            fetchJigo(from, to),
            fetchFt(from, to),
            fetchCarrySeed(from)
        ]);
    };

    /* ── 저장 ─────────────────────────────────────────────────────────────────
       dirty 에 담긴 셀만 보냅니다. 키가 '층|날짜|itemCode' 라 그대로 행이 됩니다.

       upserts : 값이 1 이상인 칸 → (inv_date, floor, item_code) 충돌 시 UPDATE
       deletes : 0 이 되거나 비워진 칸 → 행 자체를 삭제

       삭제를 (날짜, 층)으로 묶습니다. 보통 하루치를 고치므로 요청 1~2번입니다.
       ──────────────────────────────────────────────────────────────────────── */
    App.saveData = async function () {
        const saveBtn = App.headerApi && App.headerApi.elements
            ? App.headerApi.elements.saveBtn : null;

        const upserts = [];
        const deletes = [];

        state.dirty.forEach(key => {
            const parts = key.split('|');
            const floor = parts[0];
            const invDate = parts[1];
            const itemCode = parts[2];

            /* 읽기 전용 열은 입력칸이 없어 여기 담길 수 없지만, 열의 주인이
               바뀌는 중에 남은 dirty 가 섞여 들어오면 남의 테이블 값을 이쪽에
               복사해 버립니다. 저장 직전에 한 번 더 거릅니다. */
            if (!isSavable(itemCode)) return;

            const row = state.values[floor] && state.values[floor][invDate];
            const roll = row ? Number(row[itemCode]) || 0 : 0;

            if (roll > 0) {
                upserts.push({ inv_date: invDate, floor: floor, item_code: itemCode, roll_qty: roll });
            } else {
                deletes.push({ inv_date: invDate, floor: floor, item_code: itemCode });
            }
        });

        if (!upserts.length && !deletes.length) {
            alert('저장할 내용이 없습니다.');
            if (App.headerApi && App.headerApi.toggleEditMode) App.headerApi.toggleEditMode();
            return true;
        }

        if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '저장 중...'; }

        const fail = (msg, err) => {
            console.error(`[factory1_jigo] ${msg}:`, err.message);
            alert(`${msg}: ${err.message}`);
            if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '저장'; }
            return false;
        };

        if (upserts.length) {
            const { error } = await supabase
                .from(App.TABLE)
                .upsert(upserts, { onConflict: 'inv_date,floor,item_code' });
            if (error) return fail('저장에 실패했습니다', error);
        }

        // (날짜, 층)으로 묶어 지웁니다 — 한 칸씩 지우면 요청이 그만큼 늘어납니다
        const groups = {};
        deletes.forEach(d => {
            const gk = `${d.inv_date}|${d.floor}`;
            if (!groups[gk]) groups[gk] = [];
            groups[gk].push(d.item_code);
        });

        for (const gk of Object.keys(groups)) {
            const [invDate, floor] = gk.split('|');
            const { error } = await supabase
                .from(App.TABLE)
                .delete()
                .eq('inv_date', invDate)
                .eq('floor', floor)
                .in('item_code', groups[gk]);
            if (error) return fail('빈 칸 처리에 실패했습니다', error);
        }

        /* 저장된 값이 곧 다음 변경 판단의 기준이 됩니다. 여기서 snapshot 을
           갱신하지 않으면 저장한 칸이 계속 '바뀐 칸'으로 남아, 다시 저장할 때
           같은 값을 또 보냅니다. */
        upserts.forEach(r => {
            if (!state.snapshot[r.floor][r.inv_date]) state.snapshot[r.floor][r.inv_date] = {};
            state.snapshot[r.floor][r.inv_date][r.item_code] = r.roll_qty;
        });
        deletes.forEach(r => {
            if (state.snapshot[r.floor][r.inv_date]) {
                delete state.snapshot[r.floor][r.inv_date][r.item_code];
            }
            // 화면에서도 '–' 로 돌려놓습니다 (0 과 미입력을 같게 그립니다)
            if (state.values[r.floor][r.inv_date]) {
                delete state.values[r.floor][r.inv_date][r.item_code];
            }
        });

        /* dirty 를 비우는 건 편집 모드를 끄기 전이어야 합니다. 끄는 순간
           셀을 다시 그리는데, 그때 dirty 에 남아 있으면 저장이 끝난 칸에
           변경 표시가 그대로 남습니다. */
        state.dirty.clear();
        state.isChanged = false;

        if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '저장'; }

        if (App.headerApi && App.headerApi.toggleEditMode) App.headerApi.toggleEditMode();

        /* 저장이 끝났다는 것을 반드시 알립니다. 아무 반응이 없으면 눌리지
           않은 건지 실패한 건지 알 수가 없습니다. (FT · 입고 · 급지도 같습니다) */
        const parts = [];
        if (upserts.length) parts.push(`${upserts.length}칸`);
        if (deletes.length) parts.push(`${deletes.length}칸 비움`);
        alert(`저장되었습니다. (${parts.join(', ')})`);

        return true;
    };

})();
