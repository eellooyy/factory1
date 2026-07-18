/* factory1_ft_io_main.js — 1공장 FT 재고 종합 모듈 진입점 */
(function () {
    'use strict';

    const App = window.Factory1FtIo;
    if (!App) return;

    const Factory1FtIoModule = {
        // 콘텐츠 조각(Fragment)이 DOM에 삽입된 후 자동 호출
        init() {
            // 클래스명 일치 시킴 (f1ft-io-wrapper -> f1ftio-wrapper)
            App.elements.wrapper = document.querySelector('.f1ftio-wrapper');
            if (!App.elements.wrapper) return;

            App.setReadOnlyMode(true); // 기본 보기모드 설정

            // 렌더러(render.js)에 구현된 이벤트 및 스크롤 동기화 초기화 함수 실행
            if (typeof App.initUI === 'function') {
                App.initUI();
            }
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