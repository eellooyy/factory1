/* factory1_paperuse_constant.js — 1공장 사용량 페이지 [1층] 용지별 사용량 상수
   ────────────────────────────────────────────────────────────────
   열 구성은 입고 페이지(factory1_ipgo)의 좌측 '입고 대장'과 동일합니다.
   같은 날짜 줄에서 "들어온 양(입고) ↔ 쓴 양(사용)"을 나란히 비교하기
   위해서이며, 별쇄 계획표(우측 패널)만 빠졌습니다.

   데이터 출처
     1~12열  v_factory1_usage_by_item  (adjustments 보정이 반영된 뷰)
     13~14열 v_factory3_usage_by_item  (별관 = 3공장, 같은 형식)

   ※ 입고 페이지는 자체 품목코드(daehan_a 등)를 쓰지만 사용량은 ERP
     품목코드로 들어옵니다. 둘의 대응은 factory1_paper_item.erp_code 에
     이미 들어 있고, 아래 erpCode 값이 그것과 일치합니다.
   ──────────────────────────────────────────────────────────────── */
(function () {
    'use strict';

    window.Factory1PaperUse = {
        SUPABASE_URL: 'https://npiflqoscsvnnauvqhrr.supabase.co',
        SUPABASE_KEY: 'sb_publishable_ir-mHSsX6SSIQwHerkLbfA_2qCOP3KW',

        // 1공장 — 보정(adjustments)이 반영된 뷰. base 테이블을 직접 보지 않습니다.
        VIEW: 'v_factory1_usage_by_item',

        // 별관(3공장) — 1공장과 같은 형식의 뷰입니다. (2026-07-28 전환)
        // 뷰가 이미 (날짜 × 품목)으로 합산해 주므로 API 쪽 수동 합산이 사라졌고,
        // adjustments(factory = 3) 보정도 여기서 함께 반영됩니다.
        FACTORY3_VIEW: 'v_factory3_usage_by_item',

        WD_KR: ['일', '월', '화', '수', '목', '금', '토'],

        // ── 1레벨 헤더 라벨 (입고 페이지와 동일) ──────────────────
        GROUPS: {
            'daehan-ad':     '대한제지',
            'paperkorea':    '페이퍼 코리아',
            'jeonju-bonji':  '전주본지',
            'jeonju-jeonja': '전주전자',
            'daehan-c':      '대한제지',
            'ft':            'F.T',
            'daehan-annex':  '대한제지 별관'
        },

        /* ── 데이터 열 정의 ────────────────────────────────────────
           col     : 열 번호 (헤더 th / 데이터 td 의 data-col 과 일치)
           group   : 소속 1레벨 헤더 키
           label   : 2레벨 헤더 라벨 (빈 값이면 1레벨이 두 행을 병합)
           sep     : 그룹 시작 열 → 좌측 구분선
           erpCode : ERP 품목코드 (factory1_paper_item.erp_code 와 동일)
           source  : 생략하면 1공장(VIEW), 'factory3' 이면 별관 참조 열
           ──────────────────────────────────────────────────────── */
        COLUMNS: [
            { col: 1,  group: 'daehan-ad',     label: 'A',     erpCode: '11ANP-0000001' },
            { col: 2,  group: 'daehan-ad',     label: 'D',     erpCode: '11ANP-0000003' },
            { col: 3,  group: 'paperkorea',    label: '',      erpCode: '11ANP-0000004', sep: true },
            { col: 4,  group: 'jeonju-bonji',  label: 'A',     erpCode: '11ANP-0000008', sep: true },
            { col: 5,  group: 'jeonju-bonji',  label: 'D',     erpCode: '11ANP-0000009' },
            { col: 6,  group: 'jeonju-jeonja', label: 'A',     erpCode: '11BNP-0000003', sep: true },
            { col: 7,  group: 'jeonju-jeonja', label: 'D',     erpCode: '11BNP-0000004' },
            { col: 8,  group: 'daehan-c',      label: 'C',     erpCode: '11ANP-0000002', sep: true },
            { col: 9,  group: 'daehan-c',      label: '48.8g', erpCode: '11ANP-0000006' },
            { col: 10, group: 'ft',            label: 'A',     erpCode: '11BNP-0000005', sep: true },
            { col: 11, group: 'ft',            label: 'C',     erpCode: '11BNP-0000006' },
            { col: 12, group: 'ft',            label: 'D',     erpCode: '11BNP-0000007' },

            // 별관(3공장) 참조 열 — 3공장은 대한제지 A/D 만 사용합니다.
            { col: 13, group: 'daehan-annex',  label: 'A',     erpCode: '11ANP-0000001', source: 'factory3', sep: true },
            { col: 14, group: 'daehan-annex',  label: 'D',     erpCode: '11ANP-0000003', source: 'factory3' }
        ],

        // 패널 정의 — 1층은 패널 하나입니다. (2층 매체별을 붙일 때 같은 구조를 씁니다)
        PANELS: [
            { idx: 1, scrollId: 'f1usPaperScroll', bodyId: 'f1usPaperBody', cursorId: 'f1usPaperCursor' }
        ],

        // 한 번에 불러오는 일수 / 과거로 조회 가능한 최대치
        RANGE: 15,
        MAX_PAST_DAYS: 365,

        state: {
            isScrollUnlocked: false,
            loading: false,
            hasPrev: true,
            hasNext: true,
            isInitialLoad: true,

            selectedDate: null,
            selectedCol: null,

            // 조회 결과 캐시
            //   usage[날짜][erpCode]    = 1공장 사용량
            //   factory3[날짜][erpCode] = 별관(3공장) 사용량
            usage: {},
            factory3: {},

            // 이미 조회한 날짜 구간 (중복 조회 방지)
            fetched: new Set()
        },

        elements: {
            wrapper: null
        }
    };

})();
