/* factory1_ilji_api.js — 1공장 일지 DB 연동 자리 (load / save)
   ────────────────────────────────────────────────────────────────
   ★ 지금은 DB 연결을 비워둔 상태입니다.
     추후 Supabase 연결 시 아래 TODO 부분에
     factory1_ft_api.js 와 동일한 패턴으로 채워 넣으면 됩니다.
   ──────────────────────────────────────────────────────────────── */
(function () {
    'use strict';

    const App = window.Factory1Ilji;
    if (!App) return;

    // TODO: Supabase 클라이언트 초기화
    // const supabase = window.supabase.createClient(App.SUPABASE_URL, App.SUPABASE_KEY);

    // ── 데이터 불러오기 ───────────────────────────────────────────────────────
    App.loadData = async function (dateStr) {
        // 편집 모드 해제
        if (App.headerApi && App.headerApi.isEditMode && App.headerApi.isEditMode()) {
            App.headerApi.toggleEditMode();
        }

        const editBtn = App.elements.editBtn;
        if (editBtn) editBtn.disabled = true;

        // 화면을 우선 기본값으로 초기화
        App.resetToDefaults();

        // TODO: Supabase 연결 후 아래 부분에서 실제 데이터를 읽어와 채워 넣기
        // const { data: todayData } = await supabase.from(App.TABLE).select('*').eq('log_date', dateStr).single();
        // const { data: nextData } = await supabase.from(App.TABLE).select('*').eq('log_date', App.utils.addDays(dateStr, 1)).single();
        // 위에서 읽은 today/next 데이터를 각 셀에 채우고, nextDayInventory 를 계산해 App.state.nextDayInventory 에 저장

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

        console.log('[factory1_ilji] 저장 페이로드 (DB 미연결 상태 — 콘솔 출력만 수행)', payload);

        if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '저장'; }

        alert('DB 연결 전 테스트 상태입니다.\n입력한 데이터는 저장되지 않으며, 콘솔에만 출력됩니다.');
        App.state.isChanged = false;

        // 편집 모드 종료
        if (App.headerApi && App.headerApi.toggleEditMode) App.headerApi.toggleEditMode();
    };

})();
