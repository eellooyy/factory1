/* factory1_geupji_constant.js — 1공장 급지 재고 공통 상수 · 유틸 · 상태 */
(function () {
    'use strict';

    // 전역 공유 객체 초기화
    window.Factory1GeupjiInv = window.Factory1GeupjiInv || {};

    const App = window.Factory1GeupjiInv;

    // ── Supabase 설정 ────────────────────────────────────────────────────────
    App.SUPABASE_URL = 'https://npiflqoscsvnnauvqhrr.supabase.co';
    App.SUPABASE_KEY = 'sb_publishable_ir-mHSsX6SSIQwHerkLbfA_2qCOP3KW';

    // 일지 본체(호기별 잔량 · 출고롤)를 저장할 테이블 — 아직 미확정입니다.
    // App.TABLE = 'factory1_geupji_real';

    /* ERP 사용량 조회용 뷰 — 사용량 페이지(factory1_paperuse)가 보는 것과 같습니다.
       base 테이블(factory1_usage)을 직접 읽지 않습니다. 회계 보정(adjustments)이
       뷰에서만 합산되기 때문이고, 나중에 보정이 들어와도 여기는 고칠 게 없습니다.
       컬럼: print_date, item_code, item_name, usage_qty (kg) */
    App.USAGE_VIEW = 'v_factory1_usage_by_item';

    // ── 호기 / 컬럼 정의 ─────────────────────────────────────────────────────
    App.MACHINES = ['m1', 'm2', 'm3'];
    App.MACHINE_LABELS = { m1: '1호기', m2: '2호기', m3: '3호기' };

    App.COLUMNS = ['R1B', 'R1A', 'R2', 'R3B', 'R3A', 'R4', 'R5'];
    App.COLUMN_LABELS = {
        R1B: 'R1(B)', R1A: 'R1(A)', R2: 'R2',
        R3B: 'R3(B)', R3A: 'R3(A)', R4: 'R4', R5: 'R5'
    };

    // ── 용지 종류 정의 ───────────────────────────────────────────────────────
    App.TYPE_KEYS = ['dh_1404', 'dh_702', 'jj_1404', 'jj_702', 'pp_1404'];
    App.TYPE_LABELS = {
        dh_1404: '대한 1404',
        dh_702: '대한 702',
        jj_1404: '전주 1404',
        jj_702: '전주 702',
        pp_1404: '페이퍼 1404'
    };
    App.PAPER_OPTIONS = App.TYPE_KEYS.map(key => ({ value: key, label: App.TYPE_LABELS[key] }));

    /* ── 급지 용지 ↔ ERP 품목코드 ────────────────────────────────────────────
       '사용량 상세 내역'의 ERP 열이 v_factory1_usage_by_item 에서 값을 끌어올 때
       쓰는 대응표입니다. 지폭 표기가 서로 달라 한 번 거쳐야 합니다.

         이 페이지    1404 = A(1576폭)   702 = D(788폭)
         ERP 품목코드  factory1_paper_item.erp_code 와 동일

       전주는 배열이 둘입니다. ERP 는 본지와 전자신문을 다른 품목으로 관리하지만
       급지 현장에서는 같은 '전주 1404 / 전주 702' 롤이라 구분 없이 쓰입니다.
       그래서 두 품목의 사용량을 합쳐야 이 표의 실사용과 견줄 수 있습니다.

       ※ 대한 C(1182폭) · 48.8g · F.T 는 이 표의 다섯 종류에 없어 빠집니다.
       ──────────────────────────────────────────────────────────────────────── */
    App.ERP_ITEM_CODES = {
        dh_1404: ['11ANP-0000001'],                   // 대한제지 A
        dh_702:  ['11ANP-0000003'],                   // 대한제지 D
        jj_1404: ['11ANP-0000008', '11BNP-0000003'],  // 전주본지 A + 전주전자 A
        jj_702:  ['11ANP-0000009', '11BNP-0000004'],  // 전주본지 D + 전주전자 D
        pp_1404: ['11ANP-0000004']                    // 페이퍼 코리아
    };

    // 용지 종류별 완롤 1개당 중량(kg)
    App.rollWeight = function (typeKey) {
        return typeKey && typeKey.endsWith('1404') ? 1404 : 702;
    };

    // 용지 종류별 드롭다운 색상 클래스 (품목 색상 유지용)
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
        // 다음날 재고(실사용량 계산용) — DB 연결 전에는 항상 0으로 처리
        nextDayInventory: {}
    };

    // headerApi 플레이스홀더 (공통 헤더 연결 시 factory1_geupji_main.js 에서 주입 예정)
    App.headerApi = null;

    // elements 캐시 (factory1_geupji_main.js 에서 주입)
    App.elements = {};

})();
