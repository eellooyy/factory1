/* factory1_geupji_constant.js — 1공장 급지 재고 공통 상수 · 유틸 · 상태 */
(function () {
    'use strict';

    // 전역 공유 객체 초기화
    window.Factory1GeupjiInv = window.Factory1GeupjiInv || {};

    const App = window.Factory1GeupjiInv;

    // ── Supabase 설정 ────────────────────────────────────────────────────────
    App.SUPABASE_URL = 'https://npiflqoscsvnnauvqhrr.supabase.co';
    App.SUPABASE_KEY = 'sb_publishable_ir-mHSsX6SSIQwHerkLbfA_2qCOP3KW';

    /* 일지 본체 — 한 행 = 급지대 하나 = 화면의 한 열
       (log_date, machine, stand) 유니크. 숫자가 하나도 없는 급지대는 행을 만들지
       않습니다. 드롭다운은 자주 쓰는 값이 미리 찍혀 있을 뿐이라, 그것만으로는
       "오늘 이 급지대를 썼다"는 뜻이 되지 않기 때문입니다. */
    App.TABLE = 'factory1_geupji_real';

    /* 급지 용지 마스터 뷰 — 드롭다운 목록 · 라벨 · 롤당 중량 · ERP 품목코드가
       전부 여기 있습니다. factory1_paper_item 의 geupji_key 로 묶은 결과입니다.

       예전에는 이 넷이 JS 에 흩어져 있었습니다(TYPE_KEYS / TYPE_LABELS /
       rollWeight() / ERP_ITEM_CODES). 용지가 하나 늘 때마다 네 곳을 고쳐야 했고
       뷰에서는 롤당 중량을 알 수 없어 재고를 SQL 로 낼 수도 없었습니다.
       이제 마스터에 행을 넣으면 드롭다운도 계산도 따라옵니다. */
    App.PAPER_VIEW = 'v_factory1_geupji_paper';

    /* 급지 재고 뷰 — 저장하지 않고 좌측 값에서 매번 계산됩니다.
       이 페이지는 '다음날 재고'(실사용량 계산용)를 읽을 때만 씁니다. 오늘 재고는
       화면에서 직접 계산합니다. 편집 중에는 아직 저장 전이라 뷰가 모르는 값이고,
       숫자를 고칠 때마다 재고가 바로 따라 움직여야 하기 때문입니다. 두 계산식은
       같으므로 저장 후에는 뷰와 화면이 언제나 일치합니다. */
    App.STOCK_VIEW = 'v_factory1_geupji_stock';

    /* ERP 사용량 조회용 뷰 — 사용량 페이지(factory1_paperuse)가 보는 것과 같습니다.
       base 테이블(factory1_usage)을 직접 읽지 않습니다. 회계 보정(adjustments)이
       뷰에서만 합산되기 때문이고, 나중에 보정이 들어와도 여기는 고칠 게 없습니다.
       컬럼: print_date, item_code, item_name, usage_qty (kg) */
    App.USAGE_VIEW = 'v_factory1_usage_by_item';

    /* ── 잔여 주행지 ──────────────────────────────────────────────────────────
       급지대에 걸려 있지 않은 부분 롤 잔량입니다. 대한 C 처럼 몇 달씩 잠자는
       용지가 여기 담깁니다.

       [계승] 값이 바뀐 날만 행을 만듭니다. kg 라 매일 옮겨 적는 게 일이 되고
       실제로는 몇 달에 한 번 움직입니다. 안 적은 날은 뷰가 직전 값을 이어받습니다.

       [0 은 반드시 적습니다] 여기서 "행이 없다"는 '안 적었다 = 직전 값 그대로'
       라는 뜻입니다. 다 써서 0 이 된 날 행을 지우면 몇 달 전 값이 되살아나
       재고가 영원히 줄지 않습니다. 호기 표(빈 칸 = 행 삭제)와 정반대이니
       헷갈리지 마세요.

       CARRY_VIEW 는 날짜를 펼쳐 계승까지 끝낸 결과입니다. 재고실사 페이지도
       같은 뷰(의 합계)를 읽어야 두 화면이 갈라지지 않습니다. */
    App.CARRY_TABLE = 'factory1_geupji_carry';
    App.CARRY_VIEW  = 'v_factory1_geupji_carry';

    /* ── 실제 출고 ────────────────────────────────────────────────────────────
       `출고 = 전일 재고 − 금일 재고 + 당일 입고` (전부 지고 재고의 완롤 기준).
       잔여 주행지는 여기에 들어가지 않습니다 — 창고에서 나간 롤만 셉니다.

       [저장하는 것은 수기 수정값뿐입니다]
       자동계산값을 저장하면 지고 재고를 나중에 고쳤을 때 출고가 옛날 값으로
       남습니다. 이 값의 쓸모가 "실사용량 vs ERP 오차로 재고 파악을 검증"하는
       것이라, 검증 도구가 스스로 갈라지면 오차가 거짓말을 합니다.
       반대로 수기값은 계산으로 복원할 수 없으니 반드시 저장해야 합니다.

       [손댄 날이 남아야 합니다]
       오차가 커졌을 때 "그날 손으로 덮어썼구나"를 알 수 있어야 합니다.
       뷰가 is_manual 로 알려주고 화면은 칸 색을 달리합니다.

       뷰가 하나인 이유: 한 행이 (날짜 · 용지) 하나뿐이라 자동·수기·합친 값을
       같은 표에 담을 수 있습니다. 잔여 주행지가 둘이었던 건 칸별(4행)과
       합계(1행)의 단위가 달라서였습니다.

       뷰 컬럼: auto_roll · manual_roll · issue_roll(합친 값) · is_manual · memo */
    App.ISSUE_TABLE = 'factory1_geupji_issue';
    App.ISSUE_VIEW  = 'v_factory1_geupji_issue';

    /* 칸 수. 지금 실제로 쓰는 건 3칸이고 여유로 하나 더 둡니다.
       늘릴 때는 이 숫자와 테이블의 CHECK 제약, HTML thead 만 맞추면 됩니다
       (행 구조라 컬럼 추가가 없습니다). */
    App.CARRY_SLOTS = 4;

    /* is_carry 가 켜진 용지 키 — loadPaperMaster 가 채웁니다.

       null 은 '아직 모른다'는 뜻입니다(조회 전이거나 실패). 빈 배열과 구분해야
       합니다. 빈 배열은 "관리할 용지가 없다"라서 표를 감추는 게 맞지만, 조회
       실패까지 감추면 좌측 레이아웃이 그려졌다가 사라져 화면이 튑니다. */
    App.CARRY_KEYS = null;

    // ── 호기 / 컬럼 정의 ─────────────────────────────────────────────────────
    App.MACHINES = ['m1', 'm2', 'm3'];
    App.MACHINE_LABELS = { m1: '1호기', m2: '2호기', m3: '3호기' };

    App.COLUMNS = ['R1B', 'R1A', 'R2', 'R3B', 'R3A', 'R4', 'R5'];
    App.COLUMN_LABELS = {
        R1B: 'R1(B)', R1A: 'R1(A)', R2: 'R2',
        R3B: 'R3(B)', R3A: 'R3(A)', R4: 'R4', R5: 'R5'
    };

    /* ── 용지 종류 ────────────────────────────────────────────────────────────
       전부 v_factory1_geupji_paper 에서 채웁니다. 여기 하드코딩된 값은 없습니다.
       채우는 곳은 factory1_geupji_api.js 의 App.loadPaperMaster() 이고,
       페이지가 뜰 때 한 번만 읽습니다.

         TYPE_KEYS       드롭다운에 뜨는 순서 그대로의 급지 용지 키
         TYPE_LABELS     키 → 화면 라벨            ('전주 1404' 등)
         ROLL_KG         키 → 완롤 1개당 중량(kg)  (factory1_paper_item.roll_kg)
         ERP_ITEM_CODES  키 → ERP 품목코드 배열
                         전주는 둘입니다. ERP 는 본지와 전자신문을 다른 품목으로
                         관리하지만 급지 현장에서는 같은 롤이라 구분하지 않아,
                         두 품목의 사용량을 합쳐야 이 표의 실사용과 견줄 수 있습니다.
       ──────────────────────────────────────────────────────────────────────── */
    App.TYPE_KEYS = [];
    App.TYPE_LABELS = {};
    App.ROLL_KG = {};
    App.ERP_ITEM_CODES = {};

    /* 급지 그룹에 속한 ERP 품목 — 회계용 재고 배분에 씁니다.
         ITEM_CODES  급지키 → 품목코드 배열   (sort_order 순, 마지막이 잔여를 받습니다)
         ITEM_LABELS 품목코드 → 이름          ('전주본지' / '전주전자')

       품목이 둘 이상인 그룹에만 하위 줄이 생깁니다. 지금은 전주 1404 · 702 뿐입니다.
       급지 현장에서는 같은 롤이라 구분하지 않지만 회계상 본지는 자사, 전자는
       사급이라 다른 물건입니다. */
    App.ITEM_CODES = {};
    App.ITEM_LABELS = {};

    // 회계용 재고 배분 — 입력한 품목만 행이 생깁니다 (잔여 품목은 계산값이라 저장하지 않습니다)
    App.ALLOC_TABLE = 'factory1_geupji_alloc';

    // 용지 종류별 완롤 1개당 중량(kg) — 마스터에 없는 키는 0 입니다
    App.rollWeight = function (typeKey) {
        return App.ROLL_KG[typeKey] || 0;
    };

    /* 용지 종류별 드롭다운 색상 클래스 (품목 색상 유지용)
       거래처를 키 접두사로 가릅니다. 마스터에 새 거래처가 생기면 색이 없는 상태로
       뜨므로, 그때 여기에 한 줄 추가하거나 마스터에 색 구분을 넣으면 됩니다. */
    App.typeColorClass = function (typeKey) {
        if (!typeKey) return '';
        if (typeKey.startsWith('dh_')) return 'type-dh';
        if (typeKey.startsWith('jj_')) return 'type-jj';
        if (typeKey.startsWith('pp_')) return 'type-pp';
        return '';
    };

    // 컬럼별 기본 용지 종류 (R1(B)는 예외 처리, 2호기 R1(B)는 전주 702)
    App.defaultType = function (machine, col) {
        if (col === 'R1B') {
            return machine === 'm2' ? 'jj_702' : 'dh_702';
        }
        return 'dh_1404';
    };

    // ── 공통 유틸리티 ─────────────────────────────────────────────────────────
    App.utils = {
        getTodayStr() {
            const d = new Date();
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        },
        addDays(dateStr, days) {
            const d = new Date(`${dateStr}T00:00:00`);
            d.setDate(d.getDate() + days);
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        },
        formatKoDate(dateStr) {
            if (!dateStr) return '';
            const d = new Date(`${dateStr}T00:00:00`);
            const days = ['일', '월', '화', '수', '목', '금', '토'];
            return `${d.getFullYear()}년 ${String(d.getMonth() + 1).padStart(2, '0')}월 ${String(d.getDate()).padStart(2, '0')}일 (${days[d.getDay()]})`;
        },
        parseNum(value) {
            if (value === undefined || value === null || value === '') return 0;
            const parsed = Number(String(value).replace(/,/g, '').trim());
            return isNaN(parsed) ? 0 : parsed;
        },
        formatNum(value) {
            if (value === '' || value == null) return '';
            const num = Number(value);
            if (isNaN(num)) return '';
            return Number.isInteger(num)
                ? num.toLocaleString()
                : num.toLocaleString(undefined, { maximumFractionDigits: 2 });
        },
        formatSignedNum(value) {
            if (!value) return '0';
            const formatted = App.utils.formatNum(Math.abs(value));
            return value > 0 ? `+${formatted}` : `-${formatted}`;
        }
    };

    // ── 전역 상태 ─────────────────────────────────────────────────────────────
    App.state = {
        currentDate: null,
        isEditMode: false,
        isChanged: false,

        /* 다음날 재고 (실사용량 계산용)
           실사용량 = 오늘 재고 + 출고롤 × 중량 − 다음날 재고 이므로, 오늘 자를
           적는 시점에는 아직 확정될 수 없는 값입니다. 내일 급지대를 세고 나서야
           오늘 실사용량이 정해집니다. 저장하지 않고 매번 뷰에서 읽는 이유입니다. */
        nextDayInventory: {},

        /* DB 에서 읽어온 급지대 키 집합 — 'machine|stand'
           저장할 때 "원래 행이 있었는데 지금은 숫자가 비었다" 를 가려내는 데 씁니다.
           그 급지대는 UPDATE 가 아니라 행 자체를 지워야 미입력 상태로 돌아갑니다. */
        loaded: new Set(),

        // DB 에서 읽어온 배분 품목코드 — 비워서 저장하면 행을 지우는 데 씁니다
        loadedAlloc: new Set(),

        /* 잔여 주행지의 '계승까지 끝난 현재 값' — loadedCarry[용지키][칸번호] = kg
           저장할 때 이것과 다른 칸만 새 행으로 씁니다. 같으면 안 씁니다.
           그래야 "값이 바뀐 날만 행이 생긴다"가 지켜지고, 매일 저장 버튼을 눌러도
           같은 값이 날짜별로 쌓이지 않습니다. */
        loadedCarry: {},

        /* 실제 출고 — loadedIssue[용지키] = { auto, manual, memo }
           auto 는 자동계산값(없으면 null), manual 은 저장된 수기값(없으면 null).
           저장할 때 화면 값이 auto 와 같으면 행을 지우고, 다르면 행을 씁니다. */
        loadedIssue: {},

        // 메모줄이 지금 그려져 있는 용지 키 — 입력 중 재렌더로 포커스가 튀지 않게 비교용
        issueMemoKeys: '',

        /* 급지 용지별 재고 총계 (calculateFields 가 채웁니다)
           배분이 총계를 넘는지 검사할 때 씁니다. 좌측을 고쳐 총계가 줄면
           검사 기준도 곧바로 따라갑니다. */
        stockTotal: {}
    };

    // headerApi 플레이스홀더 (공통 헤더 연결 시 factory1_geupji_main.js 에서 주입 예정)
    App.headerApi = null;

    // elements 캐시 (factory1_geupji_main.js 에서 주입)
    App.elements = {};

})();
