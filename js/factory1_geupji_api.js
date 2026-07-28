/* factory1_geupji_api.js — 1공장 급지 재고 DB 연동 (load / save)
   ────────────────────────────────────────────────────────────────
   지금 붙어 있는 것은 '사용량 상세 내역'의 ERP 열 하나뿐입니다.
   조회 중인 날짜의 용지별 사용량을 v_factory1_usage_by_item 에서 읽어
   다섯 종류에 나눠 담습니다. 사람이 입력하는 값이 아니므로 수정 모드에서도
   잠긴 채로 있습니다. (factory1_geupji_render.js 의 setReadOnlyMode 참고)

   일지 본체(호기별 잔량 · 출고롤)는 아직 테이블이 없어 그대로 비어 있습니다.
   ──────────────────────────────────────────────────────────────── */
(function () {
    'use strict';

    const App = window.Factory1GeupjiInv;
    if (!App) return;

    const supabase = window.supabase.createClient(App.SUPABASE_URL, App.SUPABASE_KEY);

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

        // TODO: 일지 본체 테이블이 확정되면 여기서 호기별 잔량 · 출고롤을 읽어옵니다.
        // const { data: todayData } = await supabase.from(App.TABLE).select('*').eq('log_date', dateStr).single();
        // const { data: nextData } = await supabase.from(App.TABLE).select('*').eq('log_date', App.utils.addDays(dateStr, 1)).single();
        // 위에서 읽은 today/next 데이터를 각 셀에 채우고, nextDayInventory 를 계산해 App.state.nextDayInventory 에 저장

        /* 날짜를 빠르게 넘기면 응답이 순서를 바꿔 도착할 수 있습니다.
           돌아온 뒤 화면의 날짜가 그대로일 때만 반영합니다. */
        const erp = await fetchErpUsage(dateStr);
        if (App.state.currentDate === dateStr) {
            App.applyErpUsage(erp);
        }

        App.calculateFields();
        if (editBtn) editBtn.disabled = false;
        App.state.isChanged = false;
    };

    // ── 데이터 저장하기 ───────────────────────────────────────────────────────
    App.saveData = async function () {
        const saveBtn = App.elements.saveBtn;
        if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '저장 중...'; }

        // 화면 데이터를 DB 스키마 형태로 수집 (추후 Supabase upsert 시 그대로 사용 가능)
        const payload = App.collectPayload();

        // TODO: Supabase 연결 후 아래 부분에서 실제 저장 처리
        // const { error } = await supabase.from(App.TABLE).upsert(payload, { onConflict: 'log_date' });
        // if (error) { alert('저장에 실패했습니다: ' + error.message); ... return; }

        console.log('[factory1_geupji] 저장 페이로드 (DB 미연결 상태 — 콘솔 출력만 수행)', payload);

        if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '저장'; }

        alert('DB 연결 전 테스트 상태입니다.\n입력한 데이터는 저장되지 않으며, 콘솔에만 출력됩니다.');
        App.state.isChanged = false;

        // 편집 모드 종료
        if (App.headerApi && App.headerApi.toggleEditMode) App.headerApi.toggleEditMode();
    };

})();
