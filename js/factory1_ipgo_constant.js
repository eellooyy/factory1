/* factory1_ipgo_constant.js — 1공장 입고 모듈 상수 선언
   ────────────────────────────────────────────────────────────────
   현재는 레이아웃 확인 단계로 DB 연동이 없습니다.
   추후 입고 테이블이 확정되면 TABLE / VIEW 항목만 채우고
   factory1_ipgo_api.js 를 추가하면 됩니다.
   ──────────────────────────────────────────────────────────────── */
(function () {
    'use strict';

    const today = new Date();

    // FT 페이지 설정이 함께 로드된 경우 상속, 단독 로드 시 기본값 사용
    const base = window.Factory1Ft || {};

    window.Factory1Ipgo = {
        SUPABASE_URL: base.SUPABASE_URL || 'https://npiflqoscsvnnauvqhrr.supabase.co',
        SUPABASE_KEY: base.SUPABASE_KEY || 'sb_publishable_ir-mHSsX6SSIQwHerkLbfA_2qCOP3KW',
        TABLE: null,   // 입고 테이블 미확정 (추후 논의 후 결정)

        WD_KR: ['일', '월', '화', '수', '목', '금', '토'],

        // ── 1레벨 헤더(거래처/구분) 라벨 ──────────────────────────
        GROUPS: {
            'daehan-ad':     '대한제지',
            'paperkorea':    '페이퍼 코리아',
            'jeonju-bonji':  '전주본지',
            'jeonju-jeonja': '전주전자',
            'daehan-c':      '대한제지',
            'ft':            'F.T',
            'byeolswae':     '별쇄 계획표'
        },

        /* ── 데이터 열 정의 ────────────────────────────────────────
           col   : 열 번호 (헤더 th / 데이터 td 의 data-col 과 일치)
           group : 소속 1레벨 헤더 키
           label : 2레벨 헤더 라벨 (빈 값이면 하위 구분 없이 1레벨이 두 행 병합)
           sep   : 그룹 시작 열 → 좌측 구분선 표시
           ──────────────────────────────────────────────────────── */
        COLUMNS: [
            { col: 1,  group: 'daehan-ad',     label: 'A' },
            { col: 2,  group: 'daehan-ad',     label: 'D' },
            { col: 3,  group: 'paperkorea',    label: '',      sep: true },
            { col: 4,  group: 'jeonju-bonji',  label: 'A',     sep: true },
            { col: 5,  group: 'jeonju-bonji',  label: 'D' },
            { col: 6,  group: 'jeonju-jeonja', label: 'A',     sep: true },
            { col: 7,  group: 'jeonju-jeonja', label: 'D' },
            { col: 8,  group: 'daehan-c',      label: 'C',     sep: true },
            { col: 9,  group: 'daehan-c',      label: '48.8g' },
            { col: 10, group: 'ft',            label: 'A',     sep: true },
            { col: 11, group: 'ft',            label: 'C' },
            { col: 12, group: 'ft',            label: 'D' }
        ],

        // ── 우측 패널: 별쇄 계획표 열 정의 ────────────────────────
        PLAN_COLUMNS: [
            { col: 1, group: 'byeolswae', label: '계획' },
            { col: 2, group: 'byeolswae', label: '수정1' },
            { col: 3, group: 'byeolswae', label: '수정2' }
        ],

        // 한 번에 불러오는 일수 / 과거로 조회 가능한 최대치
        RANGE: 15,
        MAX_PAST_DAYS: 365,

        // 오늘 날짜 아래로 함께 보여줄 행 수
        // 1이면 오늘 다음날 한 줄이 아래에 남아 오늘이 '아래에서 두 번째 줄'에 위치합니다.
        FUTURE_ROWS_BELOW_TODAY: 1,

        /* ── 패널 정의 (좌: 입고 대장 / 우: 별쇄 계획표) ───────────
           두 패널은 스크롤이 서로 동기화되어 같이 움직입니다.
           ──────────────────────────────────────────────────────── */
        PANELS: [
            { idx: 1, scrollId: 'f1ipScrollPanel',     bodyId: 'f1ipBody',     cursorId: 'f1ipCursor' },
            { idx: 2, scrollId: 'f1ipPlanScrollPanel', bodyId: 'f1ipPlanBody', cursorId: 'f1ipPlanCursor' }
        ],

        state: {
            // 과거 DB 스크롤 허용 여부 (기본 OFF: 잠금 상태)
            isScrollUnlocked: false,

            baseDate: null,
            loading: false,
            hasNext: true,
            hasPrev: true,
            isInitialLoad: true,
            syncLock: false,

            selectedDate: null,
            selectedPanel: null,
            selectedCol: null,

            isChanged: false
        },

        elements: {
            wrapper: null
        }
    };

})();
