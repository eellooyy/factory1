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
        TABLE: 'factory1_ipgo',   // (ipgo_date, item_code) 유니크 · 셀 하나당 한 줄

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
           col      : 열 번호 (헤더 th / 데이터 td 의 data-col 과 일치)
           group    : 소속 1레벨 헤더 키
           label    : 2레벨 헤더 라벨 (빈 값이면 하위 구분 없이 1레벨이 두 행 병합)
           sep      : 그룹 시작 열 → 좌측 구분선 표시
           itemCode : factory1_ipgo.item_code 와 1:1 대응하는 품목 키

           itemCode 는 추후 paper_item 마스터 테이블이 생기면 그쪽에서 읽어옵니다.
           그때는 이 배열을 만드는 부분만 교체하면 되고, 렌더/저장 로직은 그대로입니다.
           ──────────────────────────────────────────────────────── */
        COLUMNS: [
            { col: 1,  group: 'daehan-ad',     label: 'A',     itemCode: 'daehan_a' },
            { col: 2,  group: 'daehan-ad',     label: 'D',     itemCode: 'daehan_d' },
            { col: 3,  group: 'paperkorea',    label: '',      itemCode: 'paperkorea',  sep: true },
            { col: 4,  group: 'jeonju-bonji',  label: 'A',     itemCode: 'jj_bonji_a',  sep: true },
            { col: 5,  group: 'jeonju-bonji',  label: 'D',     itemCode: 'jj_bonji_d' },
            { col: 6,  group: 'jeonju-jeonja', label: 'A',     itemCode: 'jj_jeonja_a', sep: true },
            { col: 7,  group: 'jeonju-jeonja', label: 'D',     itemCode: 'jj_jeonja_d' },
            { col: 8,  group: 'daehan-c',      label: 'C',     itemCode: 'daehan_c',    sep: true },
            { col: 9,  group: 'daehan-c',      label: '48.8g', itemCode: 'daehan_488' },
            { col: 10, group: 'ft',            label: 'A',     itemCode: 'ft_a',        sep: true },
            { col: 11, group: 'ft',            label: 'C',     itemCode: 'ft_c' },
            { col: 12, group: 'ft',            label: 'D',     itemCode: 'ft_d' }
        ],

        // ── 우측 패널: 별쇄 계획표 열 정의 ────────────────────────
        PLAN_COLUMNS: [
            { col: 1, group: 'byeolswae', label: '계획' },
            { col: 2, group: 'byeolswae', label: '수정1' },
            { col: 3, group: 'byeolswae', label: '수정2' }
        ],

        /* ── 우측 영역: 지종별 재고 표시 블록 ─────────────────────
           title : 제목 (배열 요소 하나가 한 줄)
           specs : 지폭 목록 — 각 지폭마다 "지폭 - N롤" 한 칸이 생깁니다.
           롤 수와 kg 값은 DB 연동 후 채워집니다. (지금은 '-' 표기)
           ──────────────────────────────────────────────────────── */
        SIDE_BLOCKS: [
            { key: 'daehan-main',  title: ['대한제지 본관'],           specs: [1576, 788] },
            { key: 'paperkorea',   title: ['페이퍼코리아 본관'],       specs: [1576] },
            { key: 'jeonju-bonji', title: ['전주제지 본관', '본 지'],  specs: [1576, 788] },
            { key: 'jeonja-news',  title: ['전자신문'],                specs: [1576, 788] },
            { key: 'daehan-annex', title: ['대한제지 별관'],           specs: [1576, 788] }
        ],

        // 한 번에 불러오는 일수 / 과거로 조회 가능한 최대치
        RANGE: 15,
        MAX_PAST_DAYS: 365,

        // 수정 가능 구간 — 오늘 기준 과거/미래 며칠까지 입력칸을 열어줄지
        // (이 범위 밖의 행은 편집 모드에서도 잠긴 상태로 표시됩니다)
        EDIT_PAST_DAYS: 7,
        EDIT_FUTURE_DAYS: 7,

        // 초기 진입 시 오늘 날짜가 위에서 몇 번째 줄에 오게 할지
        // (3 = 오늘 위로 2줄이 보이고, 아래로는 화면이 찰 만큼의 날짜가 렌더링됩니다)
        TODAY_ROW_FROM_TOP: 3,

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

            /* ── 입력 데이터 캐시 / 변경분 추적 ────────────────────
               cache    : 화면에 표시 중인 값   cache[날짜][itemCode] = 롤수 or null
               snapshot : DB 에서 읽어온 원본값 (변경 여부 판단 기준)
               dirty    : 원본과 달라진 셀 키 집합 — '날짜|itemCode'
                          저장 시 이 집합에 든 셀만 DB 로 보냅니다.
                          값을 되돌리면 자동으로 빠지므로 불필요한 쓰기가 없습니다.
               ──────────────────────────────────────────────────── */
            cache: {},
            snapshot: {},
            dirty: new Set(),

            isChanged: false
        },

        elements: {
            wrapper: null
        }
    };

})();
