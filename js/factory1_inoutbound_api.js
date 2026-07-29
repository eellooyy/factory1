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

    /* ── DB 최신 시각 ─────────────────────────────────────────────
       백업 스크립트(C:\AutoRun\factory1_io_supabase_backup.pyw)가 **언제
       돌았는지는 어디에도 기록되지 않습니다.** 원본 테이블에는 스캔 시각
       (created_at) 하나뿐이고 적재 시각 컬럼이 없습니다.

       그래서 대신 **DB 에 들어와 있는 가장 최근 스캔 시각**을 봅니다.
       오늘 것이 보이면 백업이 살아 있다는 뜻이고, 며칠 전에서 멈춰 있으면
       공정 PC 나 백업 중 하나가 멈춘 것입니다. "언제 백업했나"는 아니지만
       "데이터가 어디까지 와 있나"는 정확히 알려 줍니다.

       조회 기준일과 무관합니다 — 과거 날짜를 보고 있어도 값은 그대로여야
       합니다. 백업이 살아 있는지는 보고 있는 날짜와 상관없는 사실입니다.

       ※ 실제 백업 실행 시각까지 보려면 백업 스크립트가 실행 결과를 남길
         로그 테이블(factory1_sync_log 같은)이 하나 필요합니다.
       ──────────────────────────────────────────────────────────── */
    App.fetchLastUpdate = async function () {
        const names = [];
        App.DIRECTIONS.forEach(d => d.tables.forEach(t => names.push(t.name)));

        const done = await Promise.all(names.map(async name => {
            const { data, error } = await supabase
                .from(name)
                .select('created_at')
                .order('created_at', { ascending: false })
                .limit(1);

            if (error) {
                console.warn(`[factory1_inoutbound] ${name} 최신 시각 조회 실패:`, error.message);
                return null;
            }
            return (data && data[0]) ? String(data[0].created_at) : null;
        }));

        /* 저장된 값이 한국시간 벽시계 문자열이라 그대로 비교합니다.
           Date 로 바꾸면 야간 스캔이 하루씩 밀립니다 (constant.js 참고). */
        const stamps = done.filter(Boolean).sort();
        return stamps.length ? stamps[stamps.length - 1] : null;
    };

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
