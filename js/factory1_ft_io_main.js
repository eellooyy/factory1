/* factory1_ft_io_main.js — 1공장 FT 재고 종합 모듈 진입점
   ────────────────────────────────────────────────────────────────
   factory1_ft_main.js 와 동일한 패턴으로 CommonHeader.init()을 직접 호출합니다.
   이 페이지는 조회 전용 요약 화면이라 별도 편집 폼은 없고, 저장 버튼만 사용합니다.
   ──────────────────────────────────────────────────────────────── */
(function () {
    'use strict';

    const App = window.Factory1FtIo;
    if (!App) return;

    const Factory1FtIoModule = {
        init: function () {
            App.elements.wrapper = document.querySelector('.f1ftio-wrapper');
            if (!App.elements.wrapper) return;

            App.headerApi = window.CommonHeader.init({
                idPrefix: 'f1FtIo',
                wrapperSelector: '.gf3-wrapper',
                onDateChange: App.loadData,
                onSave: App.saveData,
                onEditModeChange: function (isEdit) {
                    if (App.setReadOnlyMode) App.setReadOnlyMode(!isEdit);
                },
                onExportExcel: function () {
                    alert('재고 종합 페이지의 엑셀 출력 기능은 개발 진행 중입니다.');
                }
            });
            if (!App.headerApi) return;

            App.initUI(); // render.js — 스크롤 동기화 / 클릭 / 키보드 네비 / 우측 카드 네비게이션 바인딩

            App.loadData(App.headerApi.getCurrentDate());
        }
    };

    window.Factory1FtIoModule = Factory1FtIoModule;

    document.addEventListener('DOMContentLoaded', function () {
        Factory1FtIoModule.init();
    });
})();
