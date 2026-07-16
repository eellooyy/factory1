/* factory1_ft_io_constant.js — 1공장 FT 재고 종합 모듈 상수 선언 */
(function () {
    'use strict';

    if (!window.Factory1Ft) {
        console.error('Factory1Ft 객체가 먼저 정의되어야 합니다.');
        return;
    }

    // 기존 FT 글로벌 설정을 상속하거나 재고 종합용 서브 객체 생성
    window.Factory1FtIo = {
        SUPABASE_URL: window.Factory1Ft.SUPABASE_URL,
        SUPABASE_KEY: window.Factory1Ft.SUPABASE_KEY,
        TABLE: 'factory1_ft_io_table', // 추후 확정될 재고 종합 전용 DB 테이블명
        state: {
            currentDate: null,
            isChanged: false
        },
        elements: {
            wrapper: null
        }
    };

})();