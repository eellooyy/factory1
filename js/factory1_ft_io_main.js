/* factory1_ft_io_main.js — 1공장 FT 재고 종합 모듈 진입점 */
(function () {
    'use strict';

    const App = window.Factory1FtIo;
    if (!App) return;

    const Factory1FtIoModule = {
        // 콘텐츠 조각(Fragment)이 DOM에 삽입된 후 자동 호출
        init() {
            App.elements.wrapper = document.querySelector('.f1ft-io-wrapper');
            if (!App.elements.wrapper) return;

            App.setReadOnlyMode(true); // 기본 보기모드 설정
        },

        // 공통 라우터에서 날짜 변경 / 페이지 메뉴 선택 시 자동 호출
        activate(dateStr) {
            return App.loadData(dateStr);
        },

        // 공통 수정 버튼 제어 연동
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