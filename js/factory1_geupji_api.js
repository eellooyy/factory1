/* factory1_geupji_api.js — 1공장 급지 재고 DB 연동 (load / save)
   ────────────────────────────────────────────────────────────────
   읽는 곳이 넷입니다.

     v_factory1_geupji_paper    용지 마스터 — 드롭다운 · 라벨 · 롤중량 · ERP 매핑
                                (페이지가 뜰 때 한 번)
     factory1_geupji_real       좌측 호기 표 — 이 페이지가 입력하는 유일한 대상
     v_factory1_geupji_stock    다음날 재고 — 실사용량 계산용
     v_factory1_usage_by_item   ERP 사용량 — 오차 대조용

   쓰는 곳은 factory1_geupji_real 하나뿐입니다. 우측 재고 · 실사용량 · 오차는
   전부 파생값이라 저장하지 않습니다. 저장하면 좌측을 고쳤을 때 갈라집니다.

   출고 롤은 아직 출처가 미정입니다. 다른 페이지에서 불러올 가능성이 있어
   테이블에 컬럼을 만들지 않았고, 지금은 화면에서만 쓰입니다.
   ──────────────────────────────────────────────────────────────── */
(function () {
    'use strict';

    const App = window.Factory1GeupjiInv;
    if (!App) return;

    const supabase = window.supabase.createClient(App.SUPABASE_URL, App.SUPABASE_KEY);

    /* ── 용지 마스터 ──────────────────────────────────────────────────────────
       페이지가 뜰 때 한 번 읽어 App.TYPE_KEYS / TYPE_LABELS / ROLL_KG /
       ERP_ITEM_CODES 를 채우고 드롭다운을 만듭니다. 용지가 늘거나 롤당 중량이
       바뀌어도 이 페이지는 고칠 것이 없습니다.
       ──────────────────────────────────────────────────────────────────────── */
    App.loadPaperMaster = async function () {
        const { data, error } = await supabase
            .from(App.PAPER_VIEW)
            .select('geupji_key, label, roll_kg, erp_codes')
            .order('sort_order');

        if (error) {
            console.error('[factory1_geupji] 용지 마스터 조회 실패:', error.message);
            return false;
        }
        if (!data || !data.length) {
            console.error(`[factory1_geupji] 용지 마스터(${App.PAPER_VIEW})가 비어 있습니다.`
                + ' 행이 없거나 RLS 정책이 없어 익명 키로 읽히지 않는 상태입니다.');
            return false;
        }

        App.TYPE_KEYS = data.map(r => r.geupji_key);
        App.TYPE_LABELS = {};
        App.ROLL_KG = {};
        App.ERP_ITEM_CODES = {};

        data.forEach(r => {
            App.TYPE_LABELS[r.geupji_key] = r.label;
            App.ROLL_KG[r.geupji_key] = Number(r.roll_kg) || 0;
            App.ERP_ITEM_CODES[r.geupji_key] = r.erp_codes || [];
        });

        App.buildPaperOptions();
        return true;
    };

    /* ── 좌측 호기 표 ─────────────────────────────────────────────────────────
       그 날짜의 급지대 행만 읽습니다. 숫자가 없는 급지대는 애초에 행이 없으므로
       하루 최대 21행, 보통 15행 안팎입니다.
       ──────────────────────────────────────────────────────────────────────── */
    async function fetchGeupjiRows(dateStr) {
        const { data, error } = await supabase
            .from(App.TABLE)
            .select('machine, stand, paper_pre, pre_kg, paper_roll, roll_qty')
            .eq('log_date', dateStr);

        if (error) {
            console.error('[factory1_geupji] 급지 일지 조회 실패:', error.message);
            return null;
        }
        return data || [];
    }

    /* ── 재고 뷰 ──────────────────────────────────────────────────────────────
       { 용지키: kg }. 실사용량에 쓰는 '다음날 재고'를 읽는 데만 씁니다.
       오늘 재고는 화면에서 직접 계산합니다 — 편집 중에는 아직 저장 전이라
       뷰가 모르는 값이고, 숫자를 고칠 때마다 바로 따라 움직여야 하기 때문입니다.
       ──────────────────────────────────────────────────────────────────────── */
    async function fetchStock(dateStr) {
        const { data, error } = await supabase
            .from(App.STOCK_VIEW)
            .select('geupji_key, stock_kg')
            .eq('log_date', dateStr);

        if (error) {
            console.error('[factory1_geupji] 재고 조회 실패:', error.message);
            return null;
        }

        const byType = {};
        (data || []).forEach(r => { byType[r.geupji_key] = Number(r.stock_kg) || 0; });
        return byType;
    }

    /* ── ERP 사용량 조회 ──────────────────────────────────────────────────────
       뷰가 이미 (날짜 × 품목)으로 합산해 주므로 그날 행만 받아 품목코드로 묶습니다.

       반환값은 { 용지키: kg } 이고, 조회 결과에 아예 없는 용지는 키를 넣지
       않습니다. "그날 안 썼다(0)"와 "아직 실적이 안 넘어왔다"는 다른 이야기이고,
       후자를 0 으로 두면 오차 열이 실사용량을 통째로 오차로 표시해 버립니다.
       ──────────────────────────────────────────────────────────────────────── */
    async function fetchErpUsage(dateStr) {
        const { data, error } = await supabase
            .from(App.USAGE_VIEW)
            .select('item_code, usage_qty')
            .eq('print_date', dateStr);

        if (error) {
            console.error('[factory1_geupji] ERP 사용량 조회 실패:', error.message);
            return null;
        }

        // 품목코드 → kg
        const byCode = {};
        (data || []).forEach(r => {
            byCode[r.item_code] = (byCode[r.item_code] || 0) + (Number(r.usage_qty) || 0);
        });

        // 품목코드 → 이 페이지의 용지 다섯 종류 (전주는 본지 + 전자를 합칩니다)
        const byType = {};
        App.TYPE_KEYS.forEach(key => {
            const codes = App.ERP_ITEM_CODES[key] || [];
            const found = codes.filter(c => Object.prototype.hasOwnProperty.call(byCode, c));
            if (!found.length) return;
            byType[key] = found.reduce((sum, c) => sum + byCode[c], 0);
        });

        return byType;
    }

    // ── 데이터 불러오기 ───────────────────────────────────────────────────────
    App.loadData = async function (dateStr) {
        // 조회 중인 날짜를 모듈 state에도 동기화 (날짜는 CommonHeader가 소유)
        App.state.currentDate = dateStr;

        // 편집 모드 해제
        if (App.headerApi && App.headerApi.isEditMode && App.headerApi.isEditMode()) {
            App.headerApi.toggleEditMode();
        }

        const editBtn = App.elements.editBtn;
        if (editBtn) editBtn.disabled = true;

        // 화면을 우선 기본값으로 초기화
        App.resetToDefaults();

        // 서로 무관한 조회 넷이라 한꺼번에 보냅니다
        const [rows, erp, nextStock] = await Promise.all([
            fetchGeupjiRows(dateStr),
            fetchErpUsage(dateStr),
            fetchStock(App.utils.addDays(dateStr, 1))
        ]);

        /* 날짜를 빠르게 넘기면 응답이 순서를 바꿔 도착할 수 있습니다.
           돌아온 뒤 화면의 날짜가 그대로일 때만 반영합니다. */
        if (App.state.currentDate !== dateStr) return;

        App.applyGeupjiRows(rows);
        App.applyErpUsage(erp);
        App.state.nextDayInventory = nextStock || {};

        App.calculateFields();
        if (editBtn) editBtn.disabled = false;
        App.state.isChanged = false;
    };

    /* ── 저장 ─────────────────────────────────────────────────────────────────
       upserts : 숫자가 하나라도 있는 급지대 → (log_date, machine, stand) 충돌 시 UPDATE
       deletes : 원래 행이 있었는데 숫자를 다 지운 급지대 → 행 자체를 삭제

       마지막 삭제가 중요합니다. UPDATE 로 null 만 채우면 CHECK 제약(숫자가 하나도
       없는 행은 만들지 않는다)에 걸리고, 걸리지 않더라도 "안 쓴 급지대"가 빈 행으로
       남아 뷰의 집계 대상에 계속 들어옵니다.

       삭제는 호기별로 묶어 최대 3번입니다. 보통 0~1번입니다.
       ──────────────────────────────────────────────────────────────────────── */
    App.saveData = async function () {
        const saveBtn = App.elements.saveBtn;
        const logDate = (App.headerApi && App.headerApi.getCurrentDate()) || App.state.currentDate;
        if (!logDate) return;

        const { upserts, deletes, keep } = App.collectRows(logDate);

        // 저장할 것도 지울 것도 없는 경우 — 조용히 빠져나가면 눌린 건지 아닌지 알 수 없습니다
        if (!upserts.length && !deletes.length) {
            alert('저장할 내용이 없습니다.');
            if (App.headerApi && App.headerApi.toggleEditMode) App.headerApi.toggleEditMode();
            return true;
        }

        if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '저장 중...'; }

        const fail = (msg, err) => {
            console.error(`[factory1_geupji] ${msg}:`, err.message);
            alert(`${msg}: ${err.message}`);
            if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '저장'; }
            return false;
        };

        if (upserts.length) {
            const { error } = await supabase
                .from(App.TABLE)
                .upsert(upserts, { onConflict: 'log_date,machine,stand' });
            if (error) return fail('저장에 실패했습니다', error);
        }

        // 호기별로 묶어 지웁니다 (급지대 하나씩 지우면 요청이 최대 21번이 됩니다)
        const byMachine = {};
        deletes.forEach(d => {
            if (!byMachine[d.machine]) byMachine[d.machine] = [];
            byMachine[d.machine].push(d.stand);
        });

        for (const machine of Object.keys(byMachine)) {
            const { error } = await supabase
                .from(App.TABLE)
                .delete()
                .eq('log_date', logDate)
                .eq('machine', machine)
                .in('stand', byMachine[machine]);
            if (error) return fail('빈 급지대 처리에 실패했습니다', error);
        }

        // 저장된 상태가 곧 다음 저장의 기준이 됩니다
        App.state.loaded = keep;
        App.state.isChanged = false;

        if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '저장'; }

        /* 다음날 재고는 그대로지만 오늘 재고가 바뀌었으므로 다시 그립니다.
           (오늘 재고는 화면 계산이라 이미 최신입니다 — 여기서는 확인 차원) */
        App.calculateFields();

        // 편집 모드 종료
        if (App.headerApi && App.headerApi.toggleEditMode) App.headerApi.toggleEditMode();

        /* 저장이 끝났다는 것을 반드시 알립니다. 아무 반응이 없으면 눌리지 않은 건지
           실패한 건지 알 수가 없습니다. (FT · 입고 페이지도 같은 방식입니다)

           건수는 '바뀐 칸'이 아니라 '저장된 급지대'입니다. 이 페이지는 하루 최대
           21행이라 변경분만 가리지 않고 값이 있는 급지대를 통째로 다시 씁니다. */
        const parts = [`급지대 ${upserts.length}칸`];
        if (deletes.length) parts.push(`${deletes.length}칸 비움`);
        alert(`저장되었습니다. (${parts.join(', ')})`);

        return true;
    };

})();
