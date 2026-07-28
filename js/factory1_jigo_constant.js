/* factory1_jigo_constant.js — 1공장 지고 재고 페이지 상수
   ────────────────────────────────────────────────────────────────
   창고에 실제로 쌓여 있는 롤 수를 매일 손으로 적는 페이지입니다.
   ERP 가 내려주는 숫자가 아니라 사람이 세어 넣는 숫자라, 이 페이지의
   값은 어떤 배치도 덮어쓰지 않습니다.

   [층]
     저장고가 지하 5층 / 지하 6층으로 물리적으로 나뉩니다. 표를 위아래로
     두 개 쌓고, 스크롤이 서로 붙어 다녀 같은 날짜 줄이 항상 나란히 옵니다.
     제목은 '지하 5층'이라 쓰지 않고 B5 / B6 로 적습니다.

   [열]
     입고(factory1_ipgo) · 사용량(factory1_usage)과 열 순서가 완전히 같습니다.
     세 페이지를 나란히 놓고 같은 자리에서 같은 품목을 읽기 위해서이며,
     "0 이 많은 열을 뒤로 빼는" 식의 재배치는 하지 않습니다.
     대한제지 별관(3공장)만 빠집니다. 여기는 1공장 창고니까요.

   [읽기 전용 열]
     원칙: 전용 관리 페이지가 있는 품목은 그 페이지가 입력 주인이고,
     여기서는 보여주기만 합니다. 지금은 F.T 3종이 해당합니다.
     factory1_ft.html 의 '지고 재고' 표(A/C/D × 5층/6층)가 이미 그 값을
     factory1_ft_jigo 에 저장하고 있어, 여기서 또 입력하면 두 값이 갈라집니다.
     (입고 페이지가 별관 2열을 readonly 로 두고 3공장 테이블을 읽어오는 것과
      같은 처리입니다)

   [승계(carry) 열]
     48.8g 은 나라사랑(월 1회 제작) 전용 용지라 잔량이 한 달 내내 그대로입니다.
     매일 같은 숫자를 치는 건 낭비이고 매일 오타 기회만 늘어납니다. 그래서
     값이 바뀐 날만 입력하고, 그 뒤로는 직전 값을 이어서 옅게 표시합니다.
     ※ 이걸 DB 에서 어떻게 담을지(바뀐 날만 저장 vs 매일 복사)는 아직
       미정입니다. 화면 쪽은 state.carried 로 이미 구분해 두었으므로,
       어느 쪽으로 정해지든 렌더는 손대지 않습니다.
   ──────────────────────────────────────────────────────────────── */
(function () {
    'use strict';

    window.Factory1JigoInv = {
        SUPABASE_URL: 'https://npiflqoscsvnnauvqhrr.supabase.co',
        SUPABASE_KEY: 'sb_publishable_ir-mHSsX6SSIQwHerkLbfA_2qCOP3KW',

        /* ── DB 연결 예정 자리 ────────────────────────────────────
           테이블 설계가 확정되면 여기에 이름을 적고 factory1_jigo_api.js 를
           추가합니다. 지금은 레이아웃 확인 단계라 비어 있습니다.
           ──────────────────────────────────────────────────────── */
        TABLE: null,                    // 예) 'factory1_jigo_inventory'

        // F.T 3종을 읽어올 곳 — factory1_ft.html 의 '지고 재고' 표가 쓰는 테이블
        // (location = '5F' | '6F', item_name = 'A' | 'C' | 'D', date, stock_qty, stock_weight)
        FT_TABLE: 'factory1_ft_jigo',

        WD_KR: ['일', '월', '화', '수', '목', '금', '토'],

        // ── 1레벨 헤더 라벨 (입고 · 사용량 페이지와 동일) ─────────
        GROUPS: {
            'daehan-ad':     '대한제지',
            'paperkorea':    '페이퍼 코리아',
            'jeonju-bonji':  '전주본지',
            'jeonju-jeonja': '전주전자',
            'daehan-c':      '대한제지',
            'ft':            'F.T'
        },

        /* ── 데이터 열 정의 ────────────────────────────────────────
           col      : 열 번호 (헤더 th / 데이터 td 의 data-col 과 일치)
           group    : 소속 1레벨 헤더 키
           label    : 2레벨 헤더 라벨 (빈 값이면 1레벨이 두 행을 병합)
           sep      : 그룹 시작 열 → 좌측 구분선
           itemCode : factory1_ipgo.item_code 와 같은 품목 키
                      (ERP 품목코드가 아닙니다. 입고와 바로 맞춰 보기 위해서이며,
                       ERP 재고와 붙일 때는 factory1_paper_item.erp_code 를 탑니다)
           readonly : true 면 입력칸을 만들지 않습니다. 다른 페이지가 입력 주인인 열입니다.
           source   : 값을 어디서 읽어오는지. 'ft' = factory1_ft_jigo
           ftGroup  : source === 'ft' 인 열이 볼 factory1_ft_jigo.item_name
           carry    : true 면 값이 없는 날에 직전 값을 이어서 표시합니다.

           ※ 두 층이 이 배열을 그대로 공유합니다. 한쪽 층에 지금은 한 번도
             들어온 적 없는 품목이라도 열을 빼지 않습니다. 긴급 상황에 그 층으로
             들어올 수 있고, 그때 코드를 고치지 않고 숫자만 넣으면 됩니다.
             또 두 표의 열이 어긋나면 위아래로 눈대중 비교가 안 됩니다.
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

            // 나라사랑 전용 용지 — 월 1회만 값이 바뀝니다 (위 [승계 열] 설명 참고)
            { col: 9,  group: 'daehan-c',      label: '48.8g', itemCode: 'daehan_488', carry: true },

            // F.T 3종 — 입력은 'FT 일지' 페이지에서만 합니다 (위 [읽기 전용 열] 참고)
            { col: 10, group: 'ft', label: 'A', itemCode: 'ft_a', sep: true, readonly: true, source: 'ft', ftGroup: 'A' },
            { col: 11, group: 'ft', label: 'C', itemCode: 'ft_c',            readonly: true, source: 'ft', ftGroup: 'C' },
            { col: 12, group: 'ft', label: 'D', itemCode: 'ft_d',            readonly: true, source: 'ft', ftGroup: 'D' }
        ],

        /* ── 층 정의 ──────────────────────────────────────────────
           배열 순서가 화면에 쌓이는 순서입니다. 두 표는 스크롤이 동기화되어
           같은 날짜 줄이 항상 나란히 옵니다.
           ──────────────────────────────────────────────────────── */
        FLOORS: [
            { key: 'B5', title: 'B5', scrollId: 'f1jgB5Scroll', bodyId: 'f1jgB5Body', cursorId: 'f1jgB5Cursor' },
            { key: 'B6', title: 'B6', scrollId: 'f1jgB6Scroll', bodyId: 'f1jgB6Body', cursorId: 'f1jgB6Cursor' }
        ],

        /* ── 롤당 무게 (kg) ───────────────────────────────────────
           R/L ↔ Kg 스위처가 쓰는 환산 계수입니다. 입력과 저장은 언제나 롤이고,
           Kg 은 표시할 때만 곱합니다.

           ※ 지금 값이 들어 있는 건 F.T 3종뿐입니다. factory1_ft_constant.js 의
             JIGO_WEIGHT_MULTIPLIER 에 이미 있던 숫자를 그대로 옮겼습니다.
             나머지 9개 열은 factory1_paper_item.roll_kg 에 들어 있는 값이라
             DB 를 붙일 때 거기서 읽어옵니다. 그때까지는 Kg 모드에서 '–' 로
             뜹니다. (모르는 값을 지어내지 않으려고 비워 두었습니다)
           ──────────────────────────────────────────────────────── */
        ROLL_KG: {
            daehan_a:     null,
            daehan_d:     null,
            paperkorea:   null,
            jj_bonji_a:   null,
            jj_bonji_d:   null,
            jj_jeonja_a:  null,
            jj_jeonja_d:  null,
            daehan_c:     null,
            daehan_488:   null,
            ft_a:         1337,
            ft_c:         1003,
            ft_d:         669
        },

        // 한 번에 불러오는 일수 / 과거로 조회 가능한 최대치
        RANGE: 15,
        MAX_PAST_DAYS: 365,

        /* 수정 가능 구간 — 오늘 기준 과거/미래 며칠까지 입력칸을 열어줄지
           미래 1일: 내일 몫을 미리 적어 두는 실무를 위해 열어 둡니다.
           과거 7일: 일단 기본값입니다. 1월 1일부터 소급 입력을 하게 되면
                     그동안만 크게 늘렸다가 되돌립니다.
                     (입고 페이지가 지금 EDIT_PAST_DAYS: 40 으로 그렇게 하고 있습니다) */
        EDIT_PAST_DAYS: 7,
        EDIT_FUTURE_DAYS: 1,

        /* ── 화면 확인용 임시 숫자 ────────────────────────────────
           DB 가 아직 없어 표가 통째로 비면 열 너비도 자릿수도 확인할 수 없어
           넣어 둔 값입니다. 같은 (층·날짜·품목)이면 언제나 같은 숫자가 나오게
           만들어, 스크롤할 때 숫자가 달라지지 않습니다.
           DB 를 붙이는 순간 false 로 바꾸고 SAMPLE_* 항목과
           factory1_jigo_render.js 의 sample 관련 함수를 지우면 됩니다.
           ──────────────────────────────────────────────────────── */
        USE_SAMPLE_DATA: true,

        // 임시 숫자에서 "그 층에 안 쌓는 품목"으로 취급할 열 (전부 0 으로 나옵니다)
        // 실제 운영 규칙이 아니라 '–' 가 깔린 모습을 보기 위한 장치입니다.
        SAMPLE_ABSENT: {
            B5: ['paperkorea', 'jj_bonji_d', 'jj_jeonja_d'],
            B6: ['daehan_488']
        },

        state: {
            // 표시 단위 — 'RL'(롤) | 'KG'. 편집 모드에서는 항상 RL 로 고정됩니다.
            unit: 'RL',

            // 과거 DB 스크롤 허용 여부 (기본 OFF: 잠금 상태)
            isScrollUnlocked: false,

            loading: false,
            hasPrev: true,
            hasNext: true,
            isInitialLoad: true,
            syncLock: false,

            baseDate: null,
            selectedDate: null,
            selectedCol: null,
            selectedFloor: 'B5',

            /* ── 값 캐시 ───────────────────────────────────────────
               values   : 화면에 표시 중인 롤 수   values[층][날짜][itemCode]
               snapshot : DB 에서 읽어온 원본값 (변경 여부 판단 기준)
               carried  : 승계로 채워진 칸 표시    carried[층][날짜][itemCode] = true
                          (사람이 그날 실제로 센 값과 구분해서 옅게 그립니다)
               dirty    : 원본과 달라진 셀 키 집합 — '층|날짜|itemCode'
                          저장 시 이 집합에 든 셀만 DB 로 보냅니다.
                          값을 되돌리면 자동으로 빠지므로 불필요한 쓰기가 없습니다.
               ──────────────────────────────────────────────────── */
            values:   { B5: {}, B6: {} },
            snapshot: { B5: {}, B6: {} },
            carried:  { B5: {}, B6: {} },
            dirty: new Set(),

            /* 승계 씨앗 — carrySeed[층][itemCode] = { date, value }
               조회 구간보다 앞에서 마지막으로 입력된 값입니다.

               48.8g 은 한 달에 한 번만 바뀌므로, 15일치를 불러오는 것만으로는
               직전 값을 못 보는 날이 대부분입니다. 그러면 이어받을 값이 없어
               한 달 내내 빈칸으로 보입니다. 조회 범위와 별개로 "이 날짜 이전
               마지막 1건"을 따로 한 번 더 읽어 와야 합니다.
               → DB 를 붙일 때 carry 열마다 이 한 건짜리 조회가 필요합니다. */
            carrySeed: { B5: {}, B6: {} },

            // 이미 조회한 날짜 구간 (중복 조회 방지)
            fetched: new Set(),

            isChanged: false
        },

        elements: {
            wrapper: null
        }
    };

})();
