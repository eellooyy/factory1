/* factory1_inventory_io_api.js — 1공장 재고 종합 데이터 연동
   ────────────────────────────────────────────────────────────────
   실재고 3열(B5 / B6 / B6주행지)을 v_factory1_actual_stock 하나에서 읽습니다.

   왜 뷰 하나인가
     실재고의 실제 출처는 다섯 군데입니다 —
       factory1_jigo_real × roll_kg   (1공장 지고 재고, 롤 → kg)
       factory1_ft_jigo               (F.T 지고 재고, 5F/6F)
       factory1_geupji_real           (급지 호기표, 부분 롤 + 대기 완롤)
       v_factory1_geupji_carry_total  (잔여 주행지 — 대한 C · 48.8g)
       v_factory3_daily_stock         (별관)
     여기서 합치면 3공장 io 화면과 숫자가 조용히 갈라집니다. 합치는 규칙은
     뷰에만 두고 이 파일은 (저장위치 + 품목코드)로 꽂아 넣기만 합니다.

   ERP 재고 · 입고 · 사용량은 아직 연결하지 않았습니다. 값이 없으므로 화면에
   '–' 로 남고, 합계는 실재고 3열만으로 나오며 '실재고 - ERP재고' 는 '–' 입니다.
   ──────────────────────────────────────────────────────────────── */
(function () {
    'use strict';

    const App = window.Factory1InventoryIo;
    if (!App) return;

    const supabase = window.supabase.createClient(App.SUPABASE_URL, App.SUPABASE_KEY);

    function valueKey(locCode, itemCode) {
        return `${locCode}|${itemCode}`;
    }

    function numOrNull(v) {
        if (v === null || v === undefined || v === '') return null;
        const n = Number(v);
        return isNaN(n) ? null : n;
    }

    /* ────────────────────────────────────────────────────────────
       실재고 3열
       뷰가 (inv_date, warehouse_code, erp_code) 그레인으로 내려주므로
       그대로 화면 키에 대응합니다.

       빈 칸의 뜻이 두 가지라 구분해서 다룹니다.
         null  = 그날 실사 입력 자체가 없었다  → 화면 '–'
         0     = 셌는데 없었다                → 화면 0
       뷰가 이미 구분해 내려주므로 여기서는 손대지 않습니다.
       ──────────────────────────────────────────────────────────── */
    async function fetchActualStock(dateStr) {
        const { data, error } = await supabase
            .from(App.TABLES.ACTUAL_STOCK)
            .select('warehouse_code, erp_code, b5, b6, b6_run')
            .eq('inv_date', dateStr);

        if (error) {
            console.error('[factory1_inventory_io] 실재고 조회 실패:', error.message);
            return null;
        }

        const byKey = {};
        (data || []).forEach(r => {
            byKey[valueKey(r.warehouse_code, r.erp_code)] = {
                b5: numOrNull(r.b5),
                b6: numOrNull(r.b6),
                b6run: numOrNull(r.b6_run)
            };
        });
        return byKey;
    }

    /* ────────────────────────────────────────────────────────────
       1공장 3개 창고 — ERP 재고 · 입고 · 사용량

       셋을 뷰 하나가 냅니다. 셋이 같은 계산에서 나오기 때문입니다 —
       ERP 재고는 앵커에 입고를 더하고 사용량을 뺀 누적값이라, 따로 조회하면
       화면에서 'ERP 재고의 하루 변화 != 입고 - 사용량' 이 될 수 있습니다.

       입고·사용량은 '그날 움직인 양'이라 이월하면 안 되고(어제 들어온 양이
       오늘도 들어온 것이 됩니다), ERP 재고는 '잔고'라 반드시 이월해야 합니다.
       뷰가 날짜를 매일 채워 내주므로 화면은 이월을 하지 않습니다.

       has_in / has_use 는 그날 원본에 행이 하나라도 있었는지입니다.
         true  -> 안 잡힌 품목은 움직임 없음 = 0
         false -> 아직 자료가 없다 = '-'
       0 으로 채우면 '입고가 없었다'로 읽히지만 사실은 '모른다'입니다.
       (급지 재고의 '전산 출고' 열이 쓰는 규칙과 같습니다)
       ──────────────────────────────────────────────────────────── */
    async function fetchErpStock(dateStr) {
        const { data, error } = await supabase
            .from(App.TABLES.ERP_STOCK)
            .select('warehouse_code, item_code, in_qty, use_qty, has_in, has_use, erp_qty')
            .eq('date', dateStr);

        if (error) {
            console.error('[factory1_inventory_io] ERP 재고 조회 실패:', error.message);
            return null;
        }

        const byKey = {};
        (data || []).forEach(r => {
            byKey[valueKey(r.warehouse_code, r.item_code)] = {
                erp: numOrNull(r.erp_qty),
                inQty: r.has_in ? (numOrNull(r.in_qty) || 0) : null,
                useQty: r.has_use ? (numOrNull(r.use_qty) || 0) : null
            };
        });
        return byKey;
    }

    /* 별관 입고 — factory3_io 는 품목코드 없이 A/D 두 등급으로 적습니다.
       3공장 io 화면이 쓰는 표와 같은 것이라 두 화면이 갈라지지 않습니다. */
    async function fetchAnnexInbound(dateStr) {
        const { data, error } = await supabase
            .from(App.TABLES.F3_IPGO)
            .select('in_a_kg, in_d_kg')
            .eq('date', dateStr);

        if (error) {
            console.error('[factory1_inventory_io] 별관 입고 조회 실패:', error.message);
            return null;
        }

        const row = (data || [])[0];
        if (!row) return { byGrade: {}, hasData: false };
        return {
            byGrade: { a: Number(row.in_a_kg) || 0, d: Number(row.in_d_kg) || 0 },
            hasData: true
        };
    }

    // 별관 사용량 — 3공장 급지 실적. 여기도 item_code 가 ERP 품목코드입니다.
    async function fetchAnnexUsage(dateStr) {
        const { data, error } = await supabase
            .from(App.TABLES.F3_USAGE)
            .select('item_code, usage_qty')
            .eq('print_date', dateStr);

        if (error) {
            console.error('[factory1_inventory_io] 별관 사용량 조회 실패:', error.message);
            return null;
        }

        const byCode = {};
        (data || []).forEach(r => {
            byCode[r.item_code] = (byCode[r.item_code] || 0) + (Number(r.usage_qty) || 0);
        });
        return { byCode, hasData: (data || []).length > 0 };
    }

    // 별관 — 날짜마다 행이 있는 뷰라 이월이 필요 없습니다.
    async function fetchAnnexErp(dateStr) {
        const { data, error } = await supabase
            .from(App.TABLES.F3_STOCK)
            .select('erp_a, erp_d')
            .eq('date', dateStr);

        if (error) {
            console.error('[factory1_inventory_io] 별관 ERP 재고 조회 실패:', error.message);
            return {};
        }
        const row = (data || [])[0];
        if (!row) return {};
        return { a: numOrNull(row.erp_a), d: numOrNull(row.erp_d) };
    }

    /* ────────────────────────────────────────────────────────────
       재고 확인 상태 (확인 / 보류 / 미확인)

       '미확인'이 기본값이라 DB에 행이 없습니다. 행이 없는 날 = 아직 안 봤다.
       확인·보류를 고른 날만 행이 생기고 미확인으로 되돌리면 행을 지웁니다.
       (급지 재고의 '실제 출고'가 자동값으로 되돌아갈 때 행을 지우는 것과 같은
        방식입니다 — 기본값을 굳이 저장하면 표만 커지고 뜻은 같습니다)
       ──────────────────────────────────────────────────────────── */
    App.fetchStatus = async function (dateStr) {
        const { data, error } = await supabase
            .from(App.TABLES.CHECK)
            .select('status, memo')
            .eq('check_date', dateStr);

        if (error) {
            console.error('[factory1_inventory_io] 확인 상태 조회 실패:', error.message);
            return { status: App.STATUS_DEFAULT, memo: '' };
        }
        const row = (data || [])[0];
        return {
            status: (row && row.status) || App.STATUS_DEFAULT,
            memo: (row && row.memo) || ''
        };
    };

    App.saveStatus = async function (dateStr, status, memo) {
        /* '확인'은 메모를 받지 않으므로 저장하지 않습니다. 화면에서 안 보이는
           메모가 DB에만 남아 있으면 나중에 왜 그 값이 있는지 알 수 없습니다. */
        const opt = App.STATUS_OPTIONS.find(o => o.key === status);
        const keep = (opt && opt.memo) ? (memo || '').trim() : '';

        // 기본값(미확인) + 메모 없음 = 아무것도 기록하지 않은 상태 → 행을 지웁니다
        if (status === App.STATUS_DEFAULT && !keep) {
            const { error } = await supabase
                .from(App.TABLES.CHECK)
                .delete()
                .eq('check_date', dateStr);
            if (error) throw new Error(error.message);
            return;
        }

        const { error } = await supabase
            .from(App.TABLES.CHECK)
            .upsert({ check_date: dateStr, status: status, memo: keep || null },
                    { onConflict: 'check_date' });
        if (error) throw new Error(error.message);
    };

    /* 화면이 쓰는 값 묶음을 만듭니다.
       constant.js 의 fixed 는 DB가 아니라 파일에 박아 둔 상수라 뷰 값보다
       우선합니다(나투라 440). 뷰에 같은 칸이 생기면 그때 fixed 를 지우면 됩니다. */
    App.fetchAll = async function (dateStr) {
        const [actual, erpStock, f3in, f3use, f3Erp] = await Promise.all([
            fetchActualStock(dateStr),
            fetchErpStock(dateStr),
            fetchAnnexInbound(dateStr),
            fetchAnnexUsage(dateStr),
            fetchAnnexErp(dateStr)
        ]);
        const values = {};

        App.LOCATIONS.forEach(loc => {
            loc.items.forEach(item => {
                const key = valueKey(loc.locCode, item.code);
                const row = (actual && actual[key]) || {};

                /* 1공장 3개 창고는 뷰 하나가 세 값을 다 줍니다.
                   별관만 3공장 원본 셋에서 따로 모읍니다. 나투라는 용지 마스터에
                   없어 어느 쪽에도 안 잡히고 '–' 로 남습니다. */
                let erp = null, inQty = null, useQty = null;

                if (loc.factory3) {
                    if (f3in && f3in.hasData) inQty = f3in.byGrade[item.f3Grade] || 0;
                    if (f3use && f3use.hasData) useQty = f3use.byCode[item.code] || 0;
                    if (f3Erp && item.f3Grade) erp = f3Erp[item.f3Grade];
                } else {
                    const e = (erpStock && erpStock[key]) || null;
                    if (e) {
                        erp = e.erp;
                        inQty = e.inQty;
                        useQty = e.useQty;
                    }
                }
                if (erp === undefined) erp = null;

                values[key] = {
                    erp: erp,
                    inQty: inQty,
                    useQty: useQty,
                    b5: row.b5 === undefined ? null : row.b5,
                    b6: row.b6 === undefined ? null : row.b6,
                    b6run: row.b6run === undefined ? null : row.b6run,
                    ...(item.fixed || {})
                };
            });
        });

        return values;
    };

})();
