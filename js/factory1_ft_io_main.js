/* factory1_ft_io_main.js — 1공장 FT 재고 종합 모듈 진입점 */
(function () {
    'use strict';

    const App = window.Factory1FtIo;
    if (!App) return;

    const Factory1FtIoModule = {
        // 콘텐츠 조각(Fragment)이 DOM에 삽입된 후 자동 호출
        init() {
            App.elements.wrapper = document.querySelector('.f1ftio-wrapper');
            if (!App.elements.wrapper) return;

            App.setReadOnlyMode(true); // 기본 보기모드 설정
            App.initUI();              // 스크롤 동기화 / 클릭 / 키보드 / 우측 네비게이션 바인딩

            // 우측 두 카드(입고 현황·월별 출고 현황)는 공통 헤더의 날짜와 무관하게
            // 자체 연/월 상태를 가지므로 최초 진입 시 바로 로드합니다.
            App.loadInbound();
            App.loadUsageDaily();
        },

        // 공통 라우터에서 날짜 변경(날짜 네비게이션/오늘 버튼/달력 선택) 시 자동 호출
        // 좌측 4단 대조표를 해당 날짜 기준으로 다시 로드합니다.
        activate(dateStr) {
            return App.loadData(dateStr);
        },

        // 공통 수정 버튼 제어 연동 (이 페이지는 편집 폼이 없어 실질적으로 no-op)
        setEditMode(isEdit) {
            App.setReadOnlyMode(!isEdit);
        },

        // 공통 저장 버튼 제어 연동
        save() {
            return App.saveData();
        },

        // 이탈 전 상태 검증 연동
        isChanged() {
            return App.state.isChanged;
        }
    };

    window.Factory1FtIoModule = Factory1FtIoModule;

})();