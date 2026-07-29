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
       입고 · 사용량

       둘 다 '그날 움직인 양'이라 이월하면 안 됩니다. 어제 들어온 양이 오늘도
       들어온 것이 되어 버립니다. (잔고인 ERP 재고와 정반대)

       빈 칸의 뜻이 두 가지입니다.
         그날 원본에 행이 하나라도 있다 → 안 잡힌 품목은 움직임 없음 = 0
         그날 원본이 통째로 비어 있다   → 아직 자료가 없다 = '–'
       0 으로 채우면 '입고가 없었다'로 읽히지만 사실은 '모른다'입니다.
       급지 재고의 '전산 출고' 열이 쓰는 규칙과 같습니다.
       ──────────────────────────────────────────────────────────── */

    /* 입고 페이지(v_factory1_ipgo)의 item_code 는 용지 마스터 코드(daehan_a 등)라
       화면의 ERP 품목코드로 옮겨야 합니다. 마스터는 12행이고 바뀔 일이 드물어
       페이지가 뜰 때 한 번만 읽습니다. 여기에 하드코딩하면 마스터에 용지가
       늘어도 화면이 따라오지 않습니다. */
    let masterPromise = null;
    function loadItemMaster() {
        if (masterPromise) return masterPromise;
        masterPromise = supabase
            .from(App.TABLES.PAPER_ITEM)
            .select('item_code, erp_code, warehouse_code')
            .then(({ data, error }) => {
                if (error) {
                    console.error('[factory1_inventory_io] 용지 마스터 조회 실패:', error.message);
                    return {};
                }
                const map = {};
                (data || []).forEach(r => {
                    map[r.item_code] = valueKey(r.warehouse_code, r.erp_code);
                });
                return map;
            });
        return masterPromise;
    }

    // 1공장 입고 — 입고 페이지에서 사람이 적는 값
    async function fetchInbound(dateStr) {
        const [master, res] = await Promise.all([
            loadItemMaster(),
            supabase.from(App.TABLES.IPGO)
                .select('item_code, inbound_qty')
                .eq('ipgo_date', dateStr)
        ]);

        if (res.error) {
            console.error('[factory1_inventory_io] 입고 조회 실패:', res.error.message);
            return null;
        }

        const byKey = {};
        (res.data || []).forEach(r => {
            const key = master[r.item_code];
            if (!key) return;
            byKey[key] = (byKey[key] || 0) + (Number(r.inbound_qty) || 0);
        });
        return { byKey, hasData: (res.data || []).length > 0 };
    }

    /* 1공장 사용량 — 급지 실적. item_code 가 이미 ERP 품목코드라 그대로 씁니다.
       저장위치는 뷰에 없지만 1공장 품목은 창고가 하나뿐이라 품목코드로 충분합니다.
       (별관도 같은 품목코드를 쓰지만 그쪽은 3공장 뷰에서 따로 읽습니다) */
    async function fetchUsage(dateStr) {
        const { data, error } = await supabase
            .from(App.TABLES.USAGE)
            .select('item_code, usage_qty')
            .eq('print_date', dateStr);

        if (error) {
            console.error('[factory1_inventory_io] 사용량 조회 실패:', error.message);
            return null;
        }

        const byCode = {};
        (data || []).forEach(r => {
            byCode[r.item_code] = (byCode[r.item_code] || 0) + (Number(r.usage_qty) || 0);
        });
        return { byCode, hasData: (data || []).length > 0 };
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

    /* ────────────────────────────────────────────────────────────
       ERP 재고

       ERP 원장을 그대로 옮긴 값이 아니라 '앵커 재고 + 입고 − 사용량' 누적입니다.
       결재가 밀리면 며칠 전 자료도 안 들어와 원장을 그대로 쓸 수 없기 때문입니다.
       그래서 출처가 저장위치마다 다르고, 1공장 용지창고는 아직 없습니다.
       ──────────────────────────────────────────────────────────── */

    /* F.T — 뷰가 입고나 출고가 있었던 날만 행을 냅니다(토요일 등이 빕니다).
       재고는 상태값이라 움직이지 않은 날도 잔고는 존재하므로, 기준일 이하의
       마지막 행을 가져와 이월합니다. FT 재고 종합 화면이 하는 것과 같습니다. */
    async function fetchFtErp(dateStr) {
        const grades = ['A', 'C', 'D'];
        const results = await Promise.all(grades.map(g =>
            supabase.from(App.TABLES.FT_ERP)
                .select('erp_stock')
                .eq('item', g)
                .lte('date', dateStr)
                .order('date', { ascending: false })
                .limit(1)
        ));

        const byGrade = {};
        results.forEach((res, i) => {
            if (res.error) {
                console.error('[factory1_inventory_io] FT ERP 재고 조회 실패:', res.error.message);
                return;
            }
            const row = (res.data || [])[0];
            if (row) byGrade[grades[i]] = numOrNull(row.erp_stock);
        });
        return byGrade;
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

    /* 화면이 쓰는 값 묶음을 만듭니다.
       constant.js 의 fixed 는 DB가 아니라 파일에 박아 둔 상수라 뷰 값보다
       우선합니다(나투라 440). 뷰에 같은 칸이 생기면 그때 fixed 를 지우면 됩니다. */
    App.fetchAll = async function (dateStr) {
        const [actual, inbound, usage, f3in, f3use, ftErp, f3Erp] = await Promise.all([
            fetchActualStock(dateStr),
            fetchInbound(dateStr),
            fetchUsage(dateStr),
            fetchAnnexInbound(dateStr),
            fetchAnnexUsage(dateStr),
            fetchFtErp(dateStr),
            fetchAnnexErp(dateStr)
        ]);
        const values = {};

        App.LOCATIONS.forEach(loc => {
            const inSrc = loc.factory3 ? f3in : inbound;
            const useSrc = loc.factory3 ? f3use : usage;

            loc.items.forEach(item => {
                const key = valueKey(loc.locCode, item.code);
                const row = (actual && actual[key]) || {};

                let inQty = null;
                if (inSrc && inSrc.hasData) {
                    inQty = loc.factory3
                        ? (inSrc.byGrade[item.f3Grade] || 0)
                        : (inSrc.byKey[key] || 0);
                }

                let useQty = null;
                if (useSrc && useSrc.hasData) {
                    useQty = useSrc.byCode[item.code] || 0;
                }

                /* 1공장 용지창고는 누적 뷰가 없어 null 입니다. 이때 '실재고 -
                   ERP재고' 열도 render 가 자동으로 '–' 로 둡니다. */
                let erp = null;
                if (loc.ftErp && item.ftGrade) erp = ftErp[item.ftGrade];
                else if (loc.factory3 && item.f3Grade) erp = f3Erp[item.f3Grade];
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
