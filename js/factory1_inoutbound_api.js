/* factory1_inoutbound_api.js — 1공장 입출고 내역 DB 연동 (조회 전용)
   ────────────────────────────────────────────────────────────────
   원본 3테이블을 그대로 읽습니다. 쓰는 곳은 없습니다.

     factory1_inbound_b5    입고 B5
     factory1_inbound_b6    입고 B6
     factory1_outbound_b6   출고 B6

   **바코드 해석 규칙은 여기에 없습니다.** `js/factory1_barcode.js` 가
   유일한 출처이고, 급지 재고 페이지의 '전산 출고' 열도 같은 파일을 씁니다.
   규칙을 두 벌 두면 두 화면의 숫자가 조용히 갈라집니다.
   ──────────────────────────────────────────────────────────────── */
(function () {
    'use strict';

    const App = window.Factory1Inoutbound;
    if (!App) return;

    const Barcode = window.Factory1Barcode;
    if (!Barcode) {
        console.error('[factory1_inoutbound] factory1_barcode.js 가 먼저 로드되어야 합니다.');
        return;
    }

    const supabase = window.supabase.createClient(App.SUPABASE_URL, App.SUPABASE_KEY);

    /* ── 하루치 조회 ──────────────────────────────────────────────
       입고 두 테이블과 출고 한 테이블을 한 번에 받습니다. 방향 스위처가
       다시 조회하지 않아도 되도록, 화면에 띄우지 않는 쪽까지 같이 채웁니다.
       한 방향이 실패해도 나머지는 그립니다.
       ──────────────────────────────────────────────────────────── */
    /* 급지 재고 페이지에서 손댄 전산 출고 — **표시용입니다.**
       이 화면의 숫자는 스캔 그대로 두고, "저기서 N롤로 고쳤다"는 사실과 메모만
       요약에 덧붙입니다. (이유는 constant.js 의 GEUPJI_ISSUE_TABLE 주석)

       조회에 실패해도 화면은 그려야 하므로 빈 값으로 넘어갑니다 — 없어도
       스캔 기록 자체를 읽는 데는 지장이 없습니다. */
    async function fetchGeupjiManual(dateStr) {
        const { data, error } = await supabase
            .from(App.GEUPJI_ISSUE_TABLE)
            .select('geupji_key, sys_issue_roll, sys_memo')
            .eq('log_date', dateStr);

        if (error) {
            console.warn('[factory1_inoutbound] 급지 수기 수정 조회 실패:', error.message);
            return {};
        }

        const byItem = {};
        (data || []).forEach(r => {
            const itemKey = Barcode.ITEM_OF_GEUPJI[r.geupji_key];
            if (!itemKey) return;

            const roll = (r.sys_issue_roll === null || r.sys_issue_roll === undefined)
                ? null : Number(r.sys_issue_roll);
            if (roll === null && !r.sys_memo) return;   // 실제 출고만 손댄 행

            byItem[itemKey] = { roll: roll, memo: r.sys_memo || null };
        });
        return byItem;
    }

    App.fetchDay = async function (dateStr) {
        const jobs = App.DIRECTIONS.map(async dir => ({
            dir: dir.key,
            rows: await Barcode.fetchRows(supabase, dir.tables, dateStr)
        }));

        const [done, sysManual] = await Promise.all([
            Promise.all(jobs),
            fetchGeupjiManual(dateStr)
        ]);

        const out = { in: [], out: [], failed: [], sysManual: sysManual };
        done.forEach(r => {
            if (r.rows === null) { out.failed.push(r.dir); return; }
            out[r.dir] = r.rows;
        });

        return out;
    };

})();
