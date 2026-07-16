/* factory1_ft_io_api.js — 1공장 FT 재고 종합 Supabase 데이터 연동 */
(function () {
    'use strict';

    const App = window.Factory1FtIo;
    if (!App) return;

    // 데이터 불러오기 훅
    App.loadData = async function (dateStr) {
        if (App.headerApi && App.headerApi.isEditMode && App.headerApi.isEditMode()) {
            App.headerApi.toggleEditMode();
        }
        
        console.log('재고 종합 데이터 조회 기준일:', dateStr);
        // 향후 구상 내역에 맞춰 Supabase Fetch API 구현부 배치 공간
        
        App.state.isChanged = false;
    };

    // 데이터 저장하기 훅
    App.saveData = async function () {
        App.state.isChanged = false;
        if (App.headerApi && App.headerApi.toggleEditMode) App.headerApi.toggleEditMode();
    };

})();