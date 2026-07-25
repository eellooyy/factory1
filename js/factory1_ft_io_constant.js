/* factory1_ft_io_constant.js — 1공장 FT 재고 종합 모듈 상수 선언 */
(function () {
    'use strict';

    const today = new Date();

    // FT 일지 페이지(factory1_ft_constant.js)가 함께 로드된 경우 그 설정을 상속하고,
    // 이 페이지 단독으로 로드된 경우에는 아래 기본값을 사용합니다.
    const base = window.Factory1Ft || {};

    window.Factory1FtIo = {
        SUPABASE_URL: base.SUPABASE_URL || 'https://npiflqoscsvnnauvqhrr.supabase.co',
        SUPABASE_KEY: base.SUPABASE_KEY || 'sb_publishable_ir-mHSsX6SSIQwHerkLbfA_2qCOP3KW',
        TABLE: 'factory1_ft_io_table', // 추후 확정될 재고 종합 전용 DB 테이블명

        // ── 조회용 뷰 ────────────────────────────────────────────────
        // 출고(=인쇄 사용량): print_date / paper_a / paper_c / paper_d
        USAGE_VIEW: 'v_factory1_ft_usage_daily',
        // 실재고 및 대조: log_date / item_name / actual_stock_kg / contrast_qty
        STOCK_VIEW: 'v_factory1_ft_actual_stock',

        GROUPS: ['A', 'C', 'D'],

        WD_KR: ['일', '월', '화', '수', '목', '금', '토'],
        PANEL_IDS: ['compScrollPanel1', 'compScrollPanel2', 'compScrollPanel3', 'compScrollPanel4'],

        // 1층 4단 대조표 — 한 번에 불러오는 일수 / 과거로 조회 가능한 최대치
        COMP_RANGE: 15,
        COMP_MAX_PAST_DAYS: 365,

        // 2층 좌측 입고 현황 — 한 번에 불러오는 개수 / 과거로 조회 가능한 최대치
        // (입고는 아직 실제 DB 미연동 상태입니다.)
        INBOUND_BATCH: 5,        // 5건이면 표시 영역(180px)을 넘겨 스크롤바가 노출됨
        INBOUND_MAX_DAYS: 90,      // 입고 현황: 최근 90일까지 과거 스크롤 허용

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

            // 우측 하단: 월별 출고 현황 — 연도 단위 네비게이션 (해당 연도 1~12월 합산)
            outYear: today.getFullYear(),
            outLoading: false,

            isChanged: false
        },

        elements: {
            wrapper: null
        }
    };

})();