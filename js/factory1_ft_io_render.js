/* factory1_ft_io_render.js — 1공장 FT 재고 종합 UI 렌더링 및 제어 */
(function () {
    'use strict';

    const App = window.Factory1FtIo;
    if (!App) return;

    // 보기 모드 / 편집 모드 UI 잠금 처리 제어
    App.setReadOnlyMode = function (isReadOnly) {
        const wrapper = App.elements.wrapper;
        if (!wrapper) return;
        
        // 향후 종합 대장에 입력 폼이 생길 경우 제어 처리 로직 확장 공간
    };

})();