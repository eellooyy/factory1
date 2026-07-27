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
        TABLE: 'factory1_ipgo',              // (ipgo_date, item_code) 유니크 · 셀 하나당 한 줄
        ITEM_TABLE: 'factory1_paper_item',   // 품목 마스터 (열 정의 / kg 환산 계수)
        VIEW: 'v_factory1_ipgo',             // 입고 + 마스터 조인 (inbound_qty = 롤 × roll_kg)

        WD_KR: ['일', '월', '화', '수', '목', '금', '토'],

        // ── 1레벨 헤더(거래처/구분) 라벨 ──────────────────────────
        GROUPS: {
            'daehan-ad':     '대한제지',
            'paperkorea':    '페이퍼 코리아',
            'jeonju-bonji':  '전주본지',
            'jeonju-jeonja': '전주전자',
            'daehan-c':      '대한제지',
            'ft':            'F.T',
            'daehan-annex':  '대한제지 별관',
            'byeolswae':     '별쇄 계획표'
        },

        /* ── 데이터 열 정의 ────────────────────────────────────────
           col      : 열 번호 (헤더 th / 데이터 td 의 data-col 과 일치)
           group    : 소속 1레벨 헤더 키
           label    : 2레벨 헤더 라벨 (빈 값이면 하위 구분 없이 1레벨이 두 행 병합)
           sep      : 그룹 시작 열 → 좌측 구분선 표시
           itemCode : factory1_ipgo.item_code 와 1:1 대응하는 품목 키
           source   : 생략하면 factory1_ipgo (이 페이지에서 입력하는 열)
                      'factory3' 이면 factory3_io 에서 읽어오는 참조 열입니다.
           field    : source === 'factory3' 인 열이 볼 factory3_io 컬럼
                      ('a' → in_a, 'd' → in_d)
           readonly : true 인 열은 입력칸/메모/저장 대상에서 제외됩니다.
                      값 입력은 3공장 페이지에서만 하고 여기서는 보기만 합니다.

           이 배열은 추후 ITEM_TABLE(factory1_paper_item)에서 sort_order 순으로
           읽어오도록 교체할 예정입니다. 그때 바뀌는 건 배열을 만드는 부분뿐이고
           렌더/저장 로직은 그대로 갑니다.
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
            { col: 12, group: 'ft',            label: 'D',     itemCode: 'ft_d' },

            // 별관(3공장) 참조 열 — factory3_io 의 in_a / in_d 를 그대로 보여만 줍니다.
            { col: 13, group: 'daehan-annex',  label: 'A',     source: 'factory3', field: 'a', readonly: true, sep: true },
            { col: 14, group: 'daehan-annex',  label: 'D',     source: 'factory3', field: 'd', readonly: true }
        ],

        // ── 우측 패널: 별쇄 계획표 열 정의 ────────────────────────
        PLAN_COLUMNS: [
            { col: 1, group: 'byeolswae', label: '계획' },
            { col: 2, group: 'byeolswae', label: '수정1' },
            { col: 3, group: 'byeolswae', label: '수정2' }
        ],

        /* ── 우측 영역: 거래처별 입고 현황 블록 ───────────────────
           선택한 날짜의 입고를 거래처 단위로 묶어 "지폭 - N롤" 과 kg 합계를
           보여줍니다.

           title  : 제목 (배열 요소 하나가 한 줄)
           source : 'ipgo'     → factory1_ipgo (1공장)
                    'factory3' → factory3_io   (3공장 = 별관)
           always : false 면 그 날 입고가 하나도 없을 때 블록째 숨깁니다.
                    (비정기 입고 거래처)
           lines  : 한 블록 안에서 kg 합계를 따로 내는 묶음입니다.
                    대한제지 본관은 일반 지종 줄과 48.8g 줄의 kg 를 따로 냅니다.
           items[].always : false 면 값이 없을 때 그 항목만 사라집니다.
                    (블록이 보이더라도 해당 칸은 빠짐)
           ──────────────────────────────────────────────────────── */
        SIDE_BLOCKS: [
            {
                key: 'daehan-main', title: ['대한제지 본관'],
                source: 'ipgo', always: true,
                lines: [
                    { items: [
                        { itemCode: 'daehan_a',   label: '1576', always: true  },
                        { itemCode: 'daehan_c',   label: '1182', always: false },
                        { itemCode: 'daehan_d',   label: '788',  always: true  }
                    ] },
                    { items: [
                        { itemCode: 'daehan_488', label: '1576 48.8g', always: false }
                    ] }
                ]
            },
            {
                key: 'paperkorea', title: ['페이퍼코리아 본관'],
                source: 'ipgo', always: true,
                lines: [
                    { items: [
                        { itemCode: 'paperkorea', label: '1576', always: true }
                    ] }
                ]
            },
            {
                key: 'jeonju-bonji', title: ['전주제지 본관', '본 지'],
                source: 'ipgo', always: false,
                lines: [
                    { items: [
                        { itemCode: 'jj_bonji_a', label: '1576', always: true },
                        { itemCode: 'jj_bonji_d', label: '788',  always: true }
                    ] }
                ]
            },
            {
                key: 'jeonja-news', title: ['전자신문'],
                source: 'ipgo', always: false,
                lines: [
                    { items: [
                        { itemCode: 'jj_jeonja_a', label: '1576', always: true },
                        { itemCode: 'jj_jeonja_d', label: '788',  always: true }
                    ] }
                ]
            },
            {
                key: 'daehan-annex', title: ['대한제지 별관'],
                source: 'factory3', always: true,
                lines: [
                    { items: [
                        { field: 'a', label: '1576', always: true },
                        { field: 'd', label: '788',  always: true }
                    ] }
                ]
            }
        ],

        // 별관(3공장) 입고 테이블 — in_a/in_d = 롤, in_a_kg/in_d_kg = kg
        FACTORY3_TABLE: 'factory3_io',

        /* ── 3공장 셀 메모 ────────────────────────────────────────
           1공장(factory1_ipgo)은 메모가 값과 같은 행에 붙어 있지만,
           3공장은 factory3_io_memo (date, col_id, memo_text) 라는
           별도 테이블에 (날짜, 셀) 단위로 저장됩니다.

           col_id 는 'ALL'(날짜 칸에 단 메모) 또는 'p{패널}_c{열}' 입니다.
           3공장 입출고 대장의 패널 구성이 그대로 열쇠가 됩니다.
             p1 = 입출고 대장  p2 = 매체별 사용량  p3 = 용지별 사용량
           ──────────────────────────────────────────────────────── */
        FACTORY3_MEMO_TABLE: 'factory3_io_memo',

        FACTORY3_MEMO_LABELS: {
            'ALL':   '날짜',
            'p1_c1': '입고 A',   'p1_c2': '입고 D',
            'p1_c3': '출고 A',   'p1_c4': '출고 D',
            'p1_c5': '재고 A',   'p1_c6': '재고 D',
            'p2_c1': '본지',     'p2_c2': '별쇄',      'p2_c3': '경인일보',
            'p2_c4': '기독교타임즈', 'p2_c5': '대학신문', 'p2_c6': '평화신문',
            'p2_c7': '매체합계',
            'p3_c1': '용지 A',   'p3_c2': '용지 D'
        },

        // 한 번에 불러오는 일수 / 과거로 조회 가능한 최대치
        RANGE: 15,
        MAX_PAST_DAYS: 365,

        // 우측 하단 메모 요약에 불러올 최대 건수 (최근 것부터)
        // 표의 날짜 구간과 무관하게 별도로 조회합니다.
        MEMO_LIST_LIMIT: 300,

        // 수정 가능 구간 — 오늘 기준 과거/미래 며칠까지 입력칸을 열어줄지
        // (이 범위 밖의 행은 편집 모드에서도 잠긴 상태로 표시됩니다)
        //
        // ※ 임시: 기존 DB 이관분이 2026-07-09 까지라 7/10~7/18 을 손으로 채우기 위해
        //    과거 구간만 한시적으로 넓혀둔 상태입니다. 입력이 끝나면 7 로 되돌리세요.
        EDIT_PAST_DAYS: 40,
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

            // 우측 카드 표시 대상 — 'chongmu'(총무국) | 'gongmu'(공무국)
            // 공무국 표시 내용은 추후 확정 예정입니다.
            dept: 'chongmu',

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

            // 셀별 메모  memo[날짜][itemCode] = 문자열 or null
            // 롤 수와 달리 더블클릭 즉시 저장되므로 dirty 추적 대상이 아닙니다.
            memo: {},

            /* 우측 하단 메모 요약용 목록 — 표 구간과 무관하게 따로 조회합니다.
               1공장과 3공장 메모를 함께 담습니다.
               [{ dateStr, factory: 1|3, key, text }, ...]
                 factory 1 → key 는 factory1_ipgo.item_code
                 factory 3 → key 는 factory3_io_memo.col_id            */
            memoList: [],

            // 별관(3공장) 참조 열 값  factory3[날짜] = { a: 롤수, d: 롤수 }
            // 읽기 전용이라 snapshot/dirty 없이 조회 결과만 담아 둡니다.
            factory3: {},

            isChanged: false
        },

        elements: {
            wrapper: null
        }
    };

})();
