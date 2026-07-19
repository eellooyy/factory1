/* factory1_ft_io_main.js — 1공장 FT 재고 종합 모듈 진입점
   ────────────────────────────────────────────────────────────────
   헤더(제목/삼선메뉴/드롭다운/날짜 네비게이션/수정·저장·엑셀 버튼)는
   factory1_common.js 가 공통으로 소유/제어합니다.

   ⚠ 이 파일이 기존에 누락되어 있어서 factory1_common.js 가
     window.Factory1FtIoModule 을 찾지 못해 init()/activate() 가
     전혀 호출되지 않았고, 그 결과 좌측 4단 대조표 및 우측 카드가
     "불러오는 중..." 상태에서 멈춰 있었습니다. (로딩 안 되던 원인)

   이 파일은 FT 재고 종합 콘텐츠(#f1PageRoot 안의 .f1ftio-wrapper)가
   DOM 에 삽입될 때마다 호출되는 init() 과, 공통 헤더가 호출하는
   activate / setEditMode / save / isChanged 인터페이스만 제공합니다.
   (factory1_ft_main.js 와 동일한 패턴)
   ──────────────────────────────────────────────────────────────── */
(function () {
    'use strict';

    const App = window.Factory1FtIo;
    if (!App) return;

    const Factory1FtIoModule = {
        // 콘텐츠가 DOM 에 삽입된 직후 호출 (최초 로드 시 / 페이지 전환으로 다시 삽입될 때 모두)
        init() {
            App.elements.wrapper = document.querySelector('.f1ftio-wrapper');
            if (!App.elements.wrapper) return;

            App.initUI(); // render.js — 스크롤 동기화 / 클릭 / 키보드 네비 / 우측 카드 네비게이션 바인딩
        },

        // 공통 헤더가 날짜 변경/페이지 진입 시 호출
        activate(dateStr) {
            return App.loadData(dateStr); // api.js
        },

        // 이 페이지는 편집 폼이 없는 조회 전용 요약 화면이라 별도 편집 모드가 없습니다.
        setEditMode(isEdit) {
            App.setReadOnlyMode(!isEdit); // render.js (현재는 no-op)
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

    window.Factory1FtIoModule = Factory1FtIoModule;

})();