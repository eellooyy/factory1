/* factory1_ft_io_constant.js — 1공장 FT 재고 종합 모듈 상수 선언 */
(function () {
    'use strict';

    if (!window.Factory1Ft) {
        console.error('Factory1Ft 객체가 먼저 정의되어야 합니다.');
        return;
    }

    const today = new Date();

    // 기존 FT 글로벌 설정을 상속하거나 재고 종합용 서브 객체 생성
    window.Factory1FtIo = {
        SUPABASE_URL: window.Factory1Ft.SUPABASE_URL,
        SUPABASE_KEY: window.Factory1Ft.SUPABASE_KEY,
        TABLE: 'factory1_ft_io_table', // 추후 확정될 재고 종합 전용 DB 테이블명

        WD_KR: ['일', '월', '화', '수', '목', '금', '토'],
        PANEL_IDS: ['compScrollPanel1', 'compScrollPanel2', 'compScrollPanel3', 'compScrollPanel4'],

        state: {
            // 좌측 4단 대조표 (날짜는 공통 헤더의 날짜 네비게이션과 동기화됨)
            compBaseDate: null,
            compLoading: false,
            compHasNext: true,
            compHasPrev: true,
            isInitialLoad: true,
            selectedDate: null,
            selectedPanel: null,
            selectedCol: null,
            syncLock: false,

            // 우측 상단: 입고 현황 (연도 단위 자체 네비게이션)
            inYear: today.getFullYear(),
            unit: 'RL',

            // 우측 하단: 월별 출고 현황 (연/월 단위 자체 네비게이션)
            outYear: today.getFullYear(),
            outMonth: today.getMonth() + 1,

            isChanged: false
        },

        elements: {
            wrapper: null
        }
    };

})();