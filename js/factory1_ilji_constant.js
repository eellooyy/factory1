/* factory1_ilji_constant.js — 1공장 일지 공통 상수 · 유틸 · 상태 */
(function () {
    'use strict';

    // 전역 공유 객체 초기화
    window.Factory1Ilji = window.Factory1Ilji || {};

    const App = window.Factory1Ilji;

    // ── Supabase 설정 (추후 연결 예정 — 지금은 비워둠) ──────────────────────────
    // App.SUPABASE_URL = '';
    // App.SUPABASE_KEY = '';
    // App.TABLE = 'factory1_ilji_real';

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

    // headerApi 플레이스홀더 (공통 헤더 연결 시 factory1_ilji_main.js 에서 주입 예정)
    App.headerApi = null;

    // elements 캐시 (factory1_ilji_main.js 에서 주입)
    App.elements = {};

})();
