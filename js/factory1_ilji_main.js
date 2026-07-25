/* factory1_ilji_main.js — 1공장 급지 일지 모듈 진입점
   ────────────────────────────────────────────────────────────────
   factory1_ft_main.js 와 동일한 패턴으로 CommonHeader.init()을 직접 호출합니다.
   ──────────────────────────────────────────────────────────────── */
(function () {
    'use strict';

    const App = window.Factory1Ilji;
    if (!App) return;

    const Factory1IljiModule = {
        init: function () {
            App.elements.wrapper = document.querySelector('.f1il-wrapper');
            if (!App.elements.wrapper) return;

            App.headerApi = window.CommonHeader.init({
                idPrefix: 'f1Ilji',
                wrapperSelector: '.gf3-wrapper',
                onDateChange: App.loadData,
                onSave: App.saveData,
                onEditModeChange: function (isEdit) {
                    App.setReadOnlyMode(!isEdit);
                },
                onExportExcel: function () {
                    alert('엑셀 출력 기능은 DB 연결을 정리한 뒤 활성화할 예정입니다.');
                }
            });
            if (!App.headerApi) return;

            App.bindInputFormatters();
            App.bindKeyboardNavigation();
            App.setReadOnlyMode(true); // 페이지 진입 시 항상 보기 모드로 시작

            App.loadData(App.headerApi.getCurrentDate());
        }
    };

    window.Factory1IljiModule = Factory1IljiModule;

    document.addEventListener('DOMContentLoaded', function () {
        Factory1IljiModule.init();
    });
})();
