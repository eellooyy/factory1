/* factory1_ft_main.js — 1공장 FT 모듈 진입점
   ────────────────────────────────────────────────────────────────
   기존에는 factory1_common.js(SPA 라우터)가 헤더를 소유하고
   activate/setEditMode/save/isChanged 인터페이스로 이 모듈을 불렀습니다.

   이제는 이 페이지가 독립된(MPA) 페이지이므로, 3공장의 각 페이지들과
   똑같이 이 모듈이 CommonHeader.init()을 직접 호출해서 헤더(날짜 네비게이션/
   마스터 비밀번호 인증/수정·저장 버튼/공지 티커)를 연결합니다.
   ──────────────────────────────────────────────────────────────── */
(function () {
    'use strict';

    const App = window.Factory1Ft;
    if (!App) return;

    const Factory1FtModule = {
        init: function () {
            App.elements.wrapper = document.querySelector('.f1ft-wrapper');
            if (!App.elements.wrapper) return;

            App.headerApi = window.CommonHeader.init({
                idPrefix: 'f1Ft',
                wrapperSelector: '.gf3-wrapper',
                onDateChange: App.loadData,
                onSave: App.saveData,
                onEditModeChange: function (isEdit) {
                    App.setReadOnlyMode(!isEdit);
                },
                onExportExcel: function () {
                    alert('엑셀 출력 기능은 하단 레이아웃과 DB 연결을 정리한 뒤 활성화할 예정입니다.');
                }
            });
            if (!App.headerApi) return;

            App.bindInputFormatters();
            App.bindKeyboardNavigation();
            App.setReadOnlyMode(true); // 페이지 진입 시 항상 보기 모드로 시작

            App.loadData(App.headerApi.getCurrentDate());
        }
    };

    window.Factory1FtModule = Factory1FtModule;

    document.addEventListener('DOMContentLoaded', function () {
        Factory1FtModule.init();
    });
})();
