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

        // 2층 하단 카드 — 한 번에 불러오는 개수 / 과거로 조회 가능한 최대치
        INBOUND_BATCH: 4,
        INBOUND_MAX_DAYS: 90,      // 입고 현황: 최근 90일까지 과거 스크롤 허용
        OUTBOUND_BATCH: 4,
        OUTBOUND_MAX_MONTHS: 36,   // 월별 출고 현황: 최근 36개월까지 과거 스크롤 허용

        state: {
            // 과거 DB 스크롤 허용 여부 (기본 OFF: 잠금 상태)
            isScrollUnlocked: false,

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

            // 우측 상단: 입고 현황 (연도 단위 자체 네비게이션 + 과거 스크롤 페이징)
            inYear: today.getFullYear(),
            unit: 'RL',
            inOffset: 0,       // 현재까지 불러온 "오늘 기준 며칠 전"까지의 offset (다음 로드 시작점)
            inLoading: false,
            inHasMore: true,

            // 우측 하단: 월별 출고 현황 — 연도 단위 네비게이션 + 과거 스크롤 페이징
            outYear: today.getFullYear(),
            outOffset: 0,      // 현재까지 불러온 "이번달 기준 몇 개월 전"까지의 offset
            outLoading: false,
            outHasMore: true,

            isChanged: false
        },

        elements: {
            wrapper: null
        }
    };

})();