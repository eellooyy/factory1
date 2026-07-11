/* factory1_ft_main.js — 1공장 FT 모듈 진입점
   ────────────────────────────────────────────────────────────────
   헤더(제목/삼선메뉴/드롭다운/날짜 네비게이션/수정·저장·엑셀 버튼)는
   factory1_common.js 가 공통으로 소유/제어합니다.

   이 파일은 FT 콘텐츠(#f1PageRoot 안의 .f1ft-wrapper)가 DOM 에
   삽입될 때마다 호출되는 init() 과, 공통 헤더가 호출하는
   activate / setEditMode / save / isChanged 인터페이스만 제공합니다.
   ──────────────────────────────────────────────────────────────── */
(function () {
    'use strict';

    const App = window.Factory1Ft;
    if (!App) return;

    const Factory1FtModule = {
        // 콘텐츠가 DOM 에 삽입된 직후 호출 (최초 로드 시 / 페이지 전환으로 다시 삽입될 때 모두)
        init() {
            App.elements.wrapper = document.querySelector('.f1ft-wrapper');
            if (!App.elements.wrapper) return;

            App.bindInputFormatters();      // render.js
            App.bindKeyboardNavigation();   // render.js
            App.setReadOnlyMode(true);      // render.js — 페이지 진입 시 항상 보기 모드로 시작
        },

        // 공통 헤더가 날짜 변경/페이지 진입 시 호출
        activate(dateStr) {
            return App.loadData(dateStr); // api.js
        },

        // 공통 헤더의 수정 버튼이 호출
        setEditMode(isEdit) {
            App.setReadOnlyMode(!isEdit); // render.js
        },

        // 공통 헤더의 저장 버튼이 호출
        save() {
            return App.saveData(); // api.js
        },

        // 공통 헤더가 날짜 이동/페이지 전환 전 저장 여부 확인 시 호출
        isChanged() {
            return App.state.isChanged;
        }
    };

    window.Factory1FtModule = Factory1FtModule;

})();
